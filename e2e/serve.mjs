// Static server for the E2E fixture pages. Fixtures are served over http://
// rather than file:// because extensions need an explicit opt-in for file URLs.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

const PORT = Number(process.env.E2E_PORT ?? 5599);
const root = path.join(import.meta.dirname, 'fixtures');

const TYPES = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript' };

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    if (url.pathname === '/api/data.json') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, items: [1, 2, 3] }));
      return;
    }

    // A response body well past the get_network_request cap (20K chars).
    if (url.pathname === '/api/large.json') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, blob: 'Z'.repeat(40_000) }));
      return;
    }

    const name = url.pathname === '/' ? '/page.html' : url.pathname;
    try {
      const body = await fs.readFile(path.join(root, path.normalize(name).replace(/^(\.\.[/\\])+/, '')));
      res.writeHead(200, { 'content-type': TYPES[path.extname(name)] ?? 'text/plain' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  })
  .listen(PORT, () => console.log(`e2e fixtures on http://localhost:${PORT}`));
