# germanwordmaker

Describe a concept and get a new German compound word for it, with audio and star ratings, saved to a public dictionary. Live at <https://www.germanwordmaker.com>.

Static pages plus Vercel serverless functions, with no build step. Words come from Claude, audio from ElevenLabs, and storage is Upstash Redis.

## Layout

| Path | What it is |
| --- | --- |
| `index.html`, `word.html` | Page shells. `word.html` is a template that `api/page.js` fills in for `/word/<word>` |
| `assets/` | CSS and native ES modules: `entry.js` (sign, entry, audio, stars, share), `home.js`, `word-page.js`, `text.js` (pure helpers) |
| `fonts/` | Self-hosted D-DIN and Source Serif 4 (both SIL OFL, licenses alongside) |
| `api/generate.js` | Makes a word with Claude, adds ElevenLabs audio, saves it |
| `api/gallery.js` | `GET ?sort=new\|top&offset&limit`, the dictionary |
| `api/word.js`, `api/page.js` | Word lookup (JSON), and the server-rendered word page with share tags |
| `api/rate.js` | `POST {id, stars}`, one vote per hashed IP per word |
| `api/og.js` | Share image for a word (`?slug=`), rendered with `@vercel/og` |
| `api/speak.js`, `api/audio.js` | Audio playback and download |
| `api/export.js` | CSV export, `?key=` must match `EXPORT_KEY` |
| `api/_lib/` | Redis client and word store (not routes) |

### Design

The word goes on a German town sign (Ortsschild); everything else is set like a quiet dictionary page. Colors are RAL traffic colors (1023 Verkehrsgelb for the sign), type is D-DIN (a DIN 1451 revival, the road-sign face) and Source Serif 4. Long words switch to the condensed cut and then wrap between their compound parts, as real signs do.

## Environment variables

| Name | Needed for |
| --- | --- |
| `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY` | Making words and audio |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Storage (Upstash) |
| `EXPORT_KEY` | `/api/export`, which returns 401 until this is set |
| `RATING_SALT` | Optional. Salt for hashing voter IPs; defaults to the KV token |

## Deploys

Every push to `main` deploys to production on Vercel. Work on a branch.

## Local development

Needs Node 20+, Docker, and the Vercel CLI (`npm i -g vercel`). No API keys needed.

```sh
npm install
cp .env.example .env
npm run db:up            # local Redis (:8079) + mock Anthropic/ElevenLabs (:8081)
npm run db:seed          # optional: copy the live gallery into local Redis
vercel dev               # http://localhost:3000
npm test                 # unit tests for the pure helpers
```

The first `vercel dev` asks you to log in and link a project. Link it to a new project in your own account, not the production one. Linking deploys nothing. Restart `vercel dev` after adding new files; it only picks them up at startup.

By default, Anthropic and ElevenLabs are mocked by `dev/mock-ai.mjs`. It returns canned words from `dev/mock-words.json` and a short chime for audio. Put a keyword in the concept to get a specific case:

| Concept contains | You get |
| --- | --- |
| `long` | a 71-letter word with 7 parts and long text (layout stress test) |
| `refusal` | an `isRefusal` word, shown struck through and not saved |
| `error` | an unparseable reply, which shows the error message |
| `xss` | HTML, quotes and `%` in the definition, example and parts (escaping test) |
| anything else | a random normal word |

To use the real APIs, remove the `*_BASE_URL` lines from `.env` and add your own keys.

`npm run images` regenerates the favicons, `apple-touch-icon.png` and, with `vercel dev` running, `og-image.png`.

Local dev never touches production data: words you generate go into the local Redis. `npm run db:down` stops everything, and the data stays in a Docker volume.
