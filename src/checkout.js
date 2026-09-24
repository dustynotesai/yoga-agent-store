// One in-process completion path for both doors. Unknown payment outcomes keep
// their stock reservation and original Stripe arguments for an idempotent retry.
import crypto from 'node:crypto';
import * as store from './store.js';
import { charge } from './payment.js';

const attempts = new Map();

export async function checkout(id, { payment, extra = {} }, chargePayment = charge) {
  const session = store.getSession(id);
  if (session?.status === 'completed') return session;
  const reserved = store.beginCompletion(id);
  if (reserved.error) return reserved;
  let attempt = attempts.get(id);
  if (!attempt) {
    attempt = { payment: payment && { ...payment, amount: reserved.totals.total, currency: 'TWD', idempotencyKey: `${id}-${crypto.randomUUID()}` }, extra };
    attempts.set(id, attempt);
  }
  let result;
  try {
    result = attempt.payment ? await chargePayment(attempt.payment) : { ok: true, provider: 'skipped' };
  } catch {
    store.paymentFailed(id, true);
    return { error: 'payment_unavailable', door: 'payment', retryable: true, hint: '付款結果尚未確認，請重試同一筆結帳；請勿另開訂單。' };
  }
  if (!result.ok) {
    store.paymentFailed(id, !!result.retryable);
    if (!result.retryable) attempts.delete(id);
    return { error: result.reason, hint: result.hint, door: 'payment', retryable: !!result.retryable };
  }
  const done = store.completeSession(id, { ...attempt.extra, payment: result });
  attempts.delete(id);
  return done;
}
