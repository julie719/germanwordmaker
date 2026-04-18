export default async function handler(req, res) {
  const { key } = req.query;
  if (key !== 'DeutschisFun1!') return res.status(401).json({ error: 'Unauthorized' });

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  try {
    const listRes = await fetch(`${url}/lrange/words/0/199`, {
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

    const valid = words.filter(Boolean);

    const header = ['word', 'pronunciation', 'concept', 'definition', 'example', 'parts', 'audioUrl', 'createdAt'];

    const rows = valid.map(w => [
      w.word || '',
      w.pronunciation || '',
      w.concept || '',
      w.definition || '',
      w.example || '',
      (w.parts || []).map(p => `${p.german} (${p.meaning})`).join(' + '),
      w.elevenLabsHistoryId ? `https://germanwordmaker.com/api/audio?id=${w.elevenLabsHistoryId}` : '',
      w.createdAt || ''
    ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(','));

    const csv = [header.join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="germanwordmaker-export.csv"');
    res.status(200).send(csv);

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
