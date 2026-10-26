import { listNewest } from './_lib/store.js';

export default async function handler(req, res) {
  const { key } = req.query;
  if (!process.env.EXPORT_KEY || key !== process.env.EXPORT_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { words } = await listNewest(0, 100000);

    const header = ['word', 'article', 'pronunciation', 'concept', 'definition', 'example', 'parts', 'ratingAvg', 'ratingCount', 'audioUrl', 'createdAt'];

    const rows = words.map(w => [
      w.word || '',
      w.article || '',
      w.pronunciation || '',
      w.concept || '',
      w.definition || '',
      w.example || '',
      (w.parts || []).map(p => `${p.german} (${p.meaning})`).join(' + '),
      w.rating.count ? w.rating.avg : '',
      w.rating.count,
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
