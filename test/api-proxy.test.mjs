import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { gzipSync } from 'node:zlib';
import { GET, POST } from '../app/api/[[...path]]/route.ts';

test('API proxy preserves Function routing, raw webhook bytes, query and authentication without caching', async t => {
  const original = process.env.API_UPSTREAM;
  let received;
  const upstream = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    received = { url: req.url, headers: req.headers, method: req.method, body: Buffer.concat(chunks) };
    res.writeHead(202, { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip', 'Cache-Control': 'public, max-age=999' });
    res.end(gzipSync('{"ok":true}'));
  });
  upstream.listen(0, '127.0.0.1');
  await once(upstream, 'listening');
  t.after(() => { upstream.closeAllConnections(); upstream.close(); if (original === undefined) delete process.env.API_UPSTREAM; else process.env.API_UPSTREAM = original; });
  process.env.API_UPSTREAM = `http://127.0.0.1:${upstream.address().port}/api`;
  const body = Buffer.from('{ "event": "transparent.completed", "unicode": "oração" }\n');
  const request = {
    nextUrl: new URL('https://app.example/api/webhooks/abacate?webhookSecret=test%2Bvalue'),
    method: 'POST',
    headers: new Headers({ authorization: 'Bearer test-token', 'x-session-id': 'session-id', 'content-type': 'application/json', 'x-forwarded-for': 'spoofed, 203.0.113.7' }),
    arrayBuffer: async () => body,
  };
  const response = await POST(request);
  assert.equal(received.url, '/api/api/webhooks/abacate?webhookSecret=test%2Bvalue');
  assert.equal(received.method, 'POST');
  assert.deepEqual(received.body, body);
  assert.equal(received.headers.authorization, 'Bearer test-token');
  assert.equal(received.headers['x-session-id'], 'session-id');
  assert.equal(received.headers['x-forwarded-for'], '203.0.113.7');
  assert.equal(response.status, 202);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('content-encoding'), null);
  assert.deepEqual(await response.json(), { ok: true });

  const get = await GET({ nextUrl: new URL('https://app.example/api/me?filter=active'), method: 'GET', headers: new Headers() });
  await get.text();
  assert.equal(received.url, '/api/api/me?filter=active');
  assert.equal(received.body.length, 0);

  upstream.closeAllConnections();
  await new Promise(resolve => upstream.close(resolve));
  const unavailable = await GET({ nextUrl: request.nextUrl, method: 'GET', headers: new Headers() });
  assert.equal(unavailable.status, 502);
  assert.equal(unavailable.headers.get('cache-control'), 'no-store');
});
