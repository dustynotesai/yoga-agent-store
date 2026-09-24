// Both the visual storefront and markdown representation use the shared catalog.
import { productDetails, productImage, swatches } from './presentation.js';

const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
const money = (n) => 'NT$ ' + n.toLocaleString('zh-TW');
const arrow =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>';
const mountain =
  '<svg viewBox="0 0 40 30" aria-hidden="true"><path d="m2 24 12-19 12 19M18 24l9-14 11 14M10 12l4 4 4-4"/></svg>';
const bag =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14l1 14H4L5 7Zm3 0V5a4 4 0 0 1 8 0v2"/></svg>';
const searchIcon =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>';
const detailsFor = (x) =>
  productDetails[x.id] || {
    english: 'Mountain Flow',
    features: [x.pockets ? '口袋設計' : '無口袋'],
    note: x.summary,
  };
const image = (x, eager = false) =>
  `<img src="${productImage(x)}" srcset="/images/products/${x.id}-480.webp 480w, ${productImage(x)} 1120w" sizes="${eager ? '(max-width: 700px) 100vw, 50vw' : '(max-width: 600px) 50vw, (max-width: 1000px) 33vw, 25vw'}" alt="${esc(x.name)}，${esc(x.color)}，${esc(detailsFor(x).features.join('、'))}" width="1120" height="1400" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
const rating = (x) =>
  `<span class="rating" aria-label="${x.rating} 分，滿分 5 分；${x.review_count} 則評價"><span class="star" aria-hidden="true">★</span> ${x.rating.toFixed(1)} <span class="muted">(${x.review_count.toLocaleString('zh-TW')})</span></span>`;

function layout(
  title,
  body,
  {
    active = '',
    description = 'Mountain Flow 山流瑜珈服。找到適合自己的顏色、剪裁與支撐，讓練習自在融入日常。虛構品牌體驗商店。',
  } = {},
) {
  return `<!doctype html><html lang="zh-Hant"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="${esc(description)}"><meta name="theme-color" content="#f8f7f2">
  <title>${esc(title)} · Mountain Flow Yoga</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/styles.css"><script src="/storefront.js" defer></script>
  </head><body><a href="#main" class="skip-link">跳至主要內容</a>
  <div class="announcement"><span>留一點時間，給自己。</span><span class="announcement-right">MOVE WITH YOUR OWN FLOW</span></div>
  <header class="nav"><a class="brand" href="/" aria-label="Mountain Flow 首頁">${mountain}<span>mountain flow<small>YOGA & EVERYDAY</small></span></a>
  <nav aria-label="主要導覽"><a href="/#collection" ${active === 'home' ? 'aria-current="page"' : ''}>全部商品</a><a href="/?category=yoga-pants#collection" ${active === 'pants' ? 'aria-current="page"' : ''}>瑜珈褲</a><a href="/?category=yoga-top#collection" ${active === 'top' ? 'aria-current="page"' : ''}>上衣</a><a href="/about" ${active === 'about' ? 'aria-current="page"' : ''}>關於山流</a></nav>
  <div class="nav-actions"><a href="/#search" class="icon-link" aria-label="搜尋商品">${searchIcon}</a><a class="icon-link" href="/checkout" aria-label="購物袋">${bag}</a></div></header>
  ${body}
  <footer class="foot"><div class="footer-top"><div class="footer-brand"><a class="brand" href="/">${mountain}<span>mountain flow<small>YOGA & EVERYDAY</small></span></a><a class="creator-credit" href="https://github.com/dustynotesai">Built by <span>DustyNotes</span> <span aria-hidden="true">↗</span></a></div><p>練習，是回到自己的路。<br><span class="muted">Find a little room to move.</span></p><div class="footer-links"><a href="/#collection">探索商品 ${arrow}</a><a href="/about">關於山流 ${arrow}</a></div></div>
  <div class="footer-bottom"><span>© 2026 Mountain Flow Yoga · Taipei</span><span>虛構品牌體驗商店 · 商品、圖片與評價為示意 · 付款為測試模式</span><a href="/.well-known/agent-store.json">Agent 入口 ↗</a></div></footer></body></html>`;
}

function card(x) {
  return `<article class="card"><a class="card-image" href="/products/${x.id}" aria-label="查看${esc(x.name)}">${image(x)}
  <div class="badges">${x.platform_pick ? '<span class="badge pick">本店推薦</span>' : ''}${x.sponsored ? '<span class="badge">贊助</span>' : ''}</div>
  <span class="card-cta">探索商品 ${arrow}</span></a>
  <div class="card-heading"><p class="product-english">${esc(detailsFor(x).english)}</p>${rating(x)}</div>
  <h3><a href="/products/${x.id}">${esc(x.name)}</a></h3><p class="card-note">${esc(detailsFor(x).features.join(' · '))}</p>
  <div class="card-bottom"><span class="color-label"><i style="--swatch:${swatches[x.color]}" aria-hidden="true"></i>${esc(x.color)}</span><span class="price">${money(x.price)}</span></div>
  <p class="card-sizes">${Object.entries(x.sizes)
    .map(
      ([s, n]) =>
        `<span class="${n ? '' : 'unavailable'}" ${n ? '' : 'title="此尺寸售完"'}>${s}${n ? '' : '<span class="sr-only"> 售完</span>'}</span>`,
    )
    .join(
      '',
    )}<span class="size-caption">${Object.values(x.sizes).every((n) => n > 0) ? '全尺寸現貨' : '部分尺寸售完'}</span></p></article>`;
}

export function homePage({
  items,
  category,
  filters = {},
  counts = { all: 8, pants: 6, tops: 2 },
}) {
  const active =
    category === 'yoga-pants'
      ? 'pants'
      : category === 'yoga-top'
        ? 'top'
        : 'home';
  const selected = (key, value) => (filters[key] === value ? 'selected' : '');
  const hasFilters =
    filters.q || filters.size || filters.max || filters.pockets || filters.sort;
  const collectionUrl = category
    ? `/?category=${encodeURIComponent(category)}#collection`
    : '/#collection';
  return layout(
    category
      ? category === 'yoga-pants'
        ? '瑜珈褲'
        : '上衣'
      : '給身體，自在的空間',
    `<main id="main">
  ${
    !category && !hasFilters
      ? `<section class="hero"><div class="hero-copy"><p class="eyebrow"><span class="tiny-line"></span> THE EVERYDAY PRACTICE</p><h1>給身體，<br>自在的空間。</h1><p class="hero-en">A little room to flow.</p><p class="hero-description">從清晨的第一個伸展，到下課後的散步。<br>找到陪你自在移動的那一件。</p><a class="btn" href="/#collection">探索日常系列 ${arrow}</a><div class="hero-bottom"><span>01 — THE COLLECTION</span><span>為每一種節奏而做</span></div></div><div class="hero-visual"><img src="/images/studio-hero.webp" alt="穿著霧灰瑜珈服的女性，在陽光灑落的暖色瑜珈空間中伸展" width="1536" height="1024" fetchpriority="high"><span class="hero-image-label">BREATHE. MOVE. REPEAT.</span></div></section>
  <div class="values-strip"><span><b>01</b> 隨心選擇，適合自己的支撐</span><span><b>02</b> 從練習到日常的自然色系</span><span><b>03</b> 尺寸與庫存，一目了然</span></div>`
      : ''
  }
  <section class="wrap collection" id="collection" aria-labelledby="collection-title"><div class="section-heading"><div><p class="eyebrow">MADE FOR YOUR EVERYDAY</p><h2 id="collection-title">${category === 'yoga-pants' ? '自在伸展，從這裡開始。' : category === 'yoga-top' ? '穿上自己的節奏。' : '找到你的日常練習。'}</h2></div><p class="section-aside">不必追趕。<br>照著自己的步調，就很好。</p></div>
  <div class="collection-tabs"><nav aria-label="商品分類"><a href="/#collection" ${active === 'home' ? 'aria-current="page"' : ''}>全部商品 <span>${String(counts.all).padStart(2, '0')}</span></a><a href="/?category=yoga-pants#collection" ${active === 'pants' ? 'aria-current="page"' : ''}>瑜珈褲 <span>${String(counts.pants).padStart(2, '0')}</span></a><a href="/?category=yoga-top#collection" ${active === 'top' ? 'aria-current="page"' : ''}>上衣 <span>${String(counts.tops).padStart(2, '0')}</span></a></nav><span class="result-count" role="status">${items.length} 件商品</span></div>
  <form class="filters" method="get" action="/#collection" role="search" aria-label="篩選商品">${category ? `<input type="hidden" name="category" value="${esc(category)}">` : ''}
  <label class="search-field" for="search">${searchIcon}<input id="search" type="search" name="q" value="${esc(filters.q || '')}" placeholder="搜尋商品或顏色" aria-label="搜尋商品或顏色"></label>
  <label><span class="sr-only">現貨尺寸</span><select name="size" aria-label="現貨尺寸"><option value="">所有尺寸</option>${['S', 'M', 'L', 'XL'].map((s) => `<option ${selected('size', s)} value="${s}">${s} 號有貨</option>`).join('')}</select></label>
  <label><span class="sr-only">最高預算</span><select name="max" aria-label="最高預算"><option value="">所有價格</option>${['1000', '1200', '1500'].map((n) => `<option ${selected('max', n)} value="${n}">${money(Number(n))} 以下</option>`).join('')}</select></label>
  <label class="checkbox-label"><input type="checkbox" name="pockets" value="true" ${filters.pockets ? 'checked' : ''}> 有口袋</label>
  <label class="sort"><span class="sr-only">商品排序</span><select name="sort" aria-label="商品排序"><option value="">預設排序</option><option value="rating" ${selected('sort', 'rating')}>評價最高</option><option value="price-asc" ${selected('sort', 'price-asc')}>價格由低到高</option><option value="price-desc" ${selected('sort', 'price-desc')}>價格由高到低</option></select></label><button class="filter-submit" type="submit">套用篩選</button></form>
  ${hasFilters ? `<div class="filter-summary"><span>目前顯示符合條件的 ${items.length} 件商品</span><a href="${collectionUrl}">清除篩選 ×</a></div>` : ''}
  ${items.length ? `<div class="grid">${items.map(card).join('')}</div>` : `<div class="empty-state"><p class="eyebrow">A LITTLE MORE ROOM</p><h3>還沒有符合條件的商品</h3><p>試試其他顏色、尺寸，或放寬預算。</p><a class="btn" href="${collectionUrl}">清除篩選，探索商品 ${arrow}</a></div>`}
  </section>
  <section class="practice-note wrap"><div><p class="eyebrow">LESS RUSH. MORE YOU.</p><h2>讓練習，<br>成為生活的一部分。</h2></div><div><p>有時是一整堂瑜珈，有時只是深呼吸。<br>山流的日常系列，留給每一個不同狀態的你。</p><a class="text-link" href="/about">認識 Mountain Flow ${arrow}</a></div><span class="practice-mark" aria-hidden="true">${mountain}</span></section>
  </main>`,
    { active },
  );
}

export function productPage(x, { error = '' } = {}) {
  const detail = detailsFor(x);
  const inStock = Object.values(x.sizes).some((n) => n > 0);
  const sizes = Object.entries(x.sizes)
    .map(
      ([s, n]) =>
        `<label class="size ${n ? '' : 'sold'}"><input type="radio" name="size" value="${s}" data-stock="${n}" ${n ? '' : 'disabled'} required><span>${s}</span>${n ? '' : '<small>售完</small>'}</label>`,
    )
    .join('');
  return layout(
    x.name,
    `<main id="main" class="wrap product-page"><nav class="breadcrumb" aria-label="麵包屑"><a href="/#collection">全部商品</a><span>/</span><a href="/?category=${x.category}#collection">${x.category === 'yoga-pants' ? '瑜珈褲' : '上衣'}</a><span>/</span><span>${esc(x.name)}</span></nav>
  <div class="product"><figure class="product-photo">${image(x, true)}<figcaption>色彩與剪裁示意 · AI 生成商品圖片</figcaption></figure>
  <div class="pinfo"><p class="eyebrow">${esc(detail.english)} / ${x.id.toUpperCase()}</p><h1>${esc(x.name)}</h1><p class="product-intro">${esc(detail.note)}</p><div class="product-rating">${rating(x)}<span class="small muted">示意評價</span></div><p class="price big">${money(x.price)}</p>
  <div class="product-color"><span>顏色</span><span class="color-label"><i style="--swatch:${swatches[x.color]}" aria-hidden="true"></i>${esc(x.color)}</span></div><p class="description">${esc(x.description)}</p>
  <ul class="feature-list">${detail.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
  ${error ? `<p class="err" role="alert">${esc(error)}</p>` : ''}
  <form method="post" action="/checkout" class="product-form"><input type="hidden" name="id" value="${x.id}"><fieldset><legend>選擇尺寸 <span>請依平常穿著選擇</span></legend><div class="sizes">${sizes}</div></fieldset><p class="stock-note" role="status">${inStock ? '選擇尺寸，查看現貨數量。' : '此商品目前全尺寸售完。'}</p><button class="btn buy-button" type="submit" ${inStock ? '' : 'disabled'}>${bag} ${inStock ? '選購此款 · 前往結帳' : '暫時售完'} ${arrow}</button><p class="checkout-hint">單件快速結帳 · 測試模式不會實際扣款</p></form>
  <details class="specs" open><summary>材質與設計 <span>+</span></summary><p>${esc(x.material)}</p><p>${esc(detail.features.join(' · '))}</p></details><details class="specs"><summary>尺寸與購買須知 <span>+</span></summary><p>此為虛構商品，未提供實際公分尺寸表。售完尺寸無法選購；庫存以結帳時為準。每次可選購一件，購物袋會保留這次選擇。</p></details></div></div>
  <a class="text-link back-link" href="/?category=${x.category}#collection">← 繼續探索${x.category === 'yoga-pants' ? '瑜珈褲' : '上衣'}</a></main>`,
    { description: x.summary },
  );
}

export function checkoutPage({ product, size, error, buyer = {} }) {
  if (!product)
    return layout(
      '購物袋',
      `<main id="main" class="wrap empty-state"><span class="empty-icon">${bag}</span><p class="eyebrow">YOUR EVERYDAY STARTS HERE</p><h1>購物袋還空著。</h1><p>${error ? esc(error) : '慢慢挑，找到適合你的那一件。'}</p><a class="btn" href="/#collection">探索日常系列 ${arrow}</a></main>`,
    );
  return layout(
    '結帳',
    `<main id="main" class="wrap checkout"><a class="text-link" href="/products/${product.id}">← 返回商品，修改尺寸</a><div class="checkout-heading"><p class="eyebrow">A LITTLE CLOSER TO YOUR FLOW</p><h1>準備好，開始你的練習。</h1></div><ol class="checkout-steps"><li class="complete">01 選擇商品</li><li aria-current="step">02 收件與付款</li><li>03 完成訂單</li></ol>
  ${error ? `<p class="err" role="alert">${esc(error)}</p>` : ''}<div class="co-grid"><form method="post" action="/checkout/complete"><input type="hidden" name="id" value="${product.id}"><input type="hidden" name="size" value="${esc(size)}">
  <h2><span>01</span> 收件資料</h2><p class="muted small">體驗結帳時，請使用虛構資料。</p><label>姓名<input name="name" required autocomplete="name" maxlength="100" value="${esc(buyer.name || '')}" placeholder="收件人姓名"></label><label>電話<input type="tel" name="phone" required autocomplete="tel" maxlength="40" value="${esc(buyer.phone || '')}" placeholder="0912 345 678"></label><label>地址<input name="address" required autocomplete="street-address" maxlength="300" value="${esc(buyer.address || '')}" placeholder="縣市、區域、路名與門牌"></label>
  <h2 class="payment-title"><span>02</span> 測試付款</h2><div class="test-payment"><strong>模擬結帳，不會實際扣款</strong><p>使用測試卡號 4242 4242 4242 4242，請勿輸入真實信用卡資料。</p></div><label>測試卡號<input name="card" required inputmode="numeric" placeholder="4242 4242 4242 4242" autocomplete="off" maxlength="23"></label><div class="two"><label>到期年月<input name="exp" required placeholder="12/28" autocomplete="off" maxlength="7"></label><label>CVC<input name="cvc" required placeholder="123" inputmode="numeric" autocomplete="off" pattern="[0-9]{3,4}" maxlength="4"></label></div><button class="btn checkout-button" type="submit">確認測試付款 ${money(product.price)} ${arrow}</button></form>
  <aside class="order-summary"><h2>你的選擇</h2><div class="summary-product">${image(product)}<div><p class="product-english">${esc(detailsFor(product).english)}</p><h3>${esc(product.name)}</h3><p>${esc(product.color)} / ${esc(size)} 號 / 1 件</p><a class="text-link small" href="/products/${product.id}">修改尺寸</a></div></div><dl><div><dt>商品小計</dt><dd>${money(product.price)}</dd></div><div><dt>運費</dt><dd>NT$ 0</dd></div><div class="total"><dt>合計</dt><dd>${money(product.price)}</dd></div></dl><p class="muted small">所有金額以新台幣計價。此為單件快速結帳。</p></aside></div></main>`,
  );
}

export function donePage(order) {
  return layout(
    '訂單完成',
    `<main id="main" class="wrap empty-state"><span class="success-mark" aria-hidden="true">✓</span><p class="eyebrow">SEE YOU ON THE MAT</p><h1>下一次練習見。</h1><p>你的測試訂單已成立，沒有實際扣款。</p><p class="order-id">訂單編號 <code>${esc(order.id)}</code></p><a class="btn" href="/#collection">繼續逛逛 ${arrow}</a></main>`,
  );
}

export function aboutPage() {
  return layout(
    '關於山流',
    `<main id="main" class="wrap about-page"><div class="about-copy"><p class="eyebrow">OUR LITTLE PRACTICE</p><h1>練習，<br>是回到自己的路。</h1><p class="hero-en">Find your own flow.</p><p>Mountain Flow 山流，是由 <a class="creator-name" href="https://github.com/dustynotesai">DustyNotes</a> 為影片打造的虛構瑜珈服品牌。我們把一間店做成兩種體驗：讓人透過畫面與文字挑選，也讓 AI 透過結構化資料找到商品。</p><p>你正在逛的是給人的那扇門。這裡的商品、圖片和評價都是示意，結帳使用測試模式，不會實際扣款或出貨。</p><a class="btn" href="/#collection">探索日常系列 ${arrow}</a></div><img class="about-image" src="/images/studio-hero.webp" width="1536" height="1024" alt="溫暖安靜的瑜珈練習空間"></main>`,
    { active: 'about' },
  );
}

export function notFoundPage() {
  return layout(
    '找不到商品',
    `<main id="main" class="wrap empty-state"><p class="eyebrow">404 / A DIFFERENT PATH</p><h1>這件商品不在這裡。</h1><p>回到系列，找找其他適合你的選擇。</p><a class="btn" href="/#collection">探索商品 ${arrow}</a></main>`,
  );
}

export function homeMarkdown({ items, category }) {
  return (
    `# Mountain Flow Yoga${category ? ` · ${category}` : ''}\n\n` +
    items
      .map(
        (x) =>
          `- [${x.name}](/products/${x.id}) — ${money(x.price)} · ${x.rating}★ (${x.review_count})${x.platform_pick ? ' · 本店推薦' : ''}${x.sponsored ? ' · 贊助' : ''}`,
      )
      .join('\n') +
    '\n'
  );
}
export function productMarkdown(x) {
  const sizes = Object.entries(x.sizes)
    .map(([s, n]) => `${s}${n ? '' : '（售完）'}`)
    .join('、');
  return `# ${x.name}\n\n${money(x.price)} · ${x.rating}★（${x.review_count} 則）· ${x.color}\n\n${x.description}\n\n- 尺寸：${sizes}\n- ${x.pockets ? '口袋設計' : '無口袋設計'}\n- ${x.material}\n`;
}
