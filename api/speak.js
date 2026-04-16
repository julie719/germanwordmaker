export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { text, historyId } = req.body;
  const voiceId = 'xqj50N5hatZhF8MSqCFS';

  if (historyId) {
    try {
      const historyRes = await fetch(`https://api.elevenlabs.io/v1/history/${historyId}/audio`, {
        headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY }
      });
      if (historyRes.ok) {
        const audioBuffer = await historyRes.arrayBuffer();
        res.setHeader('Content-Type', 'audio/mpeg');
        return res.send(Buffer.from(audioBuffer));
      }
    } catch (e) {}
  }

  if (!text) return res.status(400).json({ error: 'No text provided' });

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
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

  if (!response.ok) return res.status(500).json({ error: 'ElevenLabs error' });

  const audioBuffer = await response.arrayBuffer();
  res.setHeader('Content-Type', 'audio/mpeg');
  res.send(Buffer.from(audioBuffer));
}
