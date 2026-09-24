// Explicit asset allowlist: never publish server code, keys, registries or logs.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../src/paths.js';
import { homePage } from '../src/views.js';
import { demoPage } from '../src/demo-page.js';

const base = process.env.BASE_PATH || '/yoga-agent-store/';
if (!/^(?:\/[a-zA-Z0-9_-]+)*\/$/.test(base)) throw new Error('BASE_PATH must be a root-relative directory path');
const output = path.resolve(ROOT, 'dist');
if (path.dirname(output) !== ROOT || path.basename(output) !== 'dist') throw new Error('Invalid output directory');
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
for (const name of ['styles.css', 'favicon.svg', 'images', 'demo.js']) fs.cpSync(path.join(ROOT, 'public', name), path.join(output, name), { recursive: true });
for (const name of ['views.js', 'presentation.js', 'demo-page.js']) fs.copyFileSync(path.join(ROOT, 'src', name), path.join(output, name));
const products = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/products.json'), 'utf8'));
fs.writeFileSync(path.join(output, 'catalog.js'), `export default ${JSON.stringify(products)};\n`);
const html = demoPage(homePage({ items: products }), base).replace('</body>', `<noscript><p class="wrap">請開啟 JavaScript，即可使用商品篩選與模擬結帳。</p></noscript><script type="module" src="${base}demo.js"></script></body>`);
fs.writeFileSync(path.join(output, 'index.html'), html);
fs.writeFileSync(path.join(output, '.nojekyll'), '');
console.log(`Built browser demo: dist/ (base ${base})`);
