import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const projectId = 'demo-vela-virtual';
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099', 'Run only against the local Auth emulator.');
const charges = new Map();
const gateway = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:6060');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'POST' && url.pathname === '/v2/transparents/create') {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const payload = JSON.parse(raw);
    const id = `pix_char_${randomUUID().replaceAll('-', '')}`;
    const charge = { id, amount: payload.data.amount, status: 'PENDING', brCode: 'LOCAL_TEST_PIX', brCodeBase64: '', expiresAt: new Date(Date.now() + 3600_000).toISOString() };
    charges.set(id, charge); res.end(JSON.stringify({ success: true, data: charge, error: null })); return;
  }
  if (req.method === 'GET' && url.pathname === '/v2/transparents/check') {
    const charge = charges.get(url.searchParams.get('id'));
    res.end(JSON.stringify({ success: Boolean(charge), data: charge && { id: charge.id, status: charge.status }, error: null })); return;
  }
  res.statusCode = 404; res.end(JSON.stringify({ success: false, error: 'Unknown test route' }));
});
await new Promise(resolve => gateway.listen(6060, '127.0.0.1', resolve));
const app = initializeApp({ projectId });
const email = `smoke-${randomUUID()}@example.test`;
const password = `Test-${randomUUID()}`;
await getAuth(app).createUser({ email, password, emailVerified: true });
const login = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }),
});
assert.equal(login.status, 200, 'Emulator sign-in failed');
const { idToken } = await login.json();
const base = 'http://127.0.0.1:5050/api';
async function request(path, method = 'GET', body, authorized = true) {
  const response = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Session-Id': 'smoke-first-session', ...(authorized ? { Authorization: `Bearer ${idToken}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json() };
}

try {
  const denied = await request('/candles', 'POST', { plan: 'free', title: 'Sem conta', intention: 'Teste de acesso' }, false);
  assert.equal(denied.status, 401);
  const created = await request('/candles', 'POST', { plan: 'free', title: 'Pela paz da família', intention: 'Que encontremos serenidade e união.' });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const id = created.body.candle.id;
  assert.equal(created.body.candle.status, 'active');
  const visible = await request(`/v/${id}`, 'GET', undefined, false);
  assert.equal(visible.status, 200);
  assert.equal(visible.body.candle.intention, 'Que encontremos serenidade e união.');
  const browserId = randomUUID();
  const firstPrayer = await request(`/v/${id}/pray`, 'POST', { browserId }, false);
  const secondPrayer = await request(`/v/${id}/pray`, 'POST', { browserId }, false);
  assert.equal(firstPrayer.body.counted, true);
  assert.equal(secondPrayer.body.counted, false);
  const message = await request(`/v/${id}/messages`, 'POST', { browserId, name: 'Amiga', text: 'Estamos juntos em oração.' }, false);
  assert.equal(message.status, 201);
  const updated = await request(`/candles/${id}`, 'PATCH', { title: 'Pela nossa família', intention: 'Que encontremos paz e serenidade.' });
  assert.equal(updated.status, 200);
  const after = await request(`/v/${id}`, 'GET', undefined, false);
  assert.equal(after.body.candle.prayerCount, 1);
  assert.equal(after.body.candle.messages.length, 1);
  assert.equal(after.body.candle.title, 'Pela nossa família');
  const removed = await request(`/candles/${id}`, 'DELETE');
  assert.equal(removed.status, 200);
  const gone = await request(`/v/${id}`, 'GET', undefined, false);
  assert.equal(gone.status, 404);
  const paid = await request('/candles', 'POST', { plan: 'novena', title: 'Pela comunidade', intention: 'Que cresçamos em união e generosidade.', saintId: 'maria', theme: 'rose' });
  assert.equal(paid.status, 201, JSON.stringify(paid.body));
  const paidId = paid.body.candle.id;
  const order = paid.body.order;
  assert.equal(order.amount, 490);
  assert.equal((await request(`/v/${paidId}`, 'GET', undefined, false)).status, 404);
  charges.get(order.providerId).status = 'PAID';
  const webhookPath = '/webhooks/abacate?webhookSecret=local_webhook_secret';
  const event = { id: randomUUID(), event: 'transparent.completed', data: { id: order.providerId } };
  const webhook = await request(webhookPath, 'POST', event, false);
  assert.equal(webhook.status, 200, JSON.stringify(webhook.body));
  assert.equal((await request(webhookPath, 'POST', event, false)).status, 200);
  const active = await request(`/v/${paidId}`, 'GET', undefined, false);
  assert.equal(active.status, 200);
  assert.equal(active.body.candle.plan, 'novena');
  const next = await request(`/candles/${paidId}/renew`, 'POST', { plan: 'quaresma' });
  assert.equal(next.status, 201, JSON.stringify(next.body));
  charges.get(next.body.order.providerId).status = 'PAID';
  const renewalEvent = { id: randomUUID(), event: 'transparent.completed', data: { id: next.body.order.providerId } };
  assert.equal((await request(webhookPath, 'POST', renewalEvent, false)).status, 200);
  const owned = await request('/me/candles');
  const renewed = owned.body.candles.find(candle => candle.id === paidId);
  assert.equal(renewed.scheduledCycle.plan, 'quaresma');
  assert.equal(renewed.scheduledCycle.startsAt, active.body.candle.endsAt);
  process.stdout.write('Emulator smoke test passed: auth, free candle, public link, prayer, message, edit, delete, PIX webhook, and sequential renewal.\n');
} finally { await deleteApp(app); await new Promise(resolve => gateway.close(resolve)); }
