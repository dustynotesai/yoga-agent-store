// 一間店，兩個門。
//   /            人類門：HTML、CSS、動畫、表單（Accept: text/markdown 會回 markdown）
//   /agent/*     agent 門：JSON、五個 checkout endpoint（OpenAI ACP 的形狀）、簽章驗證
//   /.well-known/agent-store.json  告訴 agent 這間店有哪些門（UCP 的 profile 形狀）
import express from 'express';
import { pathToFileURL } from 'node:url';
import { encode } from 'gpt-tokenizer';
import { FILES, p, readJson, writeJson, appendLog, gates } from './paths.js';
import { verifyRequest } from './auth.js';
import { checkMandate } from './mandate.js';
import { charge } from './payment.js';
import { checkout } from './checkout.js';
import * as store from './store.js';
import * as V from './views.js';
import { filterCatalog } from './presentation.js';

export function createApp({ chargePayment = charge } = {}) {
const app = express();
app.disable('x-powered-by');
app.use(express.urlencoded({ extended: false }));
app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf.toString('utf8'); } }));
app.use((req, _res, next) => { req.body ??= {}; next(); });

const tokens = s => encode(String(s)).length;
const agents = () => readJson(FILES.agents, { owners: {}, agents: {} });

// 每一個請求都記：哪個門、多少 byte、多少 token（用 OpenAI 的 tokenizer 估，Claude 的實際用量以 Claude Code 為準）
function logResponse(req, res, body, extra = {}) {
  const t = tokens(body);
  res.setHeader('x-tokens', t);
  appendLog(FILES.requestsLog, {
    door: req.originalUrl.startsWith('/agent') ? 'agent' : 'human',
    method: req.method, path: req.originalUrl, status: res.statusCode,
    bytes: Buffer.byteLength(body), tokens: t,
    ua: req.get('user-agent') || '', accept: req.get('accept') || '',
    ...extra,
  });
}

function sendHtml(req, res, html, md) {
  const wantsMd = (req.get('accept') || '').includes('text/markdown');
  if (wantsMd && md) {
    res.setHeader('x-original-tokens', tokens(html));
    res.setHeader('x-markdown-tokens', tokens(md));
    res.setHeader('vary', 'accept');
    res.type('text/markdown; charset=utf-8');
    logResponse(req, res, md, { format: 'markdown', html_tokens: tokens(html) });
    return res.send(md);
  }
  res.type('html');
  logResponse(req, res, html, { format: 'html' });
  res.send(html);
}

// ───────────── 人類門 ─────────────
app.use(express.static(p('public')));

app.get('/', (req, res) => {
  const category = ['yoga-pants', 'yoga-top'].includes(req.query.category) ? req.query.category : '';
  const { items: allItems } = store.catalog();
  const { items, filters } = filterCatalog(category ? allItems.filter(x => x.category === category) : allItems, req.query);
  const counts = { all: allItems.length, pants: allItems.filter(x => x.category === 'yoga-pants').length, tops: allItems.filter(x => x.category === 'yoga-top').length };
  sendHtml(req, res, V.homePage({ items, category, filters, counts }), V.homeMarkdown({ items, category }));
});
app.get('/about', (req, res) => sendHtml(req, res, V.aboutPage(), '# 品牌故事\n\n虛構的瑜珈服品牌，為了一支影片而存在。\n'));
app.get('/products/:id', (req, res) => {
  const x = store.getProduct(req.params.id);
  if (!x) { res.status(404); return sendHtml(req, res, V.notFoundPage(), '# 404\n'); }
  sendHtml(req, res, V.productPage(x), V.productMarkdown(x));
});
// Keep the existing single-item checkout, but retain the selected item across pages.
const humanSession = req => {
  const id = (req.get('cookie') || '').match(/(?:^|;\s*)mf_bag=(cs_[a-f0-9]{12})(?:;|$)/)?.[1];
  const session = id && store.getSession(id);
  return session?.door === 'human' ? session : null;
};
app.use('/checkout', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.get('/checkout', (req, res) => {
  const session = humanSession(req);
  const line = ['ready_for_complete', 'payment_pending'].includes(session?.status) ? session.items[0] : null;
  sendHtml(req, res, V.checkoutPage(line ? { product: store.getProduct(line.id), size: line.size, buyer: session.buyer } : {}));
});
app.post('/checkout', (req, res) => {
  const product = store.getProduct(req.body.id);
  const size = req.body.size;
  if (!product) { res.status(404); return sendHtml(req, res, V.notFoundPage()); }
  if (!Object.hasOwn(product.sizes, size) || product.sizes[size] <= 0) {
    res.status(400); return sendHtml(req, res, V.productPage(product, { error: '請選擇有現貨的尺寸，再前往結帳。' }));
  }
  const session = store.createSession({ items: [{ id: product.id, size, quantity: 1 }], door: 'human' });
  if (session.error) { res.status(400); return sendHtml(req, res, V.productPage(product, { error: session.hint })); }
  res.cookie('mf_bag', session.id, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: 4 * 60 * 60 * 1000 });
  res.redirect(303, '/checkout');
});
app.post('/checkout/complete', async (req, res) => {
  const s = humanSession(req);
  if (s?.status === 'completed') return sendHtml(req, res, V.donePage(s.order));
  if (!s || !['ready_for_complete', 'payment_pending'].includes(s.status)) {
    res.status(400); return sendHtml(req, res, V.checkoutPage({ error: '購物袋已過期，請重新選擇商品。' }));
  }
  const line = s.items[0];
  const product = store.getProduct(line.id);
  const buyer = Object.fromEntries(['name', 'address', 'phone'].map(key => [key, typeof req.body[key] === 'string' ? req.body[key].trim().slice(0, key === 'address' ? 300 : 100) : '']));
  const fail = (error, status = 400) => { res.status(status); return sendHtml(req, res, V.checkoutPage({ product, size: line.size, buyer, error })); };
  if (req.body.id !== line.id || req.body.size !== line.size) return fail('商品選擇已變更，請確認購物袋後再送出。');
  if (Object.values(buyer).some(value => !value)) return fail('請完整填寫姓名、電話與地址。');
  if (String(req.body.card || '').replace(/[\s-]/g, '') !== '4242424242424242') return fail('請使用測試卡號 4242 4242 4242 4242。');
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(req.body.exp || '') || !/^\d{3,4}$/.test(req.body.cvc || '')) return fail('請填寫有效格式的到期年月（如 12/28）與 CVC。');
  if (s.status === 'ready_for_complete') {
    const updated = store.updateSession(s.id, { buyer });
    if (updated.error) return fail(updated.hint);
  }
  const done = await checkout(s.id, { payment: { token: 'tok_visa', description: `human ${s.id}` } }, chargePayment);
  if (done.error) return fail(done.hint, done.retryable ? 502 : done.door === 'payment' ? 402 : 409);
  sendHtml(req, res, V.donePage(done.order));
});

// ───────────── 店的自我介紹（給 agent 看的） ─────────────
app.get('/.well-known/agent-store.json', (req, res) => {
  const g = gates();
  const body = JSON.stringify({
    name: 'Mountain Flow Yoga (test store)',
    description: '虛構的瑜珈服測試商店。人類門在 /，agent 門在 /agent。',
    doors: {
      human: { url: '/', formats: ['text/html', 'text/markdown (Accept header)'] },
      agent: {
        base: '/agent',
        transport: ['REST', 'MCP (node src/mcp.js)'],
        catalog: 'GET /agent/products?category=yoga-pants',
        product: 'GET /agent/products/{id}',
        checkout: ['POST /agent/checkout_sessions', 'POST /agent/checkout_sessions/{id}', 'GET /agent/checkout_sessions/{id}', 'POST /agent/checkout_sessions/{id}/complete', 'POST /agent/checkout_sessions/{id}/cancel'],
        identity: g.identity ? 'HTTP Message Signatures (ed25519), keyid must be registered' : 'off',
        authorization: g.mandate ? 'signed mandate required at complete' : 'off',
        budget: g.budget ? 'mandate.max_amount enforced' : 'off',
        payment: g.payment ? 'payment_data.token required (test mode)' : 'off',
      },
    },
  }, null, 2);
  res.type('json'); logResponse(req, res, body); res.send(body);
});

// ───────────── agent 門 ─────────────
const agent = express.Router();

// 身分那一道門
agent.use((req, res, next) => {
  const g = gates();
  if (!g.identity) { req.agent = { keyid: 'anonymous', tag: 'none' }; return next(); }
  const v = verifyRequest({ method: req.method, path: req.originalUrl, rawBody: req.rawBody || '', headers: req.headers, agents: agents() });
  if (!v.ok) {
    const body = JSON.stringify({ error: v.reason, hint: v.hint, door: 'identity' });
    res.status(401).type('json'); logResponse(req, res, body, { denied: v.reason }); return res.send(body);
  }
  req.agent = v;
  next();
});

const sendJson = (req, res, obj, status = 200) => {
  const body = JSON.stringify(obj, null, 2);
  res.status(status).type('json');
  logResponse(req, res, body, { keyid: req.agent?.keyid });
  res.send(body);
};

agent.get('/products', (req, res) => {
  const { order, items } = store.catalog(req.query.category ? { category: req.query.category } : {});
  sendJson(req, res, { order, count: items.length, items: items.map(store.agentView) });
});
agent.get('/products/:id', (req, res) => {
  const x = store.getProduct(req.params.id);
  if (!x) return sendJson(req, res, { error: 'not_found' }, 404);
  sendJson(req, res, store.agentView(x));
});
agent.post('/checkout_sessions', (req, res) => {
  const s = store.createSession({ items: req.body.items, buyer: req.body.buyer, door: 'agent' });
  if (s.error) return sendJson(req, res, s, 400);
  sendJson(req, res, s, 201);
});
agent.get('/checkout_sessions/:id', (req, res) => {
  const s = store.getSession(req.params.id);
  if (!s) return sendJson(req, res, { error: 'not_found' }, 404);
  sendJson(req, res, s);
});
agent.post('/checkout_sessions/:id', (req, res) => {
  const s = store.updateSession(req.params.id, req.body);
  if (s.error) return sendJson(req, res, s, 400);
  sendJson(req, res, s);
});
agent.post('/checkout_sessions/:id/cancel', (req, res) => {
  const s = store.cancelSession(req.params.id);
  if (s.error) return sendJson(req, res, s, 400);
  sendJson(req, res, s);
});
agent.post('/checkout_sessions/:id/complete', async (req, res) => {
  const g = gates();
  const s = store.getSession(req.params.id);
  if (!s) return sendJson(req, res, { error: 'not_found' }, 404);
  if (!['ready_for_complete', 'payment_pending', 'completed'].includes(s.status)) return sendJson(req, res, { error: 'not_completable', hint: `狀態是 ${s.status}` }, 409);
  // 授權＋預算那兩道門
  const m = checkMandate({ envelope: req.body.mandate, agentKeyid: req.agent.keyid, categories: [...new Set(s.items.map(l => l.category))], amount: s.totals.total, agents: agents(), gates: g });
  if (!m.ok) return sendJson(req, res, { error: m.reason, hint: m.hint, door: g.budget && m.reason === 'over_budget' ? 'budget' : 'authorization' }, 403);
  // 付款那一道門
  const done = await checkout(s.id, {
    payment: g.payment ? { token: req.body.payment_data?.token, description: `agent ${s.id}` } : null,
    extra: { keyid: req.agent.keyid, mandate_id: m.mandate_id || null },
  }, chargePayment);
  if (done.error) return sendJson(req, res, done, done.retryable ? 502 : done.door === 'payment' ? 402 : 409);
  sendJson(req, res, done);
});
app.use('/agent', agent);

// ───────────── 只有本機能碰的管理端 ─────────────
const local = (req, res, next) => (['::1', '127.0.0.1', '::ffff:127.0.0.1'].includes(req.ip) ? next() : res.status(403).end());
app.post('/admin/reset', local, (req, res) => { const result = store.resetStock(); res.status(result.error ? 409 : 200).json(result); });
app.get('/admin/gates', local, (req, res) => res.json(gates()));
app.post('/admin/gates', local, (req, res) => { const g = { ...gates(), ...req.body }; writeJson(FILES.gates, g); res.json(g); });

return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
const PORT = +(process.env.PORT || 4242);
createApp().listen(PORT, () => {
  const g = gates();
  console.log(`Mountain Flow Yoga · http://localhost:${PORT}`);
  console.log(`  人類門  http://localhost:${PORT}/`);
  console.log(`  agent 門 http://localhost:${PORT}/agent/products   （自我介紹 /.well-known/agent-store.json）`);
  const mode = !process.env.STRIPE_SECRET_KEY ? '模擬' : process.env.STRIPE_SECRET_KEY.startsWith('sk_test_') ? 'Stripe 測試模式' : '金鑰無效，付款將拒絕';
  console.log(`  四道門  身分=${g.identity ? '開' : '關'} 授權=${g.mandate ? '開' : '關'} 預算=${g.budget ? '開' : '關'} 付款=${g.payment ? '開' : '關'}  目錄順序=${g.order}  付款=${mode}`);
});
}
