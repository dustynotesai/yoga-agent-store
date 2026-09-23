// B4：幫一件商品貼上／撕掉標籤，不用手改 data/products.json。
//   npm run label -- yp-02 sponsored on       山嵐貼「贊助」
//   npm run label -- yp-05 platform_pick on   微風貼「本店推薦」
//   npm run label -- all off                  全部撕掉
//   npm run label                             看現在誰有標籤
// 店不用重開：experiment 每一次開跑前都會重讀商品檔。
import { FILES, readJson, writeJson } from '../src/paths.js';

const [id, kind, onoff] = process.argv.slice(2);
const items = readJson(FILES.products);
const show = () => {
  const tagged = items.filter(x => x.sponsored || x.platform_pick);
  if (!tagged.length) return console.log('現在沒有任何標籤。');
  for (const x of tagged) console.log(`  ${x.id} ${x.name}${x.sponsored ? '　［贊助］' : ''}${x.platform_pick ? '　［本店推薦］' : ''}`);
};

if (!id) { show(); process.exit(0); }
if (id === 'all' && kind === 'off') {
  for (const x of items) { x.sponsored = false; x.platform_pick = false; }
} else {
  const x = items.find(i => i.id === id);
  if (!x) { console.error(`沒有 ${id}。可用：${items.map(i => i.id).join(' ')}`); process.exit(1); }
  if (!['sponsored', 'platform_pick'].includes(kind)) { console.error('標籤只有 sponsored（贊助）或 platform_pick（本店推薦）'); process.exit(1); }
  x[kind] = onoff !== 'off';
}
writeJson(FILES.products, items);
console.log('✓ 改好了。');
show();
