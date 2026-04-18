export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'No id provided' });

  try {
    const audioRes = await fetch(`https://api.elevenlabs.io/v1/history/${id}/audio`, {
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY }
    });

    if (!audioRes.ok) return res.status(404).json({ error: 'Audio not found' });

    const audioBuffer = await audioRes.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `attachment; filename="${id}.mp3"`);
    res.send(Buffer.from(audioBuffer));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
