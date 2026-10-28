import { PLANS } from './core.js';

export function candleLitEmail({ candleId, candle, publicBase }) {
  const base = publicBase.replace(/\/+$/, '');
  const endsAt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', dateStyle: 'long', timeStyle: 'short',
  }).format(new Date(candle.currentCycle.endsAt));
  return {
    kind: 'candle_lit',
    to: candle.ownerEmail,
    subject: 'Sua vela está acesa 🕯️',
    variables: {
      TITULO_VELA: candle.title,
      DATA_ENCERRAMENTO: `${endsAt} (Brasília)`,
      URL_VELA: `${base}/v/${candleId}`,
      URL_MINHAS_VELAS: `${base}/minhas-velas`,
      URL_SITE: base,
    },
  };
}

export function candleEndedEmail({ candleId, candle, cycle, publicBase }) {
  const base = publicBase.replace(/\/+$/, '');
  const endsAt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', dateStyle: 'long', timeStyle: 'short',
  }).format(new Date(cycle.endsAt));
  return {
    kind: 'candle_ended',
    to: candle.ownerEmail,
    subject: 'Seu ciclo de oração foi concluído 🕯️',
    variables: {
      TITULO_VELA: candle.title,
      DURACAO_DIAS: PLANS[cycle.plan].days,
      DATA_ENCERRAMENTO: `${endsAt} (Brasília)`,
      TOTAL_ORACOES: candle.prayerCount || 0,
      TOTAL_MENSAGENS: candle.messageCount || 0,
      URL_VELA: `${base}/v/${candleId}`,
      URL_MINHAS_VELAS: `${base}/minhas-velas`,
      URL_SITE: base,
    },
  };
}

export function emailTemplateForJob(job, env = process.env) {
  const setting = {
    candle_lit: 'EMAIL_CANDLE_LIT_TEMPLATE_ID',
    candle_ended: 'EMAIL_CANDLE_ENDED_TEMPLATE_ID',
  }[job.kind];
  if (!setting) return undefined;
  if (!env[setting]) throw new Error(`Configure ${setting} com o ID ou alias do template publicado no Resend.`);
  return { id: env[setting], variables: job.variables };
}

export async function sendServiceEmail({ key, from, to, subject, text, template, idempotencyKey }) {
  if (!key || !from) throw new Error('Envio de e-mail não configurado.');
  if (template && !template.id) throw new Error('Informe o ID ou alias do template publicado no Resend.');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ from, to: [to], subject, ...(template ? { template } : { text }) }),
  });
  if (!response.ok) throw new Error(`Falha no envio de e-mail: HTTP ${response.status}`);
}
