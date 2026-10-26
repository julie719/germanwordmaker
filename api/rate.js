import { rate, voterId, wordExists } from './_lib/store.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { id, stars } = req.body || {};
  if (!/^\d{1,16}$/.test(String(id))) return res.status(400).json({ error: 'Invalid word id' });
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return res.status(400).json({ error: 'Stars must be a whole number from 1 to 5' });
  }

  try {
    if (!(await wordExists(id))) return res.status(404).json({ error: 'Word not found' });
    const rating = await rate(String(id), stars, voterId(req));
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ...rating, yours: stars });
  } catch (e) {
    console.error('Rating error:', e.message);
    res.status(500).json({ error: 'Could not save your rating.' });
  }
}
