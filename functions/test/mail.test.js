import test from 'node:test';
import assert from 'node:assert/strict';
import { candleEndedEmail, candleLitEmail, emailTemplateForJob, sendServiceEmail } from '../src/mail.js';
import { nextCycle } from '../src/core.js';

test('activation template uses the actual cycle end in Brasilia for every plan', () => {
  for (const [plan, expectedDay] of [['free', 3], ['novena', 5], ['quaresma', 6]]) {
    const job = candleLitEmail({
      candleId: 'candle-123', publicBase: 'https://vela.example///',
      candle: {
        ownerEmail: 'creator@example.com', title: 'Pela minha família',
        currentCycle: nextCycle(plan, Date.parse('2026-10-28T01:30:00Z')),
      },
    });
    const month = plan === 'quaresma' ? 'dezembro' : 'novembro';
    assert.equal(job.kind, 'candle_lit');
    assert.equal(job.to, 'creator@example.com');
    assert.deepEqual(job.variables, {
      TITULO_VELA: 'Pela minha família',
      DATA_ENCERRAMENTO: `${expectedDay} de ${month} de 2026 às 22:30 (Brasília)`,
      URL_VELA: 'https://vela.example/v/candle-123',
      URL_MINHAS_VELAS: 'https://vela.example/minhas-velas',
      URL_SITE: 'https://vela.example',
    });
  }
});

const credentials = { key: 'test-key', from: 'Vela <vela@example.com>', to: 'creator@example.com', subject: 'Sua vela está acesa', idempotencyKey: 'created-candle-123' };

test('completed cycle email uses closed cycle dates and counts for every plan', () => {
  for (const [plan, days] of [['free', 7], ['novena', 9], ['quaresma', 40]]) {
    const cycle = nextCycle(plan, Date.parse('2026-10-28T01:30:00Z'));
    const candle = {
      ownerEmail: credentials.to, title: 'Minha intenção', prayerCount: 12, messageCount: 3,
      currentCycle: nextCycle('novena', cycle.endsAt),
    };
    const job = candleEndedEmail({ candleId: '123', candle, cycle, publicBase: 'https://vela.example///' });
    assert.equal(job.kind, 'candle_ended');
    assert.equal(job.to, credentials.to);
    assert.deepEqual(job.variables, {
      TITULO_VELA: candle.title, DURACAO_DIAS: days,
      DATA_ENCERRAMENTO: new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo', dateStyle: 'long', timeStyle: 'short',
      }).format(new Date(cycle.endsAt)) + ' (Brasília)',
      TOTAL_ORACOES: 12, TOTAL_MENSAGENS: 3,
      URL_VELA: 'https://vela.example/v/123',
      URL_MINHAS_VELAS: 'https://vela.example/minhas-velas', URL_SITE: 'https://vela.example',
    });
    const empty = candleEndedEmail({ candleId: '123', candle: { ...candle, prayerCount: undefined, messageCount: undefined }, cycle, publicBase: 'https://vela.example' });
    assert.equal(empty.variables.TOTAL_ORACOES, 0);
    assert.equal(empty.variables.TOTAL_MENSAGENS, 0);
  }
});

test('activation and completion select independent templates while legacy jobs keep plain text', () => {
  const env = { EMAIL_CANDLE_LIT_TEMPLATE_ID: 'vela-acesa-1', EMAIL_CANDLE_ENDED_TEMPLATE_ID: 'vela-concluda' };
  for (const [kind, id] of [['candle_lit', 'vela-acesa-1'], ['candle_ended', 'vela-concluda']]) {
    const variables = { TITULO_VELA: 'Minha intenção' };
    assert.deepEqual(emailTemplateForJob({ kind, variables }, env), { id, variables });
  }
  assert.equal(emailTemplateForJob({ text: 'Mensagem antiga' }, env), undefined);
  assert.throws(() => emailTemplateForJob({ kind: 'candle_ended' }, {}), /EMAIL_CANDLE_ENDED_TEMPLATE_ID/);
  assert.throws(() => emailTemplateForJob({ kind: 'candle_lit' }, {}), /EMAIL_CANDLE_LIT_TEMPLATE_ID/);
});

test('Resend receives the template and variables without text or HTML, preserving idempotency', async t => {
  const template = { id: 'vela-acesa', variables: { TITULO_VELA: 'Minha intenção' } };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    assert.equal(options.headers['Idempotency-Key'], credentials.idempotencyKey);
    assert.deepEqual(JSON.parse(options.body), {
      from: credentials.from, to: [credentials.to], subject: credentials.subject, template,
    });
    return Response.json({ id: 'email-123' });
  });
  await sendServiceEmail({ ...credentials, text: 'Must not be included', template });
});

test('legacy jobs and summaries still send plain text', async t => {
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.deepEqual(JSON.parse(options.body), {
      from: credentials.from, to: [credentials.to], subject: credentials.subject, text: 'Resumo de oração',
    });
    return Response.json({ id: 'email-123' });
  });
  await sendServiceEmail({ ...credentials, text: 'Resumo de oração' });
});

test('missing template configuration fails before contacting Resend', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected request'); });
  await assert.rejects(sendServiceEmail({ ...credentials, template: { variables: {} } }), /ID ou alias/);
  assert.equal(fetch.mock.callCount(), 0);
});

test('Resend errors propagate so the worker can retry the job', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'Template not published' }, { status: 422 }));
  await assert.rejects(sendServiceEmail({ ...credentials, template: { id: 'draft', variables: {} } }), /HTTP 422/);
});
