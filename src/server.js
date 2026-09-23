// 一間店，兩個門。
//   /            人類門：HTML、CSS、動畫、表單（Accept: text/markdown 會回 markdown）
//   /agent/*     agent 門：JSON、五個 checkout endpoint（OpenAI ACP 的形狀）、簽章驗證
//   /.well-known/agent-store.json  告訴 agent 這間店有哪些門（UCP 的 profile 形狀）
import express from 'express';
import { encode } from 'gpt-tokenizer';
import { FILES, p, readJson, writeJson, appendLog, gates } from './paths.js';
import { verifyRequest } from './auth.js';
import { checkMandate } from './mandate.js';
import { charge } from './payment.js';
import * as store from './store.js';
import * as V from './views.js';

const PORT = +(process.env.PORT || 4242);
const app = express();
app.disable('x-powered-by');
app.use(express.urlencoded({ extended: false }));
app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf.toString('utf8'); } }));

const tokens = s => encode(String(s)).length;
const agents = () => readJson(FILES.agents, { owners: {}, agents: {} });

// 每一個請求都記：哪個門、多少 byte、多少 token（用 OpenAI 的 tokenizer 估，Claude 的實際用量以 Claude Code 為準）
function logResponse(req, res, body, extra = {}) {
  const t = tokens(body);
  res.setHeader('x-tokens', t);
  appendLog(FILES.requestsLog, {
    door: req.path.startsWith('/agent') ? 'agent' : 'human',
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
  const category = req.query.category || '';
  const { items } = store.catalog(category ? { category } : {});
  sendHtml(req, res, V.homePage({ items, category }), V.homeMarkdown({ items, category }));
});
app.get('/about', (req, res) => sendHtml(req, res, V.aboutPage(), '# 品牌故事\n\n虛構的瑜珈服品牌，為了一支影片而存在。\n'));
app.get('/products/:id', (req, res) => {
  const x = store.getProduct(req.params.id);
  if (!x) { res.status(404); return sendHtml(req, res, V.aboutPage(), '# 404\n'); }
  sendHtml(req, res, V.productPage(x), V.productMarkdown(x));
});
app.get('/checkout', (req, res) => sendHtml(req, res, V.checkoutPage({}), '# 購物車是空的\n'));
app.post('/checkout', (req, res) => {
  const product = store.getProduct(req.body.id);
  const size = req.body.size;
  if (!product || !size) { res.status(400); return sendHtml(req, res, V.checkoutPage({ product, size, error: '請先選尺寸' })); }
  sendHtml(req, res, V.checkoutPage({ product, size }));
});
app.post('/checkout/complete', async (req, res) => {
  const { id, size, name, address, phone, card } = req.body;
  const product = store.getProduct(id);
  const s = store.createSession({ items: [{ id, size, quantity: 1 }], buyer: { name, address, phone }, door: 'human' });
  if (s.error) { res.status(400); return sendHtml(req, res, V.checkoutPage({ product, size, error: s.hint })); }
  const pay = await charge({ amount: s.totals.total, token: card ? 'tok_visa' : '', description: `human ${s.id}` });
  if (!pay.ok) { res.status(402); return sendHtml(req, res, V.checkoutPage({ product, size, error: pay.hint })); }
  const done = store.completeSession(s.id, { payment: pay });
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
  if (s.status !== 'ready_for_complete') return sendJson(req, res, { error: 'not_completable', hint: `狀態是 ${s.status}` }, 400);
  // 授權＋預算那兩道門
  const m = checkMandate({ envelope: req.body.mandate, agentKeyid: req.agent.keyid, categories: [...new Set(s.items.map(l => l.category))], amount: s.totals.total, agents: agents(), gates: g });
  if (!m.ok) return sendJson(req, res, { error: m.reason, hint: m.hint, door: g.budget && m.reason === 'over_budget' ? 'budget' : 'authorization' }, 403);
  // 付款那一道門
  let pay = { ok: true, provider: 'skipped' };
  if (g.payment) {
    pay = await charge({ amount: s.totals.total, token: req.body.payment_data?.token, description: `agent ${s.id}` });
    if (!pay.ok) return sendJson(req, res, { error: pay.reason, hint: pay.hint, door: 'payment' }, 402);
  }
  const done = store.completeSession(s.id, { keyid: req.agent.keyid, mandate_id: m.mandate_id || null, payment: pay });
  if (done.error) return sendJson(req, res, done, 409);
  sendJson(req, res, done);
});
app.use('/agent', agent);

// ───────────── 只有本機能碰的管理端 ─────────────
const local = (req, res, next) => (['::1', '127.0.0.1', '::ffff:127.0.0.1'].includes(req.ip) ? next() : res.status(403).end());
app.post('/admin/reset', local, (req, res) => { store.resetStock(); res.json({ ok: true }); });
app.get('/admin/gates', local, (req, res) => res.json(gates()));
app.post('/admin/gates', local, (req, res) => { const g = { ...gates(), ...req.body }; writeJson(FILES.gates, g); res.json(g); });

app.listen(PORT, () => {
  const g = gates();
  console.log(`Mountain Flow Yoga · http://localhost:${PORT}`);
  console.log(`  人類門  http://localhost:${PORT}/`);
  console.log(`  agent 門 http://localhost:${PORT}/agent/products   （自我介紹 /.well-known/agent-store.json）`);
  console.log(`  四道門  身分=${g.identity ? '開' : '關'} 授權=${g.mandate ? '開' : '關'} 預算=${g.budget ? '開' : '關'} 付款=${g.payment ? '開' : '關'}  目錄順序=${g.order}${process.env.STRIPE_SECRET_KEY ? '  付款=Stripe 測試模式' : '  付款=模擬'}`);
});
