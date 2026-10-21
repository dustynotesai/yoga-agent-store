import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { charge } from '../src/payment.js';

const oldKey = process.env.STRIPE_SECRET_KEY;
after(() => { if (oldKey === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = oldKey; });
const args = { amount: 1090, token: 'tok_visa', idempotencyKey: 'checkout-test' };

test('live/unknown Stripe keys and invalid amounts never reach the network', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('network call forbidden'));
  for (const key of ['sk_live_fake', 'rk_live_fake', 'unknown']) {
    process.env.STRIPE_SECRET_KEY = key;
    assert.equal((await charge(args)).reason, 'test_key_required');
  }
  delete process.env.STRIPE_SECRET_KEY;
  for (const amount of [0, -1, 1.5, '1090', Number.MAX_SAFE_INTEGER]) assert.equal((await charge({ ...args, amount })).reason, 'invalid_amount');
  assert.equal((await charge({ ...args, currency: 'USD' })).reason, 'invalid_amount');
  assert.equal((await charge({ ...args, token: 42 })).reason, 'missing_payment');
  assert.equal((await charge(args)).provider, 'simulated');
});

test('Stripe receives NT$1,090 as 109000 minor units and an idempotency key', async t => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
  const fetchMock = t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(options.body.get('amount'), '109000');
    assert.equal(options.body.get('currency'), 'twd');
    assert.equal(options.headers['Idempotency-Key'], 'checkout-test');
    return new Response(JSON.stringify({ id: 'pi_test', status: 'succeeded', livemode: false }));
  });
  assert.equal((await charge(args)).provider, 'stripe_test');
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.equal((await charge({ ...args, idempotencyKey: undefined })).ok, false);
});

test('Stripe server errors leave the outcome unresolved for an idempotent retry', async t => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
  t.mock.method(globalThis, 'fetch', async () => new Response('{"error":{"message":"temporary"}}', { status: 500 }));
  assert.equal((await charge(args)).retryable, true);
});
