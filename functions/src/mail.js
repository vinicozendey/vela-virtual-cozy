export async function sendServiceEmail({ key, from, to, subject, text, idempotencyKey }) {
  if (!key || !from) throw new Error('Envio de e-mail não configurado.');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
  if (!response.ok) throw new Error(`Falha no envio de e-mail: HTTP ${response.status}`);
}
