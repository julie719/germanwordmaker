// Copies the live gallery (public GET /api/gallery) into the local Redis,
// stored exactly the way api/gallery.js stores words. Replaces local data.
const url = process.env.KV_REST_API_URL || 'http://localhost:8079';
const token = process.env.KV_REST_API_TOKEN || 'local-dev-token';
const source = process.env.SEED_SOURCE || 'https://www.germanwordmaker.com/api/gallery';

if (!/^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error(`Refusing to seed ${url}: this script wipes the database, so it only runs against localhost.`);
  process.exit(1);
}

const kv = async path => {
  const r = await fetch(`${url}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const d = await r.json();
  if (d.error) throw new Error(`${path.split('/')[0]}: ${d.error}`);
  return d.result;
};

const words = await (await fetch(source)).json();

await kv('flushdb');
// The gallery lists newest first, and lpush prepends, so push oldest first.
for (const word of [...words].reverse()) {
  const key = `word:${Date.parse(word.createdAt) || Date.now()}`;
  await kv(`set/${key}/${encodeURIComponent(JSON.stringify(word))}`);
  await kv(`lpush/words/${encodeURIComponent(key)}`);
}

console.log(`Seeded ${words.length} words from ${source}`);
