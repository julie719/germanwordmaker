// Stand-in for the Anthropic and ElevenLabs APIs so the site can run locally
// without keys. Point ANTHROPIC_BASE_URL / ELEVENLABS_BASE_URL at it.
//
// Concept keywords pick a specific response: "long" (layout stress test),
// "refusal" (isRefusal: true, not saved to the gallery), "error" (unparseable
// reply, shows the error state). Anything else gets a random normal word.
import http from 'node:http';
import { readFileSync } from 'node:fs';

const fixtures = JSON.parse(readFileSync(new URL('./mock-words.json', import.meta.url)));
const DELAY_MS = 1200;

function pickWord(concept) {
  const c = concept.toLowerCase();
  if (c.includes('error')) return null;
  if (c.includes('refusal')) return fixtures.refusal;
  if (c.includes('long')) return fixtures.long;
  return fixtures.normal[Math.floor(Math.random() * fixtures.normal.length)];
}

// Half-second two-note chime as a WAV, standing in for the spoken word.
function chime() {
  const rate = 22050, seconds = 0.5, n = rate * seconds;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const freq = t < seconds / 2 ? 660 : 880;
    const fade = Math.min(1, (seconds - t) * 8);
    buf.writeInt16LE(Math.round(Math.sin(2 * Math.PI * freq * t) * 8000 * fade), 44 + i * 2);
  }
  return buf;
}
const audio = chime();

const readBody = req => new Promise(resolve => {
  let data = '';
  req.on('data', chunk => data += chunk);
  req.on('end', () => resolve(data ? JSON.parse(data) : {}));
});

http.createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;

  if (req.method === 'POST' && path === '/v1/messages') {
    const body = await readBody(req);
    const prompt = body.messages?.[0]?.content || '';
    const word = pickWord(prompt.split(':').slice(1).join(':'));
    const text = word ? JSON.stringify(word) : 'Sorry, I could not come up with anything.';
    await new Promise(r => setTimeout(r, DELAY_MS));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ content: [{ type: 'text', text }] }));
  }

  if (req.method === 'POST' && path.endsWith('/with-timestamps')) {
    res.writeHead(200, { 'Content-Type': 'application/json', 'history-item-id': `mock-${Date.now()}` });
    return res.end('{}');
  }

  if ((req.method === 'POST' && path.startsWith('/v1/text-to-speech/')) ||
      (req.method === 'GET' && /^\/v1\/history\/[^/]+\/audio$/.test(path))) {
    res.writeHead(200, { 'Content-Type': 'audio/wav' });
    return res.end(audio);
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: `mock-ai: no mock for ${req.method} ${path}` }));
}).listen(80);
