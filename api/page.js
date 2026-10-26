// Serves /word/<slug> (see vercel.json): the word.html template with the word's
// own title and share-preview tags, and the word embedded so the page renders
// without a second request.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { findBySlug } from './_lib/store.js';

let template;

const escapeHtml = s => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const escapeJson = value => JSON.stringify(value)
  .replace(/</g, '\\u003c')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');

export default async function handler(req, res) {
  template ??= await readFile(path.join(process.cwd(), 'word.html'), 'utf8');

  let slug = String(req.query.slug || '');
  try { slug = decodeURIComponent(slug); } catch {}

  let word = null;
  try {
    word = slug ? await findBySlug(slug) : null;
  } catch (e) {
    console.error('Word page lookup error:', e.message);
  }

  const origin = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers['x-forwarded-host'] || req.headers.host}`;
  const meta = word
    ? [
        `<title>${escapeHtml(word.word)} | German Word Maker</title>`,
        `<meta name="description" content="${escapeHtml(word.definition || '')}" />`,
        `<meta property="og:title" content="${escapeHtml(word.word)}" />`,
        `<meta property="og:description" content="${escapeHtml(word.definition || '')}" />`,
        `<meta property="og:image" content="${origin}/api/og?slug=${encodeURIComponent(word.word)}" />`,
        '<meta property="og:image:width" content="1200" />',
        '<meta property="og:image:height" content="630" />',
        `<meta property="og:url" content="${origin}/word/${encodeURIComponent(word.word)}" />`,
        '<meta property="og:type" content="article" />',
        '<meta name="twitter:card" content="summary_large_image" />'
      ].join('\n  ')
    : '<title>Word not found | German Word Maker</title>\n  <meta name="robots" content="noindex" />';

  const html = template
    .replace(/<!--meta-->[\s\S]*?<!--\/meta-->/, meta)
    .replace(
      '<script type="application/json" id="word-data">null</script>',
      `<script type="application/json" id="word-data">${escapeJson({ word })}</script>`
    );

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', word ? 's-maxage=60, stale-while-revalidate=600' : 's-maxage=10');
  res.status(word ? 200 : 404).send(html);
}
