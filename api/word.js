export default async function handler(req, res) {
  const slug = decodeURIComponent(req.query.slug || '');
  if (!slug) return res.status(400).json({ error: 'No word provided' });

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  try {
    const listRes = await fetch(`${url}/lrange/words/0/199`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const listData = await listRes.json();
    const keys = listData.result || [];

    for (const key of keys) {
      const r = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const d = await r.json();
      if (d.result) {
        const word = JSON.parse(decodeURIComponent(d.result));
        if (word.word.toLowerCase() === decodeURIComponent(slug).toLowerCase()) {
          return res.status(200).json(word);
        }
      }
    }

    return res.status(404).json({ error: 'Word not found' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
