// Word storage on Redis.
//   word:<id>      JSON of the word (id is the creation timestamp in ms)
//   words          list of word keys, newest first
//   slug:<slug>    word key for a lowercased word, for /word/<slug> lookups
//   rating:<id>    hash { sum, count }
//   votes:<id>     hash { <voter hash>: stars }, one vote per voter
//   top            sorted set of ids by weighted rating
import { createHash } from 'node:crypto';
import { kv, pipeline, parseStored } from './kv.js';

const keyOf = id => `word:${id}`;
const idOf = key => key.slice('word:'.length);
export const slugOf = text => text.trim().toLowerCase();

// Weighted rating: every word starts as if it had PRIOR_VOTES votes of PRIOR_MEAN,
// so one 5-star vote can't outrank a word with many 4.5s.
const PRIOR_VOTES = 5;
const PRIOR_MEAN = 3;

const RATE_SCRIPT = `
local old = redis.call('HGET', KEYS[1], ARGV[1])
redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
local stars = tonumber(ARGV[2])
if old then
  redis.call('HINCRBY', KEYS[2], 'sum', stars - tonumber(old))
else
  redis.call('HINCRBY', KEYS[2], 'sum', stars)
  redis.call('HINCRBY', KEYS[2], 'count', 1)
end
local sum = tonumber(redis.call('HGET', KEYS[2], 'sum'))
local count = tonumber(redis.call('HGET', KEYS[2], 'count'))
local priorVotes = tonumber(ARGV[4])
local score = (priorVotes * tonumber(ARGV[5]) + sum) / (priorVotes + count)
redis.call('ZADD', KEYS[3], tostring(score), ARGV[3])
return { sum, count }`;

function toRating(sum, count) {
  sum = Number(sum) || 0;
  count = Number(count) || 0;
  return { avg: count ? Math.round((sum / count) * 10) / 10 : 0, count };
}

function safeParse(value) {
  if (!value) return null;
  try {
    return parseStored(value);
  } catch {
    return null;
  }
}

// Loads words and their ratings for a list of keys in one round trip.
async function hydrate(keys) {
  if (!keys.length) return [];
  const [values, ...ratings] = await pipeline([
    ['mget', ...keys],
    ...keys.map(key => ['hmget', `rating:${idOf(key)}`, 'sum', 'count'])
  ]);
  return keys
    .map((key, i) => {
      const word = safeParse(values[i]);
      if (!word?.word) return null;
      return { ...word, id: idOf(key), rating: toRating(...ratings[i]) };
    })
    .filter(Boolean);
}

export async function saveWord(word) {
  const id = String(Date.now());
  await pipeline([
    ['set', keyOf(id), JSON.stringify(word)],
    ['lpush', 'words', keyOf(id)],
    ['set', `slug:${slugOf(word.word)}`, keyOf(id)]
  ]);
  return id;
}

export async function listNewest(offset, limit) {
  const keys = await kv('lrange', 'words', offset, offset + limit - 1);
  return { words: await hydrate(keys), nextOffset: keys.length === limit ? offset + limit : null };
}

export async function listTop(offset, limit) {
  const ids = await kv('zrevrange', 'top', offset, offset + limit - 1);
  return { words: await hydrate(ids.map(keyOf)), nextOffset: ids.length === limit ? offset + limit : null };
}

export async function findBySlug(slug) {
  const target = slugOf(slug);
  const indexed = await kv('get', `slug:${target}`);
  if (indexed) {
    const [word] = await hydrate([indexed]);
    if (word) return word;
  }

  // Words saved before the slug index existed: scan newest-first in chunks and
  // index the match so the next lookup is a single GET.
  const keys = await kv('lrange', 'words', 0, -1);
  for (let i = 0; i < keys.length; i += 100) {
    const chunk = keys.slice(i, i + 100);
    const values = await kv('mget', ...chunk);
    const match = values.findIndex(value => {
      const word = safeParse(value);
      return word?.word && slugOf(word.word) === target;
    });
    if (match >= 0) {
      await kv('set', `slug:${target}`, chunk[match]);
      return (await hydrate([chunk[match]]))[0] || null;
    }
  }
  return null;
}

export async function wordExists(id) {
  return (await kv('exists', keyOf(id))) === 1;
}

export async function rate(id, stars, voter) {
  const [sum, count] = await kv(
    'eval', RATE_SCRIPT, 3,
    `votes:${id}`, `rating:${id}`, 'top',
    voter, String(stars), id, String(PRIOR_VOTES), String(PRIOR_MEAN)
  );
  return toRating(sum, count);
}

// One vote per IP per word. Only a salted hash of the IP is stored.
export function voterId(req) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.socket?.remoteAddress
    || 'unknown';
  const salt = process.env.RATING_SALT || process.env.KV_REST_API_TOKEN || '';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}
