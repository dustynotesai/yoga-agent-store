import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  filterCatalog,
  productDetails,
  productImage,
} from '../src/presentation.js';
import { homePage, productPage } from '../src/views.js';

const products = JSON.parse(
  fs.readFileSync(new URL('../data/products.json', import.meta.url), 'utf8'),
);

test('M-size pocket leggings within NT$1,200 exclude sold-out and over-budget choices', () => {
  const pants = products.filter((p) => p.category === 'yoga-pants');
  const { items } = filterCatalog(pants, {
    size: 'M',
    pockets: 'true',
    max: '1200',
    sort: 'rating',
  });
  assert.deepEqual(
    items.map((p) => p.id),
    ['yp-02', 'yp-05'],
  );
  assert.equal(products[0].sizes.M, 0);
});

test('search supports catalog colors and product names with a useful empty state', () => {
  assert.deepEqual(
    filterCatalog(products, { q: '霧灰' }).items.map((p) => p.id),
    ['yp-01', 'yt-01'],
  );
  assert.deepEqual(
    filterCatalog(products, { q: ' slow morning ' }).items.map((p) => p.id),
    ['yt-02'],
  );
  const result = filterCatalog(products, { q: '不存在的商品' });
  assert.equal(result.items.length, 0);
  assert.match(homePage(result), /還沒有符合條件的商品/);
});

test('sorting does not mutate the experiment catalog order', () => {
  const before = products.map((p) => p.id);
  const { items } = filterCatalog(products, { sort: 'price-asc' });
  assert.equal(items[0].id, 'yp-06');
  assert.equal(items.at(-1).id, 'yp-04');
  assert.deepEqual(
    products.map((p) => p.id),
    before,
  );
});

test('every product has its own real WebP image and responsive thumbnail', () => {
  assert.equal(new Set(products.map(productImage)).size, products.length);
  for (const p of products) {
    assert.ok(productDetails[p.id]);
    for (const suffix of ['', '-480']) {
      const file = new URL(
        `../public/images/products/${p.id}${suffix}.webp`,
        import.meta.url,
      );
      const bytes = fs.readFileSync(file);
      assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
      assert.ok(bytes.length > 1000);
    }
  }
});

test('tops do not inherit leggings features or unsupported manufacturing claims', () => {
  for (const p of products.filter((p) => p.category === 'yoga-top')) {
    const html = productPage(p);
    assert.doesNotMatch(html, /高腰剪裁|台灣製造|四向彈性/);
    assert.match(html, /AI 生成商品圖片/);
    assert.match(html, new RegExp(productImage(p)));
  }
  assert.match(productPage(products.find((p) => p.id === 'yt-02')), /95% 棉/);
});

test('sold-out sizes cannot be selected and filter input is escaped', () => {
  assert.match(
    productPage(products[0]),
    /name="size" value="M" data-stock="0" disabled/,
  );
  const html = homePage({
    items: [],
    filters: { q: '"><script>alert(1)</script>' },
  });
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
});
