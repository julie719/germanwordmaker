// Share image for a word: the word on an Ortsschild, 1200x630.
// /api/og?slug=<word> for a word; no slug renders the site's own card.
import { ImageResponse } from '@vercel/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { findBySlug } from './_lib/store.js';
import { hyphenate } from '../assets/text.js';

const WIDTH = 1200;
const HEIGHT = 630;
const TEXT_WIDTH = 940;
// Average advance widths (em) of German words in D-DIN, with some headroom.
const EM_BOLD = 0.53;
const EM_CONDENSED = 0.43;
const MAX_SIZE = 168;
const MIN_SIZE = 76;
const WRAP_SIZE = 68;
const EM_WRAP = 0.42;

const SITE_WORD = {
  word: 'Wortmacher',
  article: 'der',
  pronunciation: 'VORT-makh-er',
  parts: [{ german: 'Wort' }, { german: 'Macher' }]
};

let fonts;
function loadFonts() {
  const dir = path.join(process.cwd(), 'api/_fonts');
  fonts ??= Promise.all(['D-DIN.otf', 'D-DIN-Bold.otf', 'D-DINCondensed-Bold.otf'].map(f => readFile(path.join(dir, f))))
    .then(([regular, bold, condensed]) => [
      { name: 'D-DIN', data: regular, weight: 400, style: 'normal' },
      { name: 'D-DIN', data: bold, weight: 700, style: 'normal' },
      { name: 'D-DIN Condensed', data: condensed, weight: 700, style: 'normal' }
    ]);
  return fonts;
}

// Satori wants every div to be an explicit flex container.
const el = (type, style, ...children) => {
  const kids = children.flat().filter(c => c != null && c !== '');
  return { type, props: { style: { display: 'flex', ...style }, children: kids.length === 1 ? kids[0] : kids } };
};

// Same rule as the site: fit on one line, else condensed, else wrap between
// the compound's parts.
function layoutWord(word) {
  const length = [...word.word].length;
  const fit = em => Math.min(MAX_SIZE, TEXT_WIDTH / (length * em));
  let size = fit(EM_BOLD);
  if (size >= MIN_SIZE) return { family: 'D-DIN', size, lines: [word.word] };
  size = fit(EM_CONDENSED);
  if (size >= MIN_SIZE) return { family: 'D-DIN Condensed', size, lines: [word.word] };

  size = WRAP_SIZE;
  const perLine = Math.floor(TEXT_WIDTH / (size * EM_WRAP)) - 1;
  const lines = [];
  let line = '';
  for (const piece of hyphenate(word.word, word.parts).split('­')) {
    if (line && [...line].length + [...piece].length > perLine) {
      lines.push(`${line}-`);
      line = '';
    }
    line += piece;
    while ([...line].length > perLine + 1) {
      lines.push(`${[...line].slice(0, perLine).join('')}-`);
      line = [...line].slice(perLine).join('');
    }
  }
  lines.push(line);
  return { family: 'D-DIN Condensed', size, lines };
}

function card(word) {
  const { family, size, lines } = layoutWord(word);
  const pronunciation = word.pronunciation || '';
  const subSize = pronunciation.length > 70 ? 26 : pronunciation.length > 40 ? 30 : 36;

  return el('div', {
    width: WIDTH, height: HEIGHT, display: 'flex', flexDirection: 'column',
    padding: '40px 40px 0', background: '#F4F4F2', fontFamily: 'D-DIN'
  },
    el('div', {
      flex: 1, display: 'flex', padding: 18, borderRadius: 34, background: '#F7C600'
    },
      el('div', {
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 10, padding: '24px 44px', border: '9px solid #0A0A0A', borderRadius: 20, color: '#0A0A0A', textAlign: 'center'
      },
        word.article ? el('div', { fontSize: 44, fontWeight: 400 }, word.article) : null,
        el('div', { display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: family, fontWeight: 700, fontSize: size, lineHeight: 1.02 },
          lines.map(line => el('div', { display: 'flex' }, line))
        ),
        pronunciation ? el('div', { fontSize: subSize, fontWeight: 400, lineHeight: 1.2, maxWidth: TEXT_WIDTH }, pronunciation) : null
      )
    ),
    el('div', {
      height: 92, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      fontSize: 30, color: '#4E5452', padding: '0 6px'
    },
      el('div', { display: 'flex' }, 'germanwordmaker.com'),
      el('div', { display: 'flex', fontWeight: 700, color: '#0A0A0A' }, 'German Word Maker')
    )
  );
}

export default async function handler(req, res) {
  const slug = String(req.query.slug || '');
  let word = SITE_WORD;
  if (slug) {
    try {
      word = (await findBySlug(slug)) || SITE_WORD;
    } catch (e) {
      console.error('OG lookup error:', e.message);
    }
  }

  try {
    const image = new ImageResponse(card(word), { width: WIDTH, height: HEIGHT, fonts: await loadFonts() });
    const png = Buffer.from(await image.arrayBuffer());
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', word === SITE_WORD && slug
      ? 's-maxage=60'
      : 'public, max-age=86400, s-maxage=31536000, immutable');
    res.status(200).send(png);
  } catch (e) {
    console.error('OG render error:', e.message);
    res.status(500).json({ error: 'Could not render the image' });
  }
}
