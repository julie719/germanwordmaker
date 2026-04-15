export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { concept } = req.body;
  if (!concept) return res.status(400).json({ error: 'No concept provided' });

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: `You are a creative German linguist who invents plausible-sounding new German compound words. Given a concept, create a single new German word that could realistically exist in German.

If the concept is offensive, sexual, hateful, violent, or inappropriate in any way, do NOT refuse with a plain error. Instead, invent a German word that wittily describes the act of typing something offensive into a word generator — something like the feeling of revealing poor judgment, the specific shame of trying to make an AI say something crude, or the peculiar emptiness of that choice. Make it pointed but clever, not mean. Treat it like any other word request but themed around the person's inappropriate behavior.

Respond ONLY with a JSON object. No markdown, no backticks, no explanation. Exactly this structure:
{
  "word": "TheNewGermanWord",
  "pronunciation": "approximate phonetic pronunciation for English speakers",
  "parts": [
    {"german": "Teil1", "meaning": "English meaning"},
    {"german": "Teil2", "meaning": "English meaning"}
  ],
  "definition": "A one or two sentence definition, as if from a dictionary.",
  "example": "An example sentence in German, followed by its English translation in parentheses.",
  "isRefusal": true or false
}

Set isRefusal to true only when the concept was inappropriate and you invented a refusal word instead.`,
      messages: [{ role: 'user', content: `Invent a new German compound word for this concept: ${concept}` }]
    })
  });

  const data = await response.json();
  const raw = data.content.find(b => b.type === 'text')?.text || '';
  const clean = raw.replace(/```json|```/g, '').trim();

  try {
    const word = JSON.parse(clean);
    word.concept = concept;
    word.createdAt = new Date().toISOString();
    word.wordKey = `${word.word.toLowerCase()}-${Date.now()}`;

    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['host'];

    const speakRes = await fetch(`${proto}://${host}/api/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: word.word + '. ' + word.example.split('(')[0].trim(),
        wordKey: word.wordKey
      })
    });

    if (speakRes.ok) {
      const audioUrl = speakRes.headers.get('X-Audio-Url');
      if (audioUrl) word.audioUrl = audioUrl;
    }

    if (!word.isRefusal) {
      await fetch(`${proto}://${host}/api/gallery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(word)
      });
    }

    res.status(200).json(word);
  } catch (e) {
    res.status(500).json({ error: 'Failed to parse response', raw });
  }
}
