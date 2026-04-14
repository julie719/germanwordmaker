export default async function handler(req, res) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (req.method === 'POST') {
    const word = req.body;
    const key = `word:${Date.now()}`;
    await fetch(`${url}/set/${key}/${encodeURIComponent(JSON.stringify(word))}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    await fetch(`${url}/lpush/words/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'GET') {
    const listRes = await fetch(`${url}/lrange/words/0/49`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const listData = await listRes.json();
    const keys = listData.result || [];

    const words = await Promise.all(keys.map(async key => {
      const r = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const d = await r.json();
      return d.result ? JSON.parse(decodeURIComponent(d.result)) : null;
    }));

    return res.status(200).json(words.filter(Boolean));
  }

  res.status(405).end();
}
