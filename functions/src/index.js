import { createHash } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { AppError, PLANS, SAINTS, assert, cleanText, newId, nextCycle, prayerId, reviewReason, safeEqual, validateCandle, validateDonationAmount } from './core.js';
import { checkPixCharge, createPixCharge } from './payments.js';
import { candleEndedEmail, candleLitEmail, emailTemplateForJob, sendServiceEmail } from './mail.js';

initializeApp();
const db = getFirestore();
const abacateKey = defineSecret('ABACATE_API_KEY');
const webhookSecret = defineSecret('ABACATE_WEBHOOK_SECRET');
const productEmailsEnabled = process.env.ENABLE_PRODUCT_EMAILS === 'true';
const emailKey = defineSecret('EMAIL_API_KEY');
const emailFrom = defineSecret('EMAIL_FROM');
const region = 'southamerica-east1';
const now = () => Date.now();
const publicBase = () => process.env.PUBLIC_BASE_URL || 'http://127.0.0.1:5173';

function send(res, status, data) {
  res.status(status).set('Cache-Control', 'no-store').json(data);
}

function bodyOf(req) {
  assert(req.body && typeof req.body === 'object' && !Array.isArray(req.body), 400, 'Corpo JSON inválido.');
  return req.body;
}

async function identity(req) {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  assert(token, 401, 'Entre com seu e-mail.');
  const user = await getAuth().verifyIdToken(token);
  assert(user.email && user.email_verified, 403, 'Verifique seu e-mail antes de continuar.');
  return user;
}

async function adminIdentity(req) {
  const user = await identity(req);
  assert(user.admin === true, 403, 'Acesso restrito à moderação.');
  return user;
}

function address(req) {
  return String(req.headers['x-forwarded-for'] || req.ip || 'unknown').split(',')[0].trim();
}

async function throttle(req, action, max) {
  const day = new Date().toISOString().slice(0, 10);
  const id = createHash('sha256').update(`${process.env.RATE_LIMIT_SALT || 'local'}:${address(req)}:${action}:${day}`).digest('hex');
  const ref = db.collection('rateLimits').doc(id);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const count = snap.exists ? snap.data().count : 0;
    assert(count < max, 429, 'Muitas tentativas. Tente novamente amanhã.');
    tx.set(ref, { count: count + 1, day, action, expiresAt: now() + 2 * 86400_000 });
  });
}

function publicCandle(id, candle, messages = []) {
  const effectiveStatus = candle.status === 'active' && candle.currentCycle?.endsAt <= now() && !candle.scheduledCycle ? 'ended' : candle.status;
  return {
    id, title: candle.title, intention: candle.intention, plan: candle.currentCycle?.plan || candle.plan,
    saintId: candle.saintId, theme: candle.theme, editedAt: candle.editedAt || null,
    status: effectiveStatus, startsAt: candle.currentCycle?.startsAt || null,
    endsAt: candle.currentCycle?.endsAt || null, cycleId: candle.currentCycle?.id || null,
    prayerCount: candle.prayerCount || 0, messageCount: candle.messageCount || 0, messages,
  };
}

function ownerCandle(id, candle) {
  return { ...publicCandle(id, candle), scheduledCycle: candle.scheduledCycle || null, lastCycleEndedAt: candle.lastCycleEndedAt || null, createdAt: candle.createdAt, reviewReason: candle.reviewReason || null };
}

async function ownCandle(id, uid) {
  const ref = db.collection('candles').doc(id);
  const snap = await ref.get();
  assert(snap.exists && snap.data().ownerId === uid && snap.data().status !== 'deleted', 404, 'Vela não encontrada.');
  return { ref, data: snap.data() };
}

async function queueEmail(id, data) {
  try { await db.collection('emailJobs').doc(id).create({ ...data, state: 'pending', createdAt: now(), attempts: 0 }); }
  catch (error) { if (error.code !== 6) throw error; }
}

async function createCandle(req, res) {
  const user = await identity(req);
  await throttle(req, 'create', 12);
  const input = validateCandle(bodyOf(req));
  const candleId = newId();
  const createdAt = now();
  const common = {
    ownerId: user.uid, ownerEmail: user.email, title: input.title, intention: input.intention,
    plan: input.plan, saintId: input.saintId, theme: input.theme, createdAt,
    status: input.reviewReason ? 'pending_review' : input.plan === 'free' ? 'active' : 'pending_payment',
    reviewReason: input.reviewReason, prayerCount: 0, totalPrayerCount: 0, messageCount: 0, scheduledCycle: null,
  };
  const creatorRef = db.collection('creators').doc(user.uid);
  const creator = await creatorRef.get();
  if (!creator.data()?.firstCandleAt) await creatorRef.set({ email: user.email, firstCandleAt: createdAt, firstSessionId: String(req.headers['x-session-id'] || ''), dailySummary: false }, { merge: true });
  if (input.plan === 'free') {
    const recent = await db.collection('candles').where('ownerId', '==', user.uid).get();
    const freeToday = recent.docs.filter(s => s.data().plan === 'free' && s.data().createdAt > createdAt - 86400_000).length;
    assert(freeToday < 3, 429, 'Você atingiu o limite diário de velas gratuitas.');
    common.currentCycle = input.reviewReason ? null : nextCycle('free', createdAt);
    common.nextExpirationAt = common.currentCycle?.endsAt || null;
    await db.collection('candles').doc(candleId).set(common);
    if (!input.reviewReason) await queueEmail(`created-${candleId}`, candleLitEmail({ candleId, candle: common, publicBase: publicBase() }));
    return send(res, 201, { candle: ownerCandle(candleId, common) });
  }
  if (input.reviewReason) {
    await db.collection('candles').doc(candleId).set({ ...common, currentCycle: null });
    return send(res, 201, { candle: ownerCandle(candleId, common), message: 'Sua intenção aguarda revisão. O pagamento será liberado depois.' });
  }
  const candleRef = db.collection('candles').doc(candleId);
  await candleRef.set({ ...common, currentCycle: null });
  const order = await openOrder({ ownerId: user.uid, ownerEmail: user.email, candleId, type: 'candle', plan: input.plan, amount: PLANS[input.plan].amount });
  return send(res, 201, { candle: ownerCandle(candleId, common), order });
}

async function openOrder({ ownerId, ownerEmail, candleId, type, plan = null, amount }) {
  if (type !== 'donation') {
    const prior = await db.collection('orders').where('candleId', '==', candleId).get();
    const reusable = prior.docs.find(s => s.data().type === type && s.data().plan === plan && s.data().status === 'pending');
    if (reusable) return { id: reusable.id, ...reusable.data() };
    const creating = prior.docs.find(s => s.data().type === type && s.data().status === 'creating' && s.data().createdAt > now() - 120_000);
    assert(!creating, 409, 'O PIX está sendo preparado. Aguarde um instante.');
  }
  const id = newId();
  const ref = db.collection('orders').doc(id);
  const initial = { ownerId, ownerEmail, candleId, type, plan, amount, status: 'creating', createdAt: now() };
  await ref.set(initial);
  try {
    const charge = await createPixCharge({ amount, orderId: id, description: type === 'donation' ? 'Doação para manutenção da Vela Virtual' : `Vela Virtual — ${PLANS[plan].label}`, key: abacateKey.value() });
    await ref.update({ ...charge, status: 'pending' });
    await db.collection('providerLinks').doc(charge.providerId).set({ orderId: id });
    return { id, ...initial, ...charge, status: 'pending' };
  } catch (error) {
    await ref.update({ status: 'failed', failureAt: now() });
    throw error;
  }
}

async function orderDetails(id, uid) {
  const snap = await db.collection('orders').doc(id).get();
  assert(snap.exists && snap.data().ownerId === uid, 404, 'Pedido não encontrado.');
  return { id, ...snap.data() };
}

async function finishOrder(orderId, eventId = null) {
  const ref = db.collection('orders').doc(orderId);
  const initial = await ref.get();
  assert(initial.exists, 404, 'Pedido não encontrado.');
  const order = initial.data();
  if (order.status === 'review_required') return 'review_required';
  assert(order.providerId, 409, 'Cobrança ainda não preparada.');
  const providerStatus = await checkPixCharge(order.providerId, abacateKey.value());
  if (providerStatus === 'EXPIRED') {
    if (order.status === 'pending') await ref.update({ status: 'expired' });
    return 'expired';
  }
  if (providerStatus !== 'PAID') return 'pending';
  let disposition = 'paid';
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const current = snap.data();
    if (current.status === 'paid') return;
    assert(['pending', 'expired'].includes(current.status), 409, 'Pedido em estado incompatível.');
    const candleRef = db.collection('candles').doc(current.candleId);
    const candleSnap = await tx.get(candleRef);
    assert(candleSnap.exists, 409, 'Vela do pedido não encontrada.');
    const candle = candleSnap.data();
    assert(candle.ownerId === current.ownerId, 409, 'Pedido não corresponde à vela.');
    const paidAt = now();
    const incompatible = candle.status === 'deleted' || candle.status === 'hidden' ||
      current.type === 'candle' && candle.status !== 'pending_payment' ||
      current.type === 'renewal' && (candle.plan === 'free' || candle.scheduledCycle || !['active', 'ended'].includes(candle.status));
    if (incompatible) {
      disposition = 'review_required';
      tx.update(ref, { status: 'review_required', paidAt, eventId, reviewReason: 'PIX confirmado sem possibilidade de ativação automática' });
      tx.create(db.collection('moderationCases').doc(orderId), { kind: 'payment', orderId, candleId: current.candleId, status: 'open', createdAt: paidAt });
      return;
    }
    if (current.type === 'candle') {
      const cycle = nextCycle(current.plan, paidAt);
      tx.update(candleRef, { status: 'active', currentCycle: cycle, nextExpirationAt: cycle.endsAt, activatedAt: paidAt });
      tx.create(db.collection('emailJobs').doc(`paid-${orderId}`), {
        ...candleLitEmail({ candleId: current.candleId, candle: { ...candle, currentCycle: cycle }, publicBase: publicBase() }),
        state: 'pending', createdAt: paidAt, attempts: 0,
      });
    } else if (current.type === 'renewal') {
      if (candle.status === 'active' && candle.currentCycle.endsAt <= paidAt) {
        const old = candle.currentCycle;
        tx.create(candleRef.collection('cycles').doc(old.id), { ...old, prayerCount: candle.prayerCount || 0, messageCount: candle.messageCount || 0, closedAt: paidAt });
        tx.create(db.collection('emailJobs').doc(`ended-${current.candleId}-${old.id}`), {
          ...candleEndedEmail({ candleId: current.candleId, candle, cycle: old, publicBase: publicBase() }),
          state: 'pending', createdAt: paidAt, attempts: 0,
        });
      }
      const start = Math.max(paidAt, candle.currentCycle.endsAt);
      if (start <= paidAt) {
        const cycle = nextCycle(current.plan, paidAt);
        tx.update(candleRef, { status: 'active', currentCycle: cycle, nextExpirationAt: cycle.endsAt, scheduledCycle: null, prayerCount: 0, messageCount: 0, lastCycleEndedAt: candle.currentCycle.endsAt });
      }
      else tx.update(candleRef, { scheduledCycle: nextCycle(current.plan, start) });
    } else assert(current.type === 'donation', 409, 'Tipo de pedido inválido.');
    tx.update(ref, { status: 'paid', paidAt, eventId });
  });
  if (disposition === 'paid' && order.type === 'renewal') await queueEmail(`paid-${orderId}`, { to: order.ownerEmail, subject: 'Seu PIX foi confirmado', text: `Sua vela está pronta para compartilhar: ${publicBase()}/v/${order.candleId}` });
  return disposition;
}

async function route(req, res) {
  const path = new URL(req.url, 'http://localhost').pathname.replace(/^\/api/, '');
  const method = req.method;
  if (method === 'GET' && path === '/catalog') return send(res, 200, { plans: PLANS, saints: SAINTS });
  if (method === 'POST' && path === '/webhooks/abacate') return handleWebhook(req, res);

  const publicMatch = path.match(/^\/v\/([A-Za-z0-9_-]{32})$/);
  if (method === 'GET' && publicMatch) {
    const snap = await db.collection('candles').doc(publicMatch[1]).get();
    assert(snap.exists && ['active', 'ended'].includes(snap.data().status), 404, 'Vela não encontrada.');
    const messages = await snap.ref.collection('messages').limit(100).get();
    return send(res, 200, { candle: publicCandle(snap.id, snap.data(), messages.docs.filter(s => s.data().status === 'published').map(s => ({ id: s.id, text: s.data().text, name: s.data().name, createdAt: s.data().createdAt })).sort((a, b) => a.createdAt - b.createdAt)) });
  }
  const actionMatch = path.match(/^\/v\/([A-Za-z0-9_-]{32})\/(pray|messages|reports)$/);
  if (method === 'POST' && actionMatch) return publicAction(req, res, actionMatch[1], actionMatch[2]);

  if (method === 'POST' && path === '/candles') return createCandle(req, res);
  if (method === 'GET' && path === '/me/candles') {
    const user = await identity(req);
    const snap = await db.collection('candles').where('ownerId', '==', user.uid).get();
    const profileRef = db.collection('creators').doc(user.uid);
    const profile = await profileRef.get();
    const sessionId = String(req.headers['x-session-id'] || '');
    const first = profile.data()?.firstCandleAt;
    const returned = first && now() <= first + 7 * 86400_000 && sessionId && sessionId !== profile.data()?.firstSessionId;
    await profileRef.set({ email: user.email, lastVisitAt: now(), ...(returned && !profile.data()?.returnedAt ? { returnedAt: now() } : {}) }, { merge: true });
    return send(res, 200, { candles: snap.docs.filter(s => s.data().status !== 'deleted').map(s => ownerCandle(s.id, s.data())).sort((a, b) => b.createdAt - a.createdAt) });
  }
  if (method === 'GET' && path === '/me') {
    const user = await identity(req);
    const profile = await db.collection('creators').doc(user.uid).get();
    return send(res, 200, { email: user.email, dailySummary: Boolean(profile.data()?.dailySummary), admin: user.admin === true });
  }
  if (method === 'PATCH' && path === '/me') {
    const user = await identity(req);
    const dailySummary = bodyOf(req).dailySummary;
    assert(typeof dailySummary === 'boolean', 400, 'Preferência inválida.');
    await db.collection('creators').doc(user.uid).set({ email: user.email, dailySummary }, { merge: true });
    return send(res, 200, { dailySummary });
  }
  const orderMatch = path.match(/^\/me\/orders\/([A-Za-z0-9_-]{32})(\/reconcile)?$/);
  if (orderMatch) {
    const user = await identity(req);
    const order = await orderDetails(orderMatch[1], user.uid);
    if (method === 'POST' && orderMatch[2]) {
      const status = await finishOrder(order.id);
      return send(res, 200, { status, order: await orderDetails(order.id, user.uid) });
    }
    if (method === 'GET' && !orderMatch[2]) return send(res, 200, { order });
  }
  const candleMatch = path.match(/^\/candles\/([A-Za-z0-9_-]{32})(?:\/(renew|donate|share|pay))?$/);
  if (candleMatch) return ownerAction(req, res, candleMatch[1], candleMatch[2]);
  if (path.startsWith('/admin/')) return adminAction(req, res, path);
  throw new AppError(404, 'Rota não encontrada.');
}

async function publicAction(req, res, id, action) {
  await throttle(req, action, action === 'pray' ? 30 : 10);
  const input = bodyOf(req);
  const ref = db.collection('candles').doc(id);
  const browserId = String(input.browserId || '');
  if (action === 'reports') {
    const target = await ref.get();
    assert(target.exists && ['active', 'ended'].includes(target.data().status), 404, 'Vela não encontrada.');
    const reason = cleanText(input.reason, 200, 'Motivo');
    const reportId = prayerId('report-' + id, browserId);
    await ref.collection('reports').doc(reportId).set({ reason, createdAt: now(), status: 'open' });
    return send(res, 201, { ok: true });
  }
  const snap = await ref.get();
  assert(snap.exists && snap.data().status === 'active' && snap.data().currentCycle?.endsAt > now(), 410, 'Esta vela não recebe novas interações.');
  const cycle = snap.data().currentCycle;
  const browserHash = prayerId(cycle.id, browserId);
  if (action === 'pray') {
    const prayerRef = ref.collection('prayers').doc(browserHash);
    let counted = false;
    await db.runTransaction(async tx => {
      const [latest, previous] = await Promise.all([tx.get(ref), tx.get(prayerRef)]);
      assert(latest.data()?.status === 'active' && latest.data().currentCycle?.id === cycle.id && latest.data().currentCycle.endsAt > now(), 410, 'Esta vela não recebe novas interações.');
      if (previous.exists) return;
      tx.create(prayerRef, { cycleId: cycle.id, createdAt: now() });
      tx.update(ref, { prayerCount: FieldValue.increment(1), totalPrayerCount: FieldValue.increment(1) });
      counted = true;
    });
    return send(res, 200, { counted });
  }
  const text = cleanText(input.text, 280, 'Mensagem');
  const name = cleanText(input.name || 'Alguém que rezou', 40, 'Nome');
  const reason = reviewReason(`${name} ${text}`);
  const messageRef = ref.collection('messages').doc(newId());
  await messageRef.set({ text, name, cycleId: cycle.id, browserHash, status: reason ? 'pending_review' : 'published', reviewReason: reason, createdAt: now() });
  if (!reason) await ref.update({ messageCount: FieldValue.increment(1) });
  return send(res, 201, { message: reason ? 'Mensagem enviada para revisão.' : 'Mensagem publicada.' });
}

async function ownerAction(req, res, id, action) {
  const user = await identity(req);
  const { ref, data } = await ownCandle(id, user.uid);
  if (req.method === 'PATCH' && !action) {
    assert(['active', 'ended', 'pending_review'].includes(data.status), 409, 'Esta vela não pode ser editada agora.');
    const title = cleanText(bodyOf(req).title, 80, 'Título');
    const intention = cleanText(req.body.intention, 500, 'Intenção');
    const reason = reviewReason(`${title} ${intention}`);
    await ref.update({ title, intention, editedAt: now(), ...(reason ? { status: 'pending_review', reviewReason: reason } : { reviewReason: null }) });
    return send(res, 200, { ok: true, review: Boolean(reason) });
  }
  if (req.method === 'DELETE' && !action) {
    await ref.update({ status: 'deleted', title: '', intention: '', deletedAt: now() });
    const messages = await ref.collection('messages').get();
    for (let index = 0; index < messages.docs.length; index += 400) {
      const batch = db.batch();
      messages.docs.slice(index, index + 400).forEach(s => batch.delete(s.ref));
      await batch.commit();
    }
    return send(res, 200, { ok: true });
  }
  if (req.method === 'POST' && action === 'share') {
    await ref.update({ sharedAt: data.sharedAt || now(), shareActions: FieldValue.increment(1) });
    return send(res, 200, { ok: true });
  }
  if (req.method === 'POST' && action === 'renew') {
    assert(data.plan !== 'free' && ['active', 'ended'].includes(data.status) && !data.scheduledCycle, 409, 'Esta vela não pode ser renovada.');
    const plan = String(bodyOf(req).plan || '');
    assert(['novena', 'quaresma'].includes(plan), 400, 'Escolha um plano pago.');
    const order = await openOrder({ ownerId: user.uid, ownerEmail: user.email, candleId: id, type: 'renewal', plan, amount: PLANS[plan].amount });
    return send(res, 201, { order });
  }
  if (req.method === 'POST' && action === 'pay') {
    assert(data.plan !== 'free' && data.status === 'pending_payment', 409, 'Pagamento indisponível.');
    const order = await openOrder({ ownerId: user.uid, ownerEmail: user.email, candleId: id, type: 'candle', plan: data.plan, amount: PLANS[data.plan].amount });
    return send(res, 201, { order });
  }
  if (req.method === 'POST' && action === 'donate') {
    assert(data.lastCycleEndedAt || data.currentCycle?.endsAt <= now(), 409, 'A doação aparece ao fim do ciclo.');
    const amount = validateDonationAmount(bodyOf(req).amount);
    const order = await openOrder({ ownerId: user.uid, ownerEmail: user.email, candleId: id, type: 'donation', amount });
    return send(res, 201, { order });
  }
  throw new AppError(404, 'Ação não encontrada.');
}

async function adminAction(req, res, path) {
  const user = await adminIdentity(req);
  if (req.method === 'GET' && path === '/admin/metrics') {
    const [candles, creators, orders] = await Promise.all([
      db.collection('candles').get(), db.collection('creators').get(), db.collection('orders').get(),
    ]);
    const activated = candles.docs.filter(s => s.data().activatedAt || s.data().currentCycle || s.data().status === 'ended');
    const shared = activated.filter(s => s.data().sharedAt);
    const counts = shared.map(s => s.data().totalPrayerCount || s.data().prayerCount || 0).sort((a, b) => a - b);
    const median = counts.length ? (counts[Math.floor((counts.length - 1) / 2)] + counts[Math.floor(counts.length / 2)]) / 2 : 0;
    const matured = creators.docs.filter(s => s.data().firstCandleAt && s.data().firstCandleAt <= now() - 7 * 86400_000);
    const returned = matured.filter(s => s.data().returnedAt && s.data().returnedAt <= s.data().firstCandleAt + 7 * 86400_000);
    return send(res, 200, {
      activated: activated.length, shared: shared.length,
      shareRate: activated.length ? shared.length / activated.length : 0,
      medianPrayers: median, returned: returned.length,
      returnRate: matured.length ? returned.length / matured.length : 0,
      paidOrders: orders.docs.filter(s => s.data().status === 'paid').length,
      grossCents: orders.docs.filter(s => s.data().status === 'paid').reduce((sum, s) => sum + s.data().amount, 0),
    });
  }
  if (req.method === 'GET' && path === '/admin/queue') {
    const candles = await db.collection('candles').where('status', '==', 'pending_review').get();
    const reports = await db.collectionGroup('reports').where('status', '==', 'open').limit(100).get();
    const messages = await db.collectionGroup('messages').where('status', '==', 'pending_review').limit(100).get();
    const paymentCases = await db.collection('moderationCases').where('status', '==', 'open').limit(100).get();
    return send(res, 200, { candles: candles.docs.map(s => ({ id: s.id, ...s.data() })), reports: reports.docs.map(s => ({ id: s.id, candleId: s.ref.parent.parent.id, ...s.data() })), messages: messages.docs.map(s => ({ id: s.id, candleId: s.ref.parent.parent.id, ...s.data() })), paymentCases: paymentCases.docs.map(s => ({ id: s.id, ...s.data() })) });
  }
  const candle = path.match(/^\/admin\/candles\/([A-Za-z0-9_-]{32})\/(approve|hide)$/);
  if (req.method === 'POST' && candle) {
    const ref = db.collection('candles').doc(candle[1]);
    const snap = await ref.get();
    assert(snap.exists && snap.data().status !== 'deleted', 404, 'Vela não encontrada.');
    if (candle[2] === 'hide') await ref.update({ status: 'hidden', moderatedBy: user.uid, moderatedAt: now() });
    else {
      const original = snap.data();
      const status = original.plan === 'free' ? 'active' : original.currentCycle ? 'active' : 'pending_payment';
      const cycle = status === 'active' && !original.currentCycle ? nextCycle('free', now()) : null;
      await ref.update({ status, reviewReason: null, moderatedBy: user.uid, moderatedAt: now(), ...(cycle ? { currentCycle: cycle, nextExpirationAt: cycle.endsAt } : {}) });
      if (cycle) await queueEmail(`created-${candle[1]}`, candleLitEmail({ candleId: candle[1], candle: { ...original, currentCycle: cycle }, publicBase: publicBase() }));
    }
    return send(res, 200, { ok: true });
  }
  const message = path.match(/^\/admin\/candles\/([A-Za-z0-9_-]{32})\/messages\/([A-Za-z0-9_-]{32})\/(approve|remove)$/);
  if (req.method === 'POST' && message) {
    const ref = db.collection('candles').doc(message[1]).collection('messages').doc(message[2]);
    const snap = await ref.get();
    assert(snap.exists, 404, 'Mensagem não encontrada.');
    await ref.update({ status: message[3] === 'approve' ? 'published' : 'removed', moderatedBy: user.uid, moderatedAt: now() });
    if (message[3] === 'approve' && snap.data().status !== 'published') await db.collection('candles').doc(message[1]).update({ messageCount: FieldValue.increment(1) });
    return send(res, 200, { ok: true });
  }
  const report = path.match(/^\/admin\/candles\/([A-Za-z0-9_-]{32})\/reports\/([a-f0-9]{64})\/resolve$/);
  if (req.method === 'POST' && report) {
    const ref = db.collection('candles').doc(report[1]).collection('reports').doc(report[2]);
    const snap = await ref.get();
    assert(snap.exists, 404, 'Denúncia não encontrada.');
    await ref.update({ status: 'resolved', moderatedBy: user.uid, moderatedAt: now() });
    return send(res, 200, { ok: true });
  }
  throw new AppError(404, 'Ação de moderação não encontrada.');
}

async function handleWebhook(req, res) {
  assert(safeEqual(String(req.query.webhookSecret || ''), webhookSecret.value()), 401, 'Webhook não autorizado.');
  const event = bodyOf(req);
  assert(typeof event.id === 'string' && typeof event.event === 'string', 400, 'Evento inválido.');
  if (!['transparent.completed', 'transparent.refunded'].includes(event.event)) return send(res, 200, { ok: true });
  const providerId = event.data?.id || event.data?.payment?.id || event.data?.checkout?.id;
  assert(typeof providerId === 'string', 400, 'Cobrança ausente.');
  const link = await db.collection('providerLinks').doc(providerId).get();
  assert(link.exists, 503, 'Cobrança ainda não conciliada.');
  if (event.event === 'transparent.refunded') {
    const orderId = link.data().orderId;
    const refundedAt = now();
    const batch = db.batch();
    batch.update(db.collection('orders').doc(orderId), { status: 'refunded', refundedAt });
    const caseRef = db.collection('moderationCases').doc(orderId);
    if ((await caseRef.get()).exists) batch.update(caseRef, { status: 'resolved', resolution: 'refunded', resolvedAt: refundedAt });
    await batch.commit();
  } else await finishOrder(link.data().orderId, event.id);
  return send(res, 200, { ok: true });
}

export const api = onRequest({ region, maxInstances: 10, secrets: [abacateKey, webhookSecret], invoker: 'public' }, async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return res.status(204).send();
    await route(req, res);
  } catch (error) {
    if (!(error instanceof AppError)) logger.error(error);
    send(res, error instanceof AppError ? error.status : 500, { error: error instanceof AppError ? error.message : 'Ocorreu um erro inesperado.' });
  }
});

export const closeCycles = onSchedule({ schedule: 'every 15 minutes', timeZone: 'America/Sao_Paulo', region }, async () => {
  const expired = await db.collection('candles').where('nextExpirationAt', '<=', now()).limit(100).get();
  for (const snap of expired.docs) {
    const candle = snap.data();
    if (candle.status !== 'active' || !candle.currentCycle) continue;
    const cycle = candle.currentCycle;
    const jobId = `ended-${snap.id}-${cycle.id}`;
    await db.runTransaction(async tx => {
      const latest = await tx.get(snap.ref);
      if (latest.data()?.currentCycle?.id !== cycle.id || latest.data()?.status !== 'active') return;
      const scheduled = latest.data().scheduledCycle;
      tx.create(snap.ref.collection('cycles').doc(cycle.id), { ...cycle, prayerCount: latest.data().prayerCount || 0, messageCount: latest.data().messageCount || 0, closedAt: now() });
      tx.update(snap.ref, scheduled ? { currentCycle: scheduled, scheduledCycle: null, nextExpirationAt: scheduled.endsAt, prayerCount: 0, messageCount: 0, status: 'active', lastCycleEndedAt: cycle.endsAt } : { status: 'ended', endedAt: now(), lastCycleEndedAt: cycle.endsAt, nextExpirationAt: FieldValue.delete() });
      tx.create(db.collection('emailJobs').doc(jobId), {
        ...candleEndedEmail({ candleId: snap.id, candle: latest.data(), cycle, publicBase: publicBase() }),
        state: 'pending', createdAt: now(), attempts: 0,
      });
    });
  }
});

export const dailySummaries = onSchedule({ schedule: '0 18 * * *', timeZone: 'America/Sao_Paulo', region }, async () => {
  const creators = await db.collection('creators').where('dailySummary', '==', true).get();
  const day = new Date().toISOString().slice(0, 10);
  for (const creator of creators.docs) {
    const candles = await db.collection('candles').where('ownerId', '==', creator.id).get();
    const active = candles.docs.filter(s => s.data().status === 'active');
    if (!active.length) continue;
    const prayers = active.reduce((total, s) => total + (s.data().prayerCount || 0), 0);
    const messages = active.reduce((total, s) => total + (s.data().messageCount || 0), 0);
    await queueEmail(`daily-${day}-${creator.id}`, { to: creator.data().email, subject: 'Seu resumo de orações', text: `Você tem ${active.length} vela(s) ativa(s), com ${prayers} registros de oração e ${messages} mensagens neste momento. Acesse ${publicBase()}/minhas-velas.` });
  }
});

export const deliverEmail = onSchedule({ schedule: 'every 5 minutes', region, secrets: [emailKey, emailFrom] }, async () => {
  if (!productEmailsEnabled) return;
  const jobs = await db.collection('emailJobs').where('state', '==', 'pending').limit(50).get();
  for (const job of jobs.docs) {
    try {
      const data = job.data();
      await sendServiceEmail({
        key: emailKey.value(), from: emailFrom.value(), to: data.to, subject: data.subject,
        text: data.text, idempotencyKey: job.id,
        template: emailTemplateForJob(data),
      });
      await job.ref.update({ state: 'sent', sentAt: now() });
    } catch (error) {
      logger.error('Email delivery failed', { jobId: job.id, error });
      await job.ref.update({ attempts: FieldValue.increment(1), lastErrorAt: now() });
    }
  }
});
