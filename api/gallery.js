import { listNewest, listTop } from './_lib/store.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const sort = req.query.sort === 'top' ? 'top' : 'new';
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 24));

  try {
    const page = await (sort === 'top' ? listTop : listNewest)(offset, limit);
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=60');
    res.status(200).json(page);
  } catch (e) {
    console.error('Gallery error:', e.message);
    res.status(500).json({ error: 'Could not load the dictionary.' });
  }
}
