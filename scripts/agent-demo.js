// 讓你看後門長什麼樣：蓋章的 header、四道門一道一道過。店要先開著（npm start）。
import { call, loadMandate } from '../src/client.js';

const show = (title, r) => {
  console.log(`\n── ${title}  → HTTP ${r.status}${r.tokens ? `  (${r.tokens} tokens)` : ''}`);
  console.log(JSON.stringify(r.json, null, 2).split('\n').slice(0, 30).join('\n'));
};

const list = await call('GET', '/agent/products?category=yoga-pants');
console.log('agent 敲門時帶的 header：');
for (const [k, v] of Object.entries(list.headers)) if (/signature|digest/i.test(k)) console.log(`  ${k}: ${v.slice(0, 110)}${v.length > 110 ? '…' : ''}`);
show('GET /agent/products?category=yoga-pants', list);
if (!list.ok) process.exit(1);

// 挑一件：M 號有貨、有口袋、≤1200、評價最高
const pick = list.json.items.filter(x => x.sizes_in_stock.M && x.pockets && x.price <= 1200).sort((a, b) => b.rating - a.rating)[0];
console.log(`\n（示範腳本用寫死的規則挑到：${pick.name} ${pick.price}。真正的實驗要讓 Claude Code 自己挑。）`);

const s = await call('POST', '/agent/checkout_sessions', { items: [{ id: pick.id, size: 'M', quantity: 1 }], buyer: { name: 'Dustin', address: '台北市', phone: '0900000000' } });
show('POST /agent/checkout_sessions', s);
if (!s.ok) process.exit(1);

const done = await call('POST', `/agent/checkout_sessions/${s.json.id}/complete`, { mandate: loadMandate() || undefined, payment_data: { type: 'card', token: 'tok_visa' } });
show(`POST /agent/checkout_sessions/${s.json.id}/complete`, done);
console.log(done.ok ? '\n✓ 四道門都過了，訂單成立。' : `\n✗ 被擋在「${done.json.door}」那一道門：${done.json.hint}`);
