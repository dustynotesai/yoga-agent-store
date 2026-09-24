// Adapt the shared storefront templates to a GitHub Pages project subdirectory.
export function demoUrl(value, base) {
  if (!value.startsWith('/')) return value;
  const url = new URL(value, 'https://demo.invalid');
  const query = new URLSearchParams(url.search);
  if (url.pathname.startsWith('/products/')) {
    query.set('page', 'product'); query.set('id', url.pathname.split('/')[2]);
  } else if (url.pathname === '/about') query.set('page', 'about');
  else if (url.pathname.startsWith('/checkout')) query.set('page', 'checkout');
  else if (url.pathname === '/.well-known/agent-store.json') return 'https://github.com/dustynotesai/yoga-agent-store/blob/main/docs/VIEWER-GUIDE.md';
  else if (url.pathname !== '/') return base + value.slice(1);
  return base + (query.size ? `?${query}` : '') + url.hash;
}

export function demoPage(html, base) {
  return html
    .replace('<script src="/storefront.js" defer></script>', '')
    .replace(/(href|src|action)="(\/[^\"]*)"/g, (_match, attr, value) => `${attr}="${demoUrl(value, base)}"`)
    .replace(/srcset="([^"]*)"/g, (_match, value) => `srcset="${value.replaceAll('/images/', `${base}images/`)}"`)
    .replace('Agent 入口 ↗', 'AI 工具教學 ↗');
}
