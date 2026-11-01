import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// Exercise the real HTTP handler and payment adapter without live Firebase or PIX.
const records = new Map();
function ref(path) {
  return {
    id: path.split('/').at(-1),
    get: async () => ({ exists: records.has(path), data: () => records.get(path) }),
    set: async data => { records.set(path, { ...data }); },
    update: async data => { assert.ok(records.has(path)); records.set(path, { ...records.get(path), ...data }); },
  };
}
const db = {
  collection: name => ({ doc: id => ref(`${name}/${id}`) }),
  runTransaction: async callback => callback({ get: target => target.get(), set: (target, data) => target.set(data), update: (target, data) => target.update(data) }),
  batch: () => {
    const writes = [];
    return { update: (target, data) => writes.push(() => target.update(data)), commit: async () => { for (const write of writes) await write(); } };
  },
};
globalThis.__donationTestDb = db;
const modules = {
  'firebase-admin/app': 'export function initializeApp() {}',
  'firebase-admin/auth': 'export function getAuth() { throw new Error("Unexpected auth request"); }',
  'firebase-admin/firestore': 'export function getFirestore() { return globalThis.__donationTestDb; } export const FieldValue = {};',
  'firebase-functions/v2/https': 'export function onRequest(options, handler) { return handler; }',
  'firebase-functions/v2/scheduler': 'export function onSchedule(options, handler) { return handler; }',
  'firebase-functions/params': 'export function defineSecret(name) { return { value: () => name === "ABACATE_WEBHOOK_SECRET" ? "test-webhook-secret" : "test-api-key" }; }',
  'firebase-functions': 'export const logger = { error: console.error };',
};
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier in modules) return { url: `donation-test:${specifier}`, shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith('donation-test:')) return { format: 'module', source: modules[url.slice('donation-test:'.length)], shortCircuit: true };
    return next(url, context);
  },
});
const { api } = await import('../src/index.js');
hooks.deregister();

async function request(path, method = 'GET', body) {
  let status;
  let payload;
  const url = new URL(`https://example.test/api${path}`);
  await api({ url: url.pathname + url.search, method, body, headers: {}, ip: '127.0.0.1', query: Object.fromEntries(url.searchParams) }, {
    status(code) { status = code; return this; },
    set() { return this; },
    json(data) { payload = data; },
  });
  return { status, body: payload };
}

test('public donation PIX validates amounts, protects owner orders, confirms once and handles expiry and refunds', async t => {
  records.clear();
  const charges = new Map();
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const target = new URL(url);
    assert.equal(target.origin, 'https://api.abacatepay.com');
    assert.equal(options.headers.Authorization, 'Bearer test-api-key');
    if (target.pathname === '/v2/transparents/create') {
      const input = JSON.parse(options.body);
      assert.equal(input.method, 'PIX');
      const charge = { id: `pix_${charges.size}`, status: 'PENDING', brCode: `PIX_${input.data.amount}`, brCodeBase64: '', expiresAt: new Date(Date.now() + 3600000).toISOString() };
      charges.set(charge.id, charge);
      return Response.json({ success: true, data: charge });
    }
    assert.equal(target.pathname, '/v2/transparents/check');
    return Response.json({ success: true, data: charges.get(target.searchParams.get('id')) });
  });
  for (const amount of [199, 100001, 250.5, 'invalid']) {
    assert.equal((await request('/donations', 'POST', { amount })).status, 400);
  }
  assert.equal(charges.size, 0);
  const created = await request('/donations', 'POST', { amount: 1000 });
  assert.equal(created.status, 201);
  const { order } = created.body;
  assert.match(order.id, /^[A-Za-z0-9_-]{32}$/);
  assert.equal(order.amount, 1000);
  assert.equal(order.pixCode, 'PIX_1000');
  assert.equal(order.status, 'pending');
  assert.equal(order.candleId, null);
  for (const field of ['ownerId', 'ownerEmail', 'providerId']) assert.equal(field in order, false);
  const path = `/donations/${order.id}`;
  assert.equal((await request(`${path}/reconcile`, 'POST')).body.order.status, 'pending');
  charges.get('pix_0').status = 'PAID';
  assert.equal((await request(`${path}/reconcile`, 'POST')).body.order.status, 'paid');
  const paidAt = records.get(`orders/${order.id}`).paidAt;
  assert.ok(paidAt);
  const event = { id: 'event-1', event: 'transparent.completed', data: { id: 'pix_0' } };
  const webhook = '/webhooks/abacate?webhookSecret=test-webhook-secret';
  for (let i = 0; i < 2; i++) assert.equal((await request(webhook, 'POST', event)).status, 200);
  assert.equal(records.get(`orders/${order.id}`).paidAt, paidAt);
  assert.equal((await request(path)).body.order.status, 'paid');
  assert.equal((await request('/webhooks/abacate?webhookSecret=wrong', 'POST', event)).status, 401);
  assert.equal([...records.keys()].some(key => key.startsWith('candles/')), false);
  assert.equal([...records.keys()].some(key => key.startsWith('emailJobs/')), false);

  const privateId = 'x'.repeat(32);
  records.set(`orders/${privateId}`, { type: 'candle', ownerId: 'owner', ownerEmail: 'private@example.test' });
  assert.equal((await request(`/donations/${privateId}`)).status, 404);
  assert.equal((await request(`/donations/${privateId}/reconcile`, 'POST')).status, 404);

  const second = await request('/donations', 'POST', { amount: 200 });
  const secondPath = `/donations/${second.body.order.id}`;
  charges.get('pix_1').status = 'EXPIRED';
  assert.equal((await request(`${secondPath}/reconcile`, 'POST')).body.order.status, 'expired');
  charges.get('pix_1').status = 'PAID';
  assert.equal((await request(webhook, 'POST', { ...event, data: { id: 'pix_1' } })).status, 200);
  assert.equal((await request(secondPath)).body.order.status, 'paid');
  assert.equal((await request(webhook, 'POST', { ...event, event: 'transparent.refunded', data: { id: 'pix_1' } })).status, 200);
  assert.equal((await request(`${secondPath}/reconcile`, 'POST')).body.order.status, 'refunded');
});
