import type { Candle, Order, PlanId } from './types';

const CANDLES = 'vela-demo-candles';
const ORDERS = 'vela-demo-orders';
const BROWSER = 'vela-browser-id';
const DAYS: Record<PlanId, number> = { free: 7, novena: 9, quaresma: 40 };
const AMOUNTS: Record<PlanId, number> = { free: 0, novena: 490, quaresma: 1290 };
const seed: Candle = {
  id: 'exemplo-de-vela-virtual-2026-10-20', title: 'Pela saúde da dona Helena',
  intention: 'Que ela encontre força, cuidado e serenidade em cada dia. Nossa família agradece a quem se une a esta oração.',
  plan: 'novena', saintId: 'maria', theme: 'rose', status: 'active', startsAt: Date.now(),
  endsAt: Date.now() + 9 * 86400_000, cycleId: 'demo-cycle', prayerCount: 24,
  messages: [{ id: 'demo-message', name: 'Mariana', text: 'Estamos com vocês em oração. ❤️', createdAt: Date.now() - 7200_000 }],
  createdAt: Date.now() - 86400_000,
};

function list<T>(key: string, fallback: T[]): T[] {
  try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; } catch { return fallback; }
}
function put<T>(key: string, value: T[]) { localStorage.setItem(key, JSON.stringify(value)); }
function candles() { return list<Candle>(CANDLES, [seed]); }
function orders() { return list<Order>(ORDERS, []); }
function id() { return crypto.randomUUID().replaceAll('-', '') + 'abcd'; }
function browserId() {
  const existing = localStorage.getItem(BROWSER);
  if (existing) return existing;
  const created = crypto.randomUUID(); localStorage.setItem(BROWSER, created); return created;
}
const error = (message: string): never => { throw new Error(message); };

export function demoRequest(path: string, method: string, body: Record<string, unknown> = {}): unknown {
  if (path === '/catalog') return { plans: {
    free: { label: 'Vela de intenção', days: 7, amount: 0 },
    novena: { label: 'Novena', days: 9, amount: 490 },
    quaresma: { label: 'Quaresma / Graça', days: 40, amount: 1290 },
  }, saints: [{ id: 'maria', name: 'Nossa Senhora' }, { id: 'jose', name: 'São José' }, { id: 'francisco', name: 'São Francisco de Assis' }, { id: 'terezinha', name: 'Santa Teresinha' }] };
  if (path === '/me' && method === 'GET') return { email: 'criador@exemplo.com', dailySummary: localStorage.getItem('vela-demo-daily') === 'true', admin: true };
  if (path === '/me' && method === 'PATCH') { localStorage.setItem('vela-demo-daily', String(body.dailySummary)); return { dailySummary: body.dailySummary }; }
  if (path === '/me/candles') return { candles: candles().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)) };
  if (path === '/candles' && method === 'POST') {
    const plan = body.plan as PlanId;
    const created: Candle = { id: id(), title: String(body.title), intention: String(body.intention), plan,
      saintId: plan === 'free' ? null : String(body.saintId), theme: plan === 'free' ? 'classic' : String(body.theme || 'classic'),
      status: plan === 'free' ? 'active' : 'pending_payment', startsAt: plan === 'free' ? Date.now() : null,
      endsAt: plan === 'free' ? Date.now() + 7 * 86400_000 : null, cycleId: plan === 'free' ? id() : null,
      prayerCount: 0, messages: [], createdAt: Date.now() };
    put(CANDLES, [created, ...candles()]);
    if (plan === 'free') return { candle: created };
    const order = newOrder(created.id, 'candle', plan, AMOUNTS[plan]);
    return { candle: created, order };
  }
  const publicMatch = path.match(/^\/v\/([^/]+)$/);
  if (publicMatch && method === 'GET') {
    const candle = candles().find(c => c.id === publicMatch[1] && c.status !== 'deleted');
    return candle ? { candle } : error('Vela não encontrada.');
  }
  const publicAction = path.match(/^\/v\/([^/]+)\/(pray|messages|reports)$/);
  if (publicAction && method === 'POST') {
    const all = candles(); const candle = all.find(c => c.id === publicAction[1]);
    if (!candle || candle.status !== 'active') return error('Esta vela não recebe novas interações.');
    if (publicAction[2] === 'pray') {
      const key = `vela-prayed-${candle.id}-${candle.cycleId}-${browserId()}`;
      const counted = !localStorage.getItem(key);
      if (counted) { localStorage.setItem(key, 'true'); candle.prayerCount += 1; put(CANDLES, all); }
      return { counted };
    }
    if (publicAction[2] === 'messages') { candle.messages.push({ id: id(), name: String(body.name || 'Alguém que rezou'), text: String(body.text), createdAt: Date.now() }); put(CANDLES, all); return { message: 'Mensagem publicada.' }; }
    return { ok: true };
  }
  const orderMatch = path.match(/^\/me\/orders\/([^/]+)(\/reconcile)?$/);
  if (orderMatch) {
    const all = orders(); const order = all.find(o => o.id === orderMatch[1]);
    if (!order) return error('Pedido não encontrado.');
    if (orderMatch[2] && method === 'POST') {
      order.status = 'paid'; put(ORDERS, all);
      const allCandles = candles(); const candle = allCandles.find(c => c.id === order.candleId);
      if (candle && order.type !== 'donation') {
        if (order.type === 'renewal') candle.scheduledCycle = { plan: order.plan!, startsAt: candle.endsAt || Date.now() };
        else { candle.status = 'active'; candle.startsAt = Date.now(); candle.endsAt = Date.now() + DAYS[order.plan!] * 86400_000; candle.cycleId = id(); }
        put(CANDLES, allCandles);
      }
      return { status: 'paid', order };
    }
    return { order };
  }
  const ownerAction = path.match(/^\/candles\/([^/]+)(?:\/(renew|donate|share))?$/);
  if (ownerAction) {
    const all = candles(); const candle = all.find(c => c.id === ownerAction[1]);
    if (!candle) return error('Vela não encontrada.');
    if (method === 'DELETE') { candle.status = 'deleted'; put(CANDLES, all); return { ok: true }; }
    if (method === 'PATCH') { candle.title = String(body.title); candle.intention = String(body.intention); candle.editedAt = Date.now(); put(CANDLES, all); return { ok: true }; }
    if (ownerAction[2] === 'share') return { ok: true };
    if (ownerAction[2] === 'renew') return { order: newOrder(candle.id, 'renewal', body.plan as PlanId, AMOUNTS[body.plan as PlanId]) };
    if (ownerAction[2] === 'donate') return { order: newOrder(candle.id, 'donation', null, Number(body.amount)) };
  }
  if (path === '/admin/queue') return { candles: [], reports: [], messages: [], paymentCases: [] };
  return error('Ação indisponível na prévia local.');
}

function newOrder(candleId: string, type: Order['type'], plan: PlanId | null, amount: number): Order {
  const order: Order = { id: id(), candleId, type, plan, amount, status: 'pending', pixCode: 'PIX-DEMONSTRACAO-SEM-COBRANCA', expiresAt: Date.now() + 3600_000 };
  put(ORDERS, [order, ...orders()]); return order;
}
