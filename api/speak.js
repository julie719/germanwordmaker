import { put, list } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { text, wordKey } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' });

  const voiceId = 'xqj50N5hatZhF8MSqCFS';

  if (wordKey) {
    try {
      const { blobs } = await list({ prefix: `audio/${wordKey}` });
      if (blobs.length > 0) {
        const audioRes = await fetch(blobs[0].url);
        const audioBuffer = await audioRes.arrayBuffer();
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('X-Audio-Url', blobs[0].url);
        return res.send(Buffer.from(audioBuffer));
      }
    } catch (e) {}
  }

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

  let audioUrl = null;
  if (wordKey) {
    try {
      const blob = await put(`audio/${wordKey}.mp3`, Buffer.from(audioBuffer), {
        access: 'public',
        contentType: 'audio/mpeg'
      });
      audioUrl = blob.url;
    } catch (e) {}
  }

  res.setHeader('Content-Type', 'audio/mpeg');
  if (audioUrl) res.setHeader('X-Audio-Url', audioUrl);
  res.send(Buffer.from(audioBuffer));
}
