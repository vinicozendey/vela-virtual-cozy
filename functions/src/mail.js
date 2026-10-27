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

export async function sendServiceEmail({ key, from, to, subject, text, template, idempotencyKey }) {
  if (!key || !from) throw new Error('Envio de e-mail não configurado.');
  if (template && !template.id) throw new Error('Configure EMAIL_CANDLE_LIT_TEMPLATE_ID com o ID ou alias do template publicado no Resend.');
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
