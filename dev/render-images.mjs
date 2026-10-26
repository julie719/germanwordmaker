// Regenerates the static images, using the same renderer as /api/og:
//   favicon.svg           a tiny Ortsschild with a bold W, text as outlines
//   favicon.ico           16/32/48px PNGs of the same, for Safari and /favicon.ico requests
//   apple-touch-icon.png  180x180 home-screen icon
//   og-image.png          the default share card (needs `vercel dev` running)
// Run from the repo root: npm run images
import { ImageResponse } from '@vercel/og';
import satori from 'satori';
import { Resvg, initWasm } from '@resvg/resvg-wasm';
import { readFile, writeFile } from 'node:fs/promises';

const bold = await readFile('api/_fonts/D-DIN-Bold.otf');
const fonts = [{ name: 'D-DIN', data: bold, weight: 700, style: 'normal' }];
const div = (style, children) => ({ type: 'div', props: { style: { display: 'flex', ...style }, children } });

// Favicon: drawn at 32px; satori turns the W into a path, so no font is needed to display it.
const faviconSvg = await satori(
  div({ width: 32, height: 32, padding: 1.5, borderRadius: 7, background: '#F7C600' },
    div({
      flex: 1, alignItems: 'center', justifyContent: 'center',
      border: '2px solid #0A0A0A', borderRadius: 5.5,
      fontFamily: 'D-DIN', fontWeight: 700, fontSize: 24, lineHeight: 1, color: '#0A0A0A'
    }, 'W')
  ),
  { width: 32, height: 32, fonts }
);
await writeFile('favicon.svg', `${faviconSvg}\n`);

await initWasm(await readFile('node_modules/@resvg/resvg-wasm/index_bg.wasm'));
const png = size => new Resvg(faviconSvg, { fitTo: { mode: 'width', value: size } }).render().asPng();
await writeFile('favicon.ico', ico([16, 32, 48].map(size => ({ size, data: Buffer.from(png(size)) }))));

const icon = new ImageResponse(
  div({ width: 180, height: 180, padding: 14, background: '#F7C600' },
    div({
      flex: 1, alignItems: 'center', justifyContent: 'center', border: '7px solid #0A0A0A', borderRadius: 18,
      fontFamily: 'D-DIN', fontWeight: 700, fontSize: 54, color: '#0A0A0A'
    }, 'Wort')
  ),
  { width: 180, height: 180, fonts }
);
await writeFile('apple-touch-icon.png', Buffer.from(await icon.arrayBuffer()));

const og = await fetch('http://localhost:3000/api/og').catch(() => null);
if (og?.ok) await writeFile('og-image.png', Buffer.from(await og.arrayBuffer()));
else console.warn('Skipped og-image.png: start `vercel dev` to regenerate it.');

console.log('Wrote favicon.svg, favicon.ico and apple-touch-icon.png');

// An .ico file whose images are stored as PNGs (supported by every current browser).
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size, 0);
    entry.writeUInt8(size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map(i => i.data)]);
}
