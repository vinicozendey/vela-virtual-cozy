import test from 'node:test';
import assert from 'node:assert/strict';
import { DAY, PLANS, prayerId, nextCycle, reviewReason, validateCandle, validateDonationAmount } from '../src/core.js';

test('three plans have agreed price and duration', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(PLANS).map(([id, plan]) => [id, [plan.days, plan.amount]])), {
    free: [7, 0], novena: [9, 490], quaresma: [40, 1290],
  });
});

test('free candle ignores paid decoration and rejects empty intention', () => {
  const candle = validateCandle({ plan: 'free', title: 'Por minha família', intention: 'Pela saúde de todos', saintId: 'jose', theme: 'blue' });
  assert.equal(candle.saintId, null);
  assert.equal(candle.theme, 'classic');
  assert.throws(() => validateCandle({ plan: 'free', title: 'X', intention: 'Oi' }));
});

test('paid candles accept every saint offered in the creation form', () => {
  const saintIds = ['maria', 'jose', 'francisco', 'terezinha', 'rita_cassia', 'antonio', 'aparecida', 'guadalupe', 'judas_tadeu', 'jorge', 'padre_pio', 'acutis'];
  for (const plan of ['novena', 'quaresma']) {
    for (const saintId of saintIds) {
      const candle = validateCandle({ plan, title: 'Por minha família', intention: 'Pela saúde de todos', saintId, theme: 'rose' });
      assert.equal(candle.saintId, saintId);
    }
    for (const saintId of ['', 'desconhecido']) {
      assert.throws(
        () => validateCandle({ plan, title: 'Por minha família', intention: 'Pela saúde de todos', saintId }),
        error => error.status === 400 && error.message === 'Escolha um santo.',
      );
    }
  }
});

test('renewed cycle begins at provided boundary with no lost days', () => {
  const start = Date.UTC(2026, 9, 20);
  const cycle = nextCycle('novena', start);
  assert.equal(cycle.startsAt, start);
  assert.equal(cycle.endsAt, start + 9 * DAY);
});

test('prayer key is stable within a cycle and differs in next cycle', () => {
  const browser = '5b0ea68c-56fd-41e7-9769-b85407723ca4';
  assert.equal(prayerId('one', browser), prayerId('one', browser));
  assert.notEqual(prayerId('one', browser), prayerId('two', browser));
});

test('content filter and donation limits', () => {
  assert.equal(reviewReason('Rezem por minha família'), null);
  assert.ok(reviewReason('Visite https://example.com'));
  assert.equal(validateDonationAmount(200), 200);
  assert.throws(() => validateDonationAmount(199));
});
