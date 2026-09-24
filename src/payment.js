// 付款那一道門。
// 有 STRIPE_SECRET_KEY（測試金鑰 sk_test_…）就真的打 Stripe 測試模式；
// 沒有就模擬，回傳 provider: "simulated"，口播要照實講「這一格用測試卡」。
import crypto from 'node:crypto';

export async function charge({ amount, currency = 'TWD', token, description, idempotencyKey }) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (key && !key.startsWith('sk_test_')) return { ok: false, reason: 'test_key_required', hint: '此商店只接受 Stripe sk_test_ 測試金鑰' };
  if (currency !== 'TWD' || !Number.isSafeInteger(amount) || amount <= 0 || !Number.isSafeInteger(amount * 100)) {
    return { ok: false, reason: 'invalid_amount', hint: '金額必須是正整數新台幣' };
  }
  if (typeof token !== 'string' || !token.trim()) return { ok: false, reason: 'missing_payment', hint: '沒有帶付款 token' };
  if (!key) {
    return { ok: true, provider: 'simulated', id: 'sim_' + crypto.randomBytes(6).toString('hex'), amount, currency, token_seen: token.slice(0, 8) + '…' };
  }
  if (!idempotencyKey) return { ok: false, reason: 'missing_idempotency_key', hint: '付款缺少重試識別碼' };
  const form = new URLSearchParams({
    // Stripe charges TWD in hundredths, even though this catalog uses whole NT$.
    amount: String(amount * 100),
    currency: currency.toLowerCase(),
    confirm: 'true',
    description: description || 'yoga-agent-store',
    'payment_method_data[type]': 'card',
    'payment_method_data[card][token]': token,
    'automatic_payment_methods[enabled]': 'true',
    'automatic_payment_methods[allow_redirects]': 'never',
  });
  const res = await fetch('https://api.stripe.com/v1/payment_intents', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': idempotencyKey },
    body: form,
    signal: AbortSignal.timeout(15000),
  });
  const json = await res.json();
  if (!res.ok) return { ok: false, reason: 'stripe_error', hint: json.error?.message || 'Stripe 拒絕', retryable: res.status >= 500 || res.status === 409 };
  if (json.livemode !== false) return { ok: false, reason: 'unexpected_payment_mode', hint: '付款回應不是測試模式', retryable: true };
  return { ok: json.status === 'succeeded', reason: json.status === 'succeeded' ? undefined : 'payment_incomplete', hint: '測試付款尚未完成', provider: 'stripe_test', id: json.id, status: json.status, amount, currency };
}
