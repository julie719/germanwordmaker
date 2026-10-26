// Minimal Upstash REST client. Uses the JSON-body form (POST / and POST /pipeline),
// which, unlike path-style URLs, is safe for values containing any characters.

async function request(path, body) {
  const res = await fetch(`${process.env.KV_REST_API_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(`KV ${body[0]}: ${data.error || res.status}`);
  return data;
}

export async function kv(...command) {
  return (await request('', command)).result;
}

export async function pipeline(commands) {
  if (!commands.length) return [];
  const results = await request('/pipeline', commands);
  return results.map(r => {
    if (r.error) throw new Error(`KV pipeline: ${r.error}`);
    return r.result;
  });
}

// Older words were written URL-encoded into a path-style URL, so depending on
// how Upstash decoded that they may be stored raw or still encoded. Newer words
// are always raw JSON. Accept both.
export function parseStored(value) {
  try {
    return JSON.parse(value);
  } catch {
    return JSON.parse(decodeURIComponent(value));
  }
}
