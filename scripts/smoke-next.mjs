// Run after npm run build. Uses a local upstream; never calls production APIs.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';

const upstream = createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' });
  res.end(JSON.stringify({ path: req.url, method: req.method, authorization: req.headers.authorization, body: Buffer.concat(chunks).toString() }));
});
upstream.listen(0, '127.0.0.1');
await once(upstream, 'listening');
const probe = createServer();
probe.listen(0, '127.0.0.1');
await once(probe, 'listening');
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
  cwd: new URL('..', import.meta.url),
  env: { ...process.env, API_UPSTREAM: `http://127.0.0.1:${upstream.address().port}/api` },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const exited = once(app, 'exit');
let output = '';
app.stdout.on('data', chunk => { output += chunk; });
app.stderr.on('data', chunk => { output += chunk; });
const base = `http://127.0.0.1:${port}`;
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (app.exitCode !== null) throw new Error(output);
    try { ready = (await fetch(base)).ok; } catch { /* Wait for startup. */ }
    if (ready) break;
    await delay(100);
  }
  assert.ok(ready, `Next.js did not start. ${output}`);
  for (const path of ['/', '/sobre', '/entrar?next=%2Fcriar%3Fplan%3Dnovena', '/criar?plan=novena', '/minhas-velas', '/moderacao', '/pagamento/test-order', '/v/test-candle']) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.match(html, /lang="pt-BR"/, path);
    assert.equal((html.match(/<title>/g) || []).length, 1, `Exactly one title on ${path}`);
    if (path === '/') assert.match(html, /Uma intenção/);
    if (path.startsWith('/v/')) {
      assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
      assert.match(html, /noindex/);
    }
  }
  assert.equal((await fetch(base + '/missing-page')).status, 404);
  const raw = '{ "event": "transparent.completed" }\n';
  const response = await fetch(base + '/api/webhooks/abacate?webhookSecret=local%2Btest', {
    method: 'POST', headers: { Authorization: 'Bearer local-test', 'Content-Type': 'application/json' }, body: raw,
  });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), {
    path: '/api/api/webhooks/abacate?webhookSecret=local%2Btest', method: 'POST', authorization: 'Bearer local-test', body: raw,
  });
  console.log('Next.js smoke passed: 8 routes, 404, candle privacy headers, and API/webhook forwarding.');
} finally {
  app.kill('SIGTERM');
  await exited;
  upstream.closeAllConnections();
  await new Promise(resolve => upstream.close(resolve));
}
