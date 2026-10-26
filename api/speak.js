const MAX_TEXT_LENGTH = 300;

export default async function handler(req, res) {
  const voiceId = 'xqj50N5hatZhF8MSqCFS';
  const elevenLabsUrl = process.env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io';

  // GET ?historyId= serves audio that was generated along with the word.
  // It never changes, so browsers and the edge can cache it for good.
  if (req.method === 'GET') {
    const { historyId } = req.query;
    if (!historyId) return res.status(400).json({ error: 'No historyId provided' });
    try {
      const historyRes = await fetch(`${elevenLabsUrl}/v1/history/${encodeURIComponent(historyId)}/audio`, {
        headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY }
      });
      if (!historyRes.ok) return res.status(404).json({ error: 'Audio not found' });
      const audioBuffer = await historyRes.arrayBuffer();
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.send(Buffer.from(audioBuffer));
    } catch (e) {
      return res.status(502).json({ error: 'Audio unavailable' });
    }
  }

  if (req.method !== 'POST') return res.status(405).end();

  // POST { text } synthesizes fresh audio, for words saved without any.
  const { text } = req.body || {};
  if (!text || typeof text !== 'string') return res.status(400).json({ error: 'No text provided' });
  if (text.length > MAX_TEXT_LENGTH) return res.status(400).json({ error: 'Text too long' });

  const response = await fetch(`${elevenLabsUrl}/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 }
    })
  });

  if (!response.ok) {
    console.error('ElevenLabs error', response.status, await response.text());
    return res.status(502).json({ error: 'Audio unavailable' });
  }

  const audioBuffer = await response.arrayBuffer();
  res.setHeader('Content-Type', 'audio/mpeg');
  res.send(Buffer.from(audioBuffer));
}
