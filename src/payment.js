// 付款那一道門。
// 有 STRIPE_SECRET_KEY（測試金鑰 sk_test_…）就真的打 Stripe 測試模式；
// 沒有就模擬，回傳 provider: "simulated"，口播要照實講「這一格用測試卡」。
import crypto from 'node:crypto';

export async function charge({ amount, currency = 'TWD', token, description }) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!token) return { ok: false, reason: 'missing_payment', hint: '沒有帶付款 token' };
  if (!key) {
    return { ok: true, provider: 'simulated', id: 'sim_' + crypto.randomBytes(6).toString('hex'), amount, currency, token_seen: token.slice(0, 8) + '…' };
  }
  const form = new URLSearchParams({
    amount: String(amount),
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
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  const json = await res.json();
  if (!res.ok) return { ok: false, reason: 'stripe_error', hint: json.error?.message || 'Stripe 拒絕' };
  return { ok: json.status === 'succeeded', provider: 'stripe_test', id: json.id, status: json.status, amount, currency };
}
