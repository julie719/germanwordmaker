// Sits in front of serverless-redis-http. POST requests (Upstash's JSON-body
// form, e.g. POST / or POST /pipeline) pass straight through; path-style GETs
// (GET /set/key/value) are translated into the POST-body form ["set", "key", "value"].
import http from 'node:http';

const upstream = process.env.UPSTREAM_URL;

const readBody = req => new Promise(resolve => {
  let data = '';
  req.on('data', chunk => data += chunk);
  req.on('end', () => resolve(data));
});

http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://x');
  let target = upstream;
  let body;

  if (req.method === 'POST') {
    target = upstream + pathname;
    body = await readBody(req);
  } else {
    const command = pathname.split('/').filter(Boolean).map(decodeURIComponent);
    body = JSON.stringify(command);
  }

  try {
    const r = await fetch(target, {
      method: 'POST',
      headers: { Authorization: req.headers.authorization || '', 'Content-Type': 'application/json' },
      body
    });
    res.writeHead(r.status, { 'Content-Type': 'application/json' });
    res.end(await r.text());
  } catch (e) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
}).listen(80);
