# germanwordmaker

Describe a concept and get a new German compound word for it, with audio, saved to a public gallery. Live at <https://www.germanwordmaker.com>.

Static `index.html` / `word.html` plus Vercel serverless functions in `api/`. Words come from Claude, audio from ElevenLabs, and storage is Upstash Redis.

## Deploys

Every push to `main` deploys to production on Vercel. Work on a branch.

## Local development

Needs Node 20+, Docker, and the Vercel CLI (`npm i -g vercel`). No API keys needed.

```sh
cp .env.example .env
npm run db:up            # local Redis (:8079) + mock Anthropic/ElevenLabs (:8081)
npm run db:seed          # optional: copy the live gallery into local Redis
vercel dev               # http://localhost:3000
```

The first `vercel dev` asks you to log in and link a project. Link it to a new project in your own account, not the production one. Linking deploys nothing.

By default, Anthropic and ElevenLabs are mocked by `dev/mock-ai.mjs`. It returns canned words from `dev/mock-words.json` and a short chime for audio. Put a keyword in the concept to get a specific case:

| Concept contains | You get |
| --- | --- |
| `long` | a 71-letter word with 7 parts and long text (layout stress test) |
| `refusal` | an `isRefusal` word, which is shown but not saved to the gallery |
| `error` | an unparseable reply, which shows the error message |
| anything else | a random normal word |

To use the real APIs, remove the `*_BASE_URL` lines from `.env` and add your own keys.

Local dev never touches production data: words you generate go into the local Redis. `npm run db:down` stops everything, and the data stays in a Docker volume.
