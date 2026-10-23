import { AppError, assert } from './core.js';

const BASE = 'https://api.abacatepay.com/v2';
const baseUrl = () => process.env.FUNCTIONS_EMULATOR === 'true' && process.env.ABACATE_API_BASE ? process.env.ABACATE_API_BASE : BASE;

async function gateway(path, key, options = {}) {
  assert(key, 503, 'Pagamentos ainda não foram configurados.');
  const response = await fetch(`${baseUrl()}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...options.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.success) throw new AppError(502, 'Não foi possível consultar o PIX. Tente novamente em instantes.');
  return body.data;
}

export async function createPixCharge({ amount, orderId, description, key }) {
  // AbacatePay rejects typographic dashes (e.g. U+2014) in PIX descriptions.
  const pixDescription = description.replace(/[\u2013\u2014]/g, '-');
  const charge = await gateway('/transparents/create', key, {
    method: 'POST',
    body: JSON.stringify({ method: 'PIX', data: { amount, expiresIn: 3600, description: pixDescription, externalId: orderId, metadata: { orderId } } }),
  });
  assert(charge?.id && charge?.brCode, 502, 'Cobrança PIX incompleta.');
  return {
    providerId: charge.id,
    pixCode: charge.brCode,
    qrCode: charge.brCodeBase64,
    expiresAt: Date.parse(charge.expiresAt) || Date.now() + 3600_000,
  };
}

export async function checkPixCharge(providerId, key) {
  const data = await gateway(`/transparents/check?id=${encodeURIComponent(providerId)}`, key);
  assert(data?.id === providerId, 502, 'Cobrança divergente.');
  return data.status;
}
