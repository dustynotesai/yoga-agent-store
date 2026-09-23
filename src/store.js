// 目錄、庫存、結帳 session、訂單。兩個門共用同一份資料——這是重點。
import crypto from 'node:crypto';
import { FILES, readJson, writeJson, appendLog, gates } from './paths.js';

let products = readJson(FILES.products);
const sessions = new Map();

function seeded(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296; };
}

export function catalog({ category } = {}) {
  const g = gates();
  let list = products.slice();
  if (category) list = list.filter(x => x.category === category);
  const mode = g.order || 'original';
  if (mode === 'reversed') list.reverse();
  else if (mode === 'random') list.sort(() => Math.random() - 0.5);
  else if (mode.startsWith('seed:')) { const r = seeded(mode.slice(5)); list.sort(() => r() - 0.5); }
  return { order: mode, items: list };
}

export const getProduct = id => products.find(x => x.id === id) || null;

export function agentView(x) {
  // agent 門看到的商品：結構化欄位 ＋ 一句人話摘要（research §四第一名的形狀）
  return {
    id: x.id, name: x.name, category: x.category,
    price: x.price, currency: x.currency,
    color: x.color, material: x.material, pockets: x.pockets,
    rating: x.rating, review_count: x.review_count,
    sizes_in_stock: Object.fromEntries(Object.entries(x.sizes).map(([s, n]) => [s, n > 0])),
    summary: x.summary,
    ...(x.sponsored ? { sponsored: true } : {}),
    ...(x.platform_pick ? { platform_pick: true, badge: '本店推薦' } : {}),
  };
}

export function createSession({ items, buyer, door }) {
  const lines = [];
  for (const it of items || []) {
    const pr = getProduct(it.id);
    if (!pr) return { error: 'unknown_product', hint: `沒有 ${it.id} 這件商品` };
    const size = it.size;
    if (!(size in pr.sizes)) return { error: 'unknown_size', hint: `${pr.name} 沒有 ${size} 號` };
    const qty = it.quantity || 1;
    if (pr.sizes[size] < qty) return { error: 'out_of_stock', hint: `${pr.name} ${size} 號缺貨` };
    lines.push({ id: pr.id, name: pr.name, category: pr.category, size, quantity: qty, unit_price: pr.price, subtotal: pr.price * qty });
  }
  if (!lines.length) return { error: 'empty', hint: '購物車是空的' };
  const total = lines.reduce((a, l) => a + l.subtotal, 0);
  const s = {
    id: 'cs_' + crypto.randomBytes(6).toString('hex'),
    status: 'ready_for_complete',
    door,
    items: lines,
    buyer: buyer || {},
    totals: { subtotal: total, shipping: 0, total, currency: 'TWD' },
    created: new Date().toISOString(),
  };
  sessions.set(s.id, s);
  return s;
}

export const getSession = id => sessions.get(id) || null;

export function updateSession(id, { items, buyer }) {
  const s = sessions.get(id);
  if (!s) return { error: 'not_found' };
  if (s.status !== 'ready_for_complete') return { error: 'not_editable', hint: `session 狀態是 ${s.status}` };
  const next = createSession({ items: items || s.items.map(l => ({ id: l.id, size: l.size, quantity: l.quantity })), buyer: buyer || s.buyer, door: s.door });
  if (next.error) return next;
  sessions.delete(next.id);
  Object.assign(s, next, { id: s.id });
  return s;
}

export function cancelSession(id) {
  const s = sessions.get(id);
  if (!s) return { error: 'not_found' };
  s.status = 'canceled';
  return s;
}

export function completeSession(id, extra) {
  const s = sessions.get(id);
  if (!s) return { error: 'not_found' };
  if (s.status !== 'ready_for_complete') return { error: 'not_completable', hint: `session 狀態是 ${s.status}` };
  for (const l of s.items) {
    const pr = getProduct(l.id);
    if (pr.sizes[l.size] < l.quantity) return { error: 'out_of_stock', hint: `${pr.name} ${l.size} 號剛好賣完` };
  }
  for (const l of s.items) getProduct(l.id).sizes[l.size] -= l.quantity; // 只扣記憶體，POST /admin/reset 會還原
  s.status = 'completed';
  s.order = { id: 'ord_' + crypto.randomBytes(6).toString('hex'), ...extra, completed: new Date().toISOString() };
  const g = gates();
  appendLog(FILES.ordersLog, {
    door: s.door, run_tag: g.run_tag || '', order_mode: g.order,
    gates: { identity: g.identity, mandate: g.mandate, budget: g.budget, payment: g.payment },
    order_id: s.order.id, session_id: s.id,
    items: s.items.map(l => ({ id: l.id, name: l.name, size: l.size, quantity: l.quantity })),
    total: s.totals.total, keyid: extra?.keyid || null, payment: extra?.payment || null,
  });
  return s;
}

export function resetStock() {
  products = readJson(FILES.products);
}
