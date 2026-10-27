import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const DAY = 24 * 60 * 60 * 1000;
export const PLANS = Object.freeze({
  free: { label: 'Vela de intenção', days: 7, amount: 0 },
  novena: { label: 'Novena', days: 9, amount: 490 },
  quaresma: { label: 'Quaresma / Graça', days: 40, amount: 1290 },
});

export const SAINTS = Object.freeze([
  { id: 'maria', name: 'Nossa Senhora' }, { id: 'jose', name: 'São José' },
  { id: 'francisco', name: 'São Francisco de Assis' }, { id: 'terezinha', name: 'Santa Teresinha' },
  { id: 'rita_cassia', name: 'Santa Rita de Cássia' }, { id: 'antonio', name: 'Santo Antônio' },
  { id: 'aparecida', name: 'Nossa Senhora Aparecida' }, { id: 'guadalupe', name: 'Nossa Senhora de Guadalupe' },
  { id: 'judas_tadeu', name: 'São Judas Tadeu' }, { id: 'jorge', name: 'São Jorge' },
  { id: 'padre_pio', name: 'Padre Pio' }, { id: 'acutis', name: 'São Carlo Acutis' },
]);

export class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function assert(condition, status, message) {
  if (!condition) throw new AppError(status, message);
}

export function cleanText(value, max, label) {
  assert(typeof value === 'string', 400, `${label} é obrigatório.`);
  const result = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  assert(result.length >= 3 && result.length <= max, 400, `${label} deve ter entre 3 e ${max} caracteres.`);
  return result;
}

export function reviewReason(text) {
  if (/https?:\/\/|www\.|@\w+\.|\b\d{3}[ .-]?\d{3}[ .-]?\d{3,4}\b/i.test(text)) return 'Possível dado de contato ou link';
  if (/\b(?:matar|suicid|violentar|ameaçar|ameaça)\b/i.test(text)) return 'Possível conteúdo sensível';
  return null;
}

export function validateCandle(input) {
  assert(input && typeof input === 'object', 400, 'Dados inválidos.');
  const plan = String(input.plan || '');
  assert(Boolean(PLANS[plan]), 400, 'Plano inválido.');
  const title = cleanText(input.title, 80, 'Título');
  const intention = cleanText(input.intention, 500, 'Intenção');
  const saintId = plan === 'free' ? null : String(input.saintId || '');
  if (plan !== 'free') assert(SAINTS.some(saint => saint.id === saintId), 400, 'Escolha um santo.');
  const theme = plan === 'free' ? 'classic' : ['classic', 'rose', 'blue'].includes(input.theme) ? input.theme : 'classic';
  return { plan, title, intention, saintId, theme, reviewReason: reviewReason(`${title} ${intention}`) };
}

export function validateDonationAmount(value) {
  const amount = Number(value);
  assert(Number.isInteger(amount) && amount >= 200 && amount <= 100000, 400, 'Informe entre R$ 2,00 e R$ 1.000,00.');
  return amount;
}

export function newId() {
  return randomBytes(24).toString('base64url');
}

export function prayerId(cycleId, browserId) {
  assert(typeof browserId === 'string' && /^[a-f0-9-]{36}$/.test(browserId), 400, 'Identificador do navegador inválido.');
  return createHash('sha256').update(`${cycleId}:${browserId}`).digest('hex');
}

export function nextCycle(plan, startsAt) {
  assert(PLANS[plan], 400, 'Plano inválido.');
  return { id: newId(), plan, startsAt, endsAt: startsAt + PLANS[plan].days * DAY };
}

export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
