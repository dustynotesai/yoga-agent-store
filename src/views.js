// 人類門：伺服器端直接吐 HTML。沒有 JSON API 給前端——跟大部分真的電商一樣，
// 資訊散在列表頁、商品頁、尺寸選單裡，agent 得自己一頁一頁讀。
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = n => 'NT$ ' + n.toLocaleString('zh-TW');
const stars = r => '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));
const swatch = { 霧灰: '#9aa3ad', 苔綠: '#6b8f71', 杏色: '#e8d5c0', 深藍: '#1f3a5f', 煙粉: '#d9a5b3', 黑: '#1a1a1a' };

const REVIEWS = [
  { who: 'Yi-ting', text: '穿去上熱瑜珈完全不會滑，口袋放手機剛剛好。', stars: 5 },
  { who: 'Wen', text: '布料很軟，但淺色會有點透，深蹲要注意。', stars: 4 },
  { who: 'Chloe', text: '第二件了。尺寸偏小，我平常 S 這裡要穿 M。', stars: 5 },
];

function layout(title, body, { active = '' } = {}) {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Mountain Flow Yoga</title>
<link rel="stylesheet" href="/styles.css">
</head>
<body>
<header class="nav">
  <a class="brand" href="/">Mountain Flow</a>
  <nav>
    <a href="/" class="${active === 'home' ? 'on' : ''}">全部商品</a>
    <a href="/?category=yoga-pants" class="${active === 'pants' ? 'on' : ''}">瑜珈褲</a>
    <a href="/?category=yoga-top" class="${active === 'top' ? 'on' : ''}">上衣</a>
    <a href="/about">品牌故事</a>
  </nav>
  <a class="cart" href="/checkout" aria-label="購物車">🛒</a>
</header>
${body}
<footer class="foot">
  <p>Mountain Flow Yoga · 台北 · 這是一間<strong>測試用的虛構商店</strong>，商品跟評價都是編的，付款走測試模式。</p>
  <p>這個網站有兩個門：你現在看的是給人的門。給 AI 的門在 <code>/agent</code>，說明在 <code>/.well-known/agent-store.json</code>。</p>
</footer>
</body>
</html>`;
}

export function homePage({ items, category }) {
  const active = category === 'yoga-pants' ? 'pants' : category === 'yoga-top' ? 'top' : 'home';
  const cards = items.map((x, i) => `
    <a class="card fade" style="--i:${i}" href="/products/${x.id}">
      <div class="thumb" style="--c:${swatch[x.color] || '#ccc'}">
        ${x.platform_pick ? '<span class="badge pick">本店推薦</span>' : ''}
        ${x.sponsored ? '<span class="badge ad">贊助</span>' : ''}
      </div>
      <h3>${esc(x.name)}</h3>
      <p class="meta"><span class="stars" title="${x.rating}">${stars(x.rating)}</span> <span class="muted">(${x.review_count})</span></p>
      <p class="price">${money(x.price)}</p>
    </a>`).join('');
  const hero = category ? '' : `
  <section class="hero">
    <div class="hero-text fade">
      <p class="eyebrow">2026 秋季系列</p>
      <h1>動得更自由，<br>穿得更少一點負擔。</h1>
      <p>四向彈性、高腰包覆、放得下手機的口袋。為每一個早晨的流動而做。</p>
      <a class="btn" href="/?category=yoga-pants">看瑜珈褲</a>
    </div>
    <div class="hero-art" aria-hidden="true"><div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div></div>
  </section>`;
  return layout(category ? '商品' : '首頁', `
  ${hero}
  <main class="wrap">
    <div class="row-head">
      <h2>${category === 'yoga-pants' ? '瑜珈褲' : category === 'yoga-top' ? '上衣' : '全部商品'}</h2>
      <p class="muted">${items.length} 件</p>
    </div>
    <section class="grid">${cards}</section>
    <section class="reviews">
      <h2>大家怎麼說</h2>
      <div class="rgrid">
        ${REVIEWS.map(r => `<blockquote class="fade"><p class="stars">${stars(r.stars)}</p><p>${esc(r.text)}</p><cite>— ${esc(r.who)}</cite></blockquote>`).join('')}
      </div>
    </section>
  </main>`, { active });
}

export function productPage(x) {
  const sizes = Object.entries(x.sizes).map(([s, n]) =>
    `<label class="size ${n ? '' : 'sold'}"><input type="radio" name="size" value="${s}" ${n ? '' : 'disabled'} required> ${s}${n ? '' : ' <small>售完</small>'}</label>`).join('');
  const features = [
    x.pockets ? '口袋設計' : '無口袋設計',
    '四向彈性',
    '高腰剪裁',
    '台灣製造',
  ];
  return layout(x.name, `
  <main class="wrap product">
    <div class="pthumb fade" style="--c:${swatch[x.color] || '#ccc'}">
      ${x.platform_pick ? '<span class="badge pick">本店推薦</span>' : ''}
      ${x.sponsored ? '<span class="badge ad">贊助</span>' : ''}
    </div>
    <div class="pinfo fade">
      <p class="eyebrow">${x.category === 'yoga-pants' ? '瑜珈褲' : '上衣'} · ${esc(x.color)}</p>
      <h1>${esc(x.name)}</h1>
      <p class="meta"><span class="stars">${stars(x.rating)}</span> ${x.rating} <span class="muted">· ${x.review_count} 則評價</span></p>
      <p class="price big">${money(x.price)}</p>
      <p>${esc(x.description)}</p>
      <form method="post" action="/checkout">
        <input type="hidden" name="id" value="${x.id}">
        <fieldset><legend>尺寸</legend><div class="sizes">${sizes}</div></fieldset>
        <button class="btn" type="submit">加入購物車並結帳</button>
      </form>
      <details class="specs"><summary>材質與特色</summary>
        <ul>${features.map(f => `<li>${f}</li>`).join('')}<li>${esc(x.material)}</li></ul>
      </details>
    </div>
  </main>`);
}

export function checkoutPage({ product, size, error }) {
  if (!product) return layout('購物車', `<main class="wrap"><h1>購物車是空的</h1><p><a class="btn" href="/">去逛逛</a></p></main>`);
  return layout('結帳', `
  <main class="wrap checkout">
    <h1>結帳</h1>
    ${error ? `<p class="err">${esc(error)}</p>` : ''}
    <div class="co-grid">
      <form method="post" action="/checkout/complete" class="fade">
        <input type="hidden" name="id" value="${product.id}"><input type="hidden" name="size" value="${esc(size)}">
        <h2>收件資料</h2>
        <label>姓名 <input name="name" required></label>
        <label>地址 <input name="address" required placeholder="台北市…"></label>
        <label>電話 <input name="phone" required></label>
        <h2>付款</h2>
        <label>卡號 <input name="card" required placeholder="4242 4242 4242 4242"></label>
        <div class="two"><label>到期 <input name="exp" required placeholder="12/28"></label><label>CVC <input name="cvc" required placeholder="123"></label></div>
        <button class="btn" type="submit">確認付款 ${money(product.price)}</button>
        <p class="muted small">測試模式：不會真的扣款。</p>
      </form>
      <aside class="summary fade">
        <h2>訂單摘要</h2>
        <p><strong>${esc(product.name)}</strong> · ${esc(size)} 號 × 1</p>
        <p>小計 ${money(product.price)}</p>
        <p>運費 NT$ 0</p>
        <p class="price">合計 ${money(product.price)}</p>
      </aside>
    </div>
  </main>`);
}

export function donePage(order) {
  return layout('完成', `<main class="wrap"><h1>謝謝你 🎉</h1><p>訂單 <code>${esc(order.id)}</code> 已成立。</p><p><a class="btn" href="/">回首頁</a></p></main>`);
}

export function aboutPage() {
  return layout('品牌故事', `<main class="wrap prose"><h1>品牌故事</h1><p>Mountain Flow 是一間虛構的瑜珈服品牌，為了一支影片而存在。</p><p>它有兩個門：一個給人，一個給 AI。你正在看給人的那一個。</p></main>`);
}

// 同一頁的 markdown 版（Cloudflare Markdown for Agents 的做法：Accept: text/markdown 就回這個）
export function homeMarkdown({ items, category }) {
  return `# Mountain Flow Yoga${category ? ` · ${category}` : ''}\n\n` +
    items.map(x => `- [${x.name}](/products/${x.id}) — ${money(x.price)} · ${x.rating}★ (${x.review_count})${x.platform_pick ? ' · 本店推薦' : ''}${x.sponsored ? ' · 贊助' : ''}`).join('\n') + '\n';
}
export function productMarkdown(x) {
  const sizes = Object.entries(x.sizes).map(([s, n]) => `${s}${n ? '' : '（售完）'}`).join('、');
  return `# ${x.name}\n\n${money(x.price)} · ${x.rating}★（${x.review_count} 則）· ${x.color}\n\n${x.description}\n\n- 尺寸：${sizes}\n- ${x.pockets ? '口袋設計' : '無口袋設計'}\n- ${x.material}\n`;
}
