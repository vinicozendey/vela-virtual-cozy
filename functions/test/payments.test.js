import test from 'node:test';
import assert from 'node:assert/strict';
import { createPixCharge } from '../src/payments.js';

test('PIX descriptions normalize typographic dashes before calling AbacatePay', async t => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const payload = JSON.parse(options.body);
    requests.push(payload);
    // Replays the provider rejection observed with the application's description.
    if (/[\u2013\u2014]/u.test(payload.data.description)) {
      return Response.json({ success: false, error: 'Disallowed character in description: "—" (U+2014). Replace it with "-".' }, { status: 400 });
    }
    return Response.json({ success: true, error: null, data: {
      id: 'pix_test', brCode: 'PIX-CODE-TEST', brCodeBase64: 'data:image/png;base64,test',
      expiresAt: '2026-10-23T14:00:00.000Z',
    } });
  });

  for (const description of ['Vela Virtual — Novena', 'Vela Virtual – Quaresma / Graça', 'Doação para manutenção da Vela Virtual']) {
    const charge = await createPixCharge({ amount: 490, orderId: 'test-order', description, key: 'test-key' });
    assert.equal(charge.pixCode, 'PIX-CODE-TEST');
    assert.equal(charge.qrCode, 'data:image/png;base64,test');
  }
  assert.deepEqual(requests.map(request => request.data.description), [
    'Vela Virtual - Novena', 'Vela Virtual - Quaresma / Graça', 'Doação para manutenção da Vela Virtual',
  ]);
});
