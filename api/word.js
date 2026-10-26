import { findBySlug } from './_lib/store.js';

export default async function handler(req, res) {
  const slug = req.query.slug || '';
  if (!slug) return res.status(400).json({ error: 'No word provided' });

  try {
    const word = await findBySlug(slug);
    if (!word) return res.status(404).json({ error: 'Word not found' });
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=300');
    res.status(200).json(word);
  } catch (e) {
    console.error('Word lookup error:', e.message);
    res.status(500).json({ error: 'Could not look up that word.' });
  }
}
