import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateKeyPair, signRequest, signObject } from '../src/auth.js';
import { createMandate } from '../src/mandate.js';

const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yoga-store-test-'));
process.env.YOGA_STORE_STATE_DIR = stateDir;
delete process.env.STRIPE_SECRET_KEY;
const { FILES, writeJson, readJson } = await import('../src/paths.js');
writeJson(FILES.products, JSON.parse(fs.readFileSync(new URL('../data/products.json', import.meta.url), 'utf8')));
const allOn = { identity: true, mandate: true, budget: true, payment: true, order: 'original' };
writeJson(FILES.gates, allOn);
const owner = generateKeyPair(), agent = generateKeyPair();
writeJson(FILES.agents, { owners: { owner }, agents: { 'dustynotes-agent': { ...agent, owner: 'owner' } } });
const store = await import('../src/store.js');
const { checkout } = await import('../src/checkout.js');
const { createApp } = await import('../src/server.js');
const server = createApp().listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
after(async () => {
  await new Promise(resolve => server.close(resolve));
  // Only this explicitly created temporary fixture is removed.
  fs.rmSync(stateDir, { recursive: true, force: true });
});

const mandate = (changes = {}) => {
  const envelope = createMandate({ ownerKeyid: 'owner', ownerPrivateKeyPem: owner.private_key_pem, agentKeyid: 'dustynotes-agent', allowedCategories: ['yoga-pants'], maxAmount: 1200 });
  Object.assign(envelope.mandate, changes);
  envelope.signature = signObject(envelope.mandate, owner.private_key_pem);
  return envelope;
};
async function request(route, data, signed = true) {
  const body = data === undefined ? '' : JSON.stringify(data);
  const method = data === undefined ? 'GET' : 'POST';
  const headers = signed ? signRequest({ method, path: route, body, privateKeyPem: agent.private_key_pem, keyid: 'dustynotes-agent' }) : {};
  const response = await fetch(base + route, { method, headers: { ...headers, 'Content-Type': 'application/json' }, ...(body ? { body } : {}) });
  return { status: response.status, body: await response.json() };
}
const items = (id = 'yp-02', quantity = 1) => [{ id, size: 'M', quantity }];
const session = () => store.createSession({ items: items(), door: 'agent' });

test('identity rejects unsigned requests, accepts signed requests and rejects replay/tampering', async () => {
  assert.equal((await request('/agent/products', undefined, false)).status, 401);
  assert.equal((await request('/agent/products')).status, 200);
  const headers = signRequest({ method: 'GET', path: '/agent/products', privateKeyPem: agent.private_key_pem, keyid: 'dustynotes-agent' });
  assert.equal((await fetch(base + '/agent/products', { headers })).status, 200);
  assert.equal((await (await fetch(base + '/agent/products', { headers })).json()).error, 'replay');
  const signed = signRequest({ method: 'POST', path: '/agent/checkout_sessions', body: '{}', privateKeyPem: agent.private_key_pem, keyid: 'dustynotes-agent' });
  const bad = await fetch(base + '/agent/checkout_sessions', { method: 'POST', headers: { ...signed, 'Content-Type': 'application/json' }, body: '{"items":[]}' });
  assert.equal((await bad.json()).error, 'digest_mismatch');
});

test('REST checkout rejects malformed quantities, sizes and combined quantities above stock', async () => {
  for (const quantity of [0, -1, 1.5, '2', null, Number.MAX_SAFE_INTEGER]) {
    const result = await request('/agent/checkout_sessions', { items: items('yp-02', quantity) });
    assert.equal(result.status, 400, String(quantity));
  }
  for (const bad of [null, {}, [], [null], [{ id: 'yp-02', size: '__proto__' }]]) {
    assert.equal((await request('/agent/checkout_sessions', { items: bad })).status, 400);
  }
  const stock = store.getProduct('yp-02').sizes.M;
  assert.equal(store.createSession({ items: [...items('yp-02', stock), ...items()] }).error, 'out_of_stock');
  assert.equal(store.createSession({ items: [...items(), ...items()] }).items[0].quantity, 2);
});

test('authorization, budget and payment gates reject invalid checkout requests before reducing stock', async () => {
  const s = session(), stock = store.getProduct('yp-02').sizes.M;
  const route = `/agent/checkout_sessions/${s.id}/complete`;
  const finish = m => request(route, { mandate: m, payment_data: { token: 'tok_visa' } });
  assert.equal((await finish()).body.error, 'missing_mandate');
  assert.equal((await finish(mandate({ agent_keyid: 'someone-else' }))).body.error, 'mandate_wrong_agent');
  assert.equal((await finish(mandate({ allowed_categories: ['yoga-top'] }))).body.error, 'category_not_allowed');
  assert.equal((await finish(mandate({ expires: '2000-01-01T00:00:00Z' }))).body.error, 'mandate_expired');
  assert.equal((await finish(mandate({ expires: 'invalid' }))).body.error, 'invalid_mandate');
  const forged = mandate(); forged.mandate.max_amount = 9999;
  assert.equal((await finish(forged)).body.error, 'mandate_signature_invalid');
  const over = await finish(mandate({ max_amount: 1000 }));
  assert.equal(over.status, 403); assert.equal(over.body.door, 'budget');
  assert.equal((await request(route, { mandate: mandate() })).body.door, 'payment');
  assert.equal(store.getProduct('yp-02').sizes.M, stock);
  const first = await finish(mandate()), second = await finish(mandate());
  assert.equal(first.status, 200); assert.equal(first.body.order.payment.provider, 'simulated');
  assert.equal(second.body.order.id, first.body.order.id);
  assert.equal(store.getProduct('yp-02').sizes.M, stock - 1);
  assert.equal(readJson(FILES.gates).budget, true);
});

test('budget-off experiment still requires signed authorization and permits the NT$1,490 item', async () => {
  writeJson(FILES.gates, { ...allOn, budget: false });
  try {
    const s = store.createSession({ items: items('yp-04'), door: 'agent' });
    const route = `/agent/checkout_sessions/${s.id}/complete`;
    assert.equal((await request(route, { payment_data: { token: 'tok_visa' } })).status, 403);
    const result = await request(route, { mandate: mandate(), payment_data: { token: 'tok_visa' } });
    assert.equal(result.body.totals.total, 1490);
    assert.equal(result.body.status, 'completed');
  } finally { writeJson(FILES.gates, allOn); }
});

test('concurrent completion charges once, reserves stock and prevents edits/cancellation/reset', async () => {
  const s = session(), stock = store.getProduct('yp-02').sizes.M;
  let resolvePayment, calls = 0;
  const charge = () => { calls++; return new Promise(resolve => { resolvePayment = resolve; }); };
  const first = checkout(s.id, { payment: { token: 'tok_visa' } }, charge);
  assert.equal(store.getProduct('yp-02').sizes.M, stock - 1);
  assert.equal((await checkout(s.id, { payment: {} }, charge)).error, 'not_completable');
  assert.equal(store.updateSession(s.id, { items: items('yp-04') }).error, 'not_editable');
  assert.equal(store.cancelSession(s.id).error, 'not_cancelable');
  assert.equal(store.resetStock().error, 'payment_in_progress');
  resolvePayment({ ok: true, provider: 'mock', id: 'pi_test' });
  const completed = await first;
  assert.equal((await checkout(s.id, { payment: {} }, charge)).order.id, completed.order.id);
  assert.equal(calls, 1);
  assert.equal(store.cancelSession(s.id).error, 'not_cancelable');
});

test('a competing session cannot charge for already-reserved stock', async () => {
  const remaining = store.getProduct('yp-02').sizes.M;
  const a = store.createSession({ items: items('yp-02', remaining), door: 'agent' });
  const b = session();
  let finish;
  const first = checkout(a.id, { payment: {} }, () => new Promise(resolve => { finish = resolve; }));
  assert.equal((await checkout(b.id, { payment: {} }, () => assert.fail('must not charge'))).error, 'out_of_stock');
  finish({ ok: false, reason: 'declined' }); await first;
  assert.equal(store.getProduct('yp-02').sizes.M, remaining);
});

test('unknown payment outcome retries with identical arguments and idempotency key', async () => {
  const s = session(), stock = store.getProduct('yp-02').sizes.M;
  const attempts = [];
  const charge = async args => { attempts.push(args); if (attempts.length === 1) throw new Error('network'); return { ok: true, provider: 'mock' }; };
  assert.equal((await checkout(s.id, { payment: { token: 'tok_visa' } }, charge)).retryable, true);
  assert.equal(s.status, 'payment_pending');
  assert.equal(store.cancelSession(s.id).error, 'not_cancelable');
  assert.equal((await checkout(s.id, { payment: { token: 'different' } }, charge)).status, 'completed');
  assert.deepEqual(attempts[0], attempts[1]);
  assert.equal(store.getProduct('yp-02').sizes.M, stock - 1);
});

test('human checkout also returns the same order on repeat submission', async () => {
  const add = await fetch(base + '/checkout', { method: 'POST', body: new URLSearchParams({ id: 'yp-02', size: 'M' }), redirect: 'manual' });
  const cookie = add.headers.get('set-cookie').split(';')[0];
  const data = new URLSearchParams({ id: 'yp-02', size: 'M', name: 'Test', phone: '0900000000', address: 'Test address', card: '4242424242424242', exp: '12/28', cvc: '123' });
  const stock = store.getProduct('yp-02').sizes.M;
  const complete = () => fetch(base + '/checkout/complete', { method: 'POST', headers: { cookie }, body: data });
  const first = await (await complete()).text(), second = await (await complete()).text();
  assert.equal(first.match(/ord_[a-f0-9]+/)[0], second.match(/ord_[a-f0-9]+/)[0]);
  assert.equal(store.getProduct('yp-02').sizes.M, stock - 1);
});
