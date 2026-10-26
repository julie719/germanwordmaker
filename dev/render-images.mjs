// Regenerates the static images from the same renderer as /api/og:
//   og-image.png          the default share card (needs `vercel dev` running)
//   apple-touch-icon.png  180x180 home-screen icon
// Run from the repo root: node dev/render-images.mjs
import { ImageResponse } from '@vercel/og';
import { readFile, writeFile } from 'node:fs/promises';

const og = await fetch('http://localhost:3000/api/og');
if (!og.ok) throw new Error(`GET /api/og failed (${og.status}); is vercel dev running?`);
await writeFile('og-image.png', Buffer.from(await og.arrayBuffer()));

const bold = await readFile('api/_fonts/D-DIN-Bold.otf');
const div = (style, children) => ({ type: 'div', props: { style: { display: 'flex', ...style }, children } });
const icon = new ImageResponse(
  div({ width: 180, height: 180, padding: 14, background: '#F7C600' },
    div({
      flex: 1, alignItems: 'center', justifyContent: 'center', border: '7px solid #0A0A0A', borderRadius: 18,
      fontFamily: 'D-DIN', fontWeight: 700, fontSize: 54, color: '#0A0A0A'
    }, 'Wort')
  ),
  { width: 180, height: 180, fonts: [{ name: 'D-DIN', data: bold, weight: 700, style: 'normal' }] }
);
await writeFile('apple-touch-icon.png', Buffer.from(await icon.arrayBuffer()));

console.log('Wrote og-image.png and apple-touch-icon.png');
