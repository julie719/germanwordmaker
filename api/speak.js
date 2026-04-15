export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { text, wordKey } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' });

  const voiceId = 'xqj50N5hatZhF8MSqCFS';
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

  if (wordKey) {
    try {
      const listRes = await fetch(`https://blob.vercel-storage.com?prefix=audio/${wordKey}`, {
        headers: { Authorization: `Bearer ${blobToken}` }
      });
      const listData = await listRes.json();
      if (listData.blobs && listData.blobs.length > 0) {
        const cachedUrl = listData.blobs[0].url;
        const audioRes = await fetch(cachedUrl);
        const audioBuffer = await audioRes.arrayBuffer();
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('X-Audio-Url', cachedUrl);
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

  if (wordKey) {
    try {
      const filename = `audio/${wordKey}.mp3`;
      await fetch(`https://blob.vercel-storage.com/${filename}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${blobToken}`,
          'Content-Type': 'audio/mpeg',
          'x-content-type': 'audio/mpeg'
        },
        body: Buffer.from(audioBuffer)
      });
    } catch (e) {}
  }

  res.setHeader('Content-Type', 'audio/mpeg');
  res.send(Buffer.from(audioBuffer));
}
