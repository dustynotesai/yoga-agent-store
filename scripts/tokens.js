// B1：同一間店，人類門 vs markdown 版 vs agent 門，各多少 token。店要先開著。
// ⚠️ 用的是 OpenAI 的 tokenizer（gpt-tokenizer）估算。Claude 的實際用量以 Claude Code 跑完的 usage 為準；倍數大致相同。
import { encode } from 'gpt-tokenizer';
import { call, STORE_URL } from '../src/client.js';

const t = s => encode(s).length;
const get = async (path, accept) => (await fetch(STORE_URL + path, { headers: { accept } })).text();

const rows = [];
async function page(label, path, agentPath) {
  const html = await get(path, 'text/html');
  const md = await get(path, 'text/markdown');
  const agent = agentPath ? (await call('GET', agentPath)).json : null;
  rows.push({ 頁面: label, 'HTML（人類門）': t(html), 'markdown（Accept 協商）': t(md), 'JSON（agent 門）': agent ? t(JSON.stringify(agent)) : '-' });
}

await page('首頁（全部商品）', '/', '/agent/products');
await page('瑜珈褲列表', '/?category=yoga-pants', '/agent/products?category=yoga-pants');
const ids = ['yp-01', 'yp-02', 'yp-03', 'yp-04', 'yp-05', 'yp-06'];
for (const id of ids) await page(`商品頁 ${id}`, `/products/${id}`, `/agent/products/${id}`);

console.table(rows);
const sum = k => rows.reduce((a, r) => a + (+r[k] || 0), 0);
const h = sum('HTML（人類門）'), m = sum('markdown（Accept 協商）'), a = sum('JSON（agent 門）');
console.log(`\n一個「看完列表＋六件商品頁」的任務：`);
console.log(`  人類門 HTML   ${h.toLocaleString()} tokens`);
console.log(`  markdown 版   ${m.toLocaleString()} tokens   （HTML 的 ${(h / m).toFixed(1)} 倍）`);
console.log(`  agent 門 JSON ${a.toLocaleString()} tokens   （HTML 的 ${(h / a).toFixed(1)} 倍）`);
console.log(`\n注意：agent 門一個請求就拿到六件的全部欄位，人類門要開七頁。上面 JSON 那欄是把六個 GET /products/{id} 也算進去的保守值。`);
