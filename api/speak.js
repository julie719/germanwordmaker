export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { text, wordKey } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' });

  const voiceId = 'xqj50N5hatZhF8MSqCFS';
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

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
  if (wordKey && blobToken) {
    try {
      const filename = `audio-${wordKey}.mp3`;
      const uploadRes = await fetch(`https://blob.vercel-storage.com/${filename}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${blobToken}`,
          'Content-Type': 'audio/mpeg',
          'x-content-type': 'audio/mpeg',
          'cache-control': 'public, max-age=31536000'
        },
        body: Buffer.from(audioBuffer)
      });

      if (uploadRes.ok) {
        const blobData = await uploadRes.json();
        audioUrl = blobData.url;
      }
    } catch (e) {
      console.error('Blob upload error:', e.message);
    }
  }

  res.setHeader('Content-Type', 'audio/mpeg');
  if (audioUrl) res.setHeader('X-Audio-Url', audioUrl);
  res.send(Buffer.from(audioBuffer));
}
