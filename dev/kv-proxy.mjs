// Translates Upstash path-style REST calls (GET /set/key/value) into the
// POST-body form ["set", "key", "value"] that serverless-redis-http accepts.
import http from 'node:http';

const upstream = process.env.UPSTREAM_URL;

http.createServer(async (req, res) => {
  const command = new URL(req.url, 'http://x').pathname
    .split('/')
    .filter(Boolean)
    .map(decodeURIComponent);

  try {
    const r = await fetch(upstream, {
      method: 'POST',
      headers: { Authorization: req.headers.authorization || '', 'Content-Type': 'application/json' },
      body: JSON.stringify(command)
    });
    res.writeHead(r.status, { 'Content-Type': 'application/json' });
    res.end(await r.text());
  } catch (e) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
}).listen(80);
