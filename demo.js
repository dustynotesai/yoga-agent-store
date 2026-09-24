import * as V from './views.js';
import { filterCatalog } from './presentation.js';
import { demoPage, demoUrl } from './demo-page.js';
import initialProducts from './catalog.js';

const base = new URL('.', import.meta.url).pathname;
const storageKey = 'mountain-flow-demo-v1';
let state = { bag: null, purchased: {} };
try {
  const saved = JSON.parse(sessionStorage.getItem(storageKey));
  if (saved && typeof saved.purchased === 'object' && saved.purchased) state = saved;
} catch { /* Storage may be disabled; the demo still works in this tab. */ }
const save = () => { try { sessionStorage.setItem(storageKey, JSON.stringify(state)); } catch {} };
const products = () => initialProducts.map(p => ({ ...p, sizes: Object.fromEntries(Object.entries(p.sizes).map(([size, n]) => [size, Math.max(0, n - (Number(state.purchased[`${p.id}:${size}`]) || 0))])) }));

function navigate(url) {
  history.pushState(null, '', url);
  render();
  document.querySelector('h1, h2')?.focus({ preventScroll: true });
}

function render() {
  const query = Object.fromEntries(new URLSearchParams(location.search));
  const catalog = products();
  let html;
  if (query.page === 'product') {
    const product = catalog.find(p => p.id === query.id);
    html = product ? V.productPage(product) : V.notFoundPage();
  } else if (query.page === 'about') html = V.aboutPage();
  else if (query.page === 'checkout') {
    const product = catalog.find(p => p.id === state.bag?.id);
    const size = state.bag?.size;
    html = state.bag?.orderId ? V.donePage({ id: state.bag.orderId }) : V.checkoutPage({ product: product && product.sizes[size] > 0 ? product : undefined, size });
  } else {
    const category = ['yoga-pants', 'yoga-top'].includes(query.category) ? query.category : '';
    const filtered = filterCatalog(category ? catalog.filter(p => p.category === category) : catalog, query);
    html = V.homePage({ ...filtered, category });
  }
  const doc = new DOMParser().parseFromString(demoPage(html, base), 'text/html');
  document.title = doc.title;
  document.body.replaceChildren(...doc.body.childNodes);
  const heading = document.querySelector('h1, h2');
  heading?.setAttribute('tabindex', '-1');
  const announcement = document.querySelector('.announcement > span');
  announcement.textContent = 'DustyNotes 影片體驗店 · 模擬購物，不會扣款或出貨';
  const checkoutForm = document.querySelector('.co-grid form');
  if (checkoutForm) {
    checkoutForm.dataset.demoComplete = 'true';
    checkoutForm.innerHTML = `<h2><span>01</span> 示範收件資料</h2><p class="muted small">這次體驗使用下方的虛構資料，不需要填寫個人資訊。</p>
      <label>姓名<input value="體驗訪客" readonly aria-readonly="true"></label>
      <label>電話<input value="0900 000 000" readonly aria-readonly="true"></label>
      <label>地址<input value="台北市 · 示範地址" readonly aria-readonly="true"></label>
      <h2 class="payment-title"><span>02</span> 模擬付款</h2><div class="test-payment"><strong>體驗到這裡，只差最後一步。</strong><p>確認商品與金額後，按下按鈕即可產生模擬訂單。不會扣款，也不會出貨。</p></div>
      <button class="btn checkout-button" type="submit">確認模擬訂單</button>`;
  }
  document.querySelector('.product-form')?.addEventListener('change', event => {
    if (event.target.name === 'size') {
      const status = document.querySelector('.stock-note');
      status.textContent = `${event.target.value} 號 · 現貨 ${event.target.dataset.stock} 件`;
      status.classList.add('available');
    }
  });
  // Hash targets are known storefront anchors; avoid CSS selectors from user input.
  const anchor = document.getElementById(location.hash.slice(1));
  if (anchor) anchor.scrollIntoView({ behavior: 'instant' }); else window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
}

document.addEventListener('click', event => {
  const link = event.target.closest('a');
  if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.target || link.hasAttribute('download')) return;
  const url = new URL(link.href);
  if (url.origin === location.origin && url.pathname === base) {
    event.preventDefault(); navigate(url);
  }
});

document.addEventListener('submit', event => {
  event.preventDefault();
  const form = event.target;
  if (form.matches('.filters')) {
    navigate(`${base}?${new URLSearchParams(new FormData(form))}#collection`);
  } else if (form.matches('.product-form')) {
    const fields = Object.fromEntries(new FormData(form));
    const product = products().find(p => p.id === fields.id);
    if (!product || !Object.hasOwn(product.sizes, fields.size) || product.sizes[fields.size] <= 0) return;
    state.bag = { id: product.id, size: fields.size }; save();
    navigate(demoUrl('/checkout', base));
  } else if (form.dataset.demoComplete) {
    if (state.bag && !state.bag.orderId) {
      const product = products().find(p => p.id === state.bag.id);
      if (!product || !(product.sizes[state.bag.size] > 0)) return render();
      const key = `${state.bag.id}:${state.bag.size}`;
      state.purchased[key] = (Number(state.purchased[key]) || 0) + 1;
      state.bag.orderId = 'demo_' + crypto.randomUUID().slice(0, 8);
      save();
    }
    render();
    document.querySelector('h1')?.focus({ preventScroll: true });
  }
});
window.addEventListener('popstate', render);
render();
