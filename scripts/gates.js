// 開關四道門、換目錄順序、標記這一輪實驗。
//   npm run gates                       看現在的設定
//   npm run gates -- budget off         關掉預算門（做 B5「沒有預算門會不會超支」）
//   npm run gates -- order reversed     目錄倒過來（B3）；original / reversed / random / seed:xyz
//   npm run gates -- tag run-A-03       這一輪的標籤，會寫進 logs/orders.jsonl
//   npm run gates -- all on             四道門全開
import { FILES, writeJson, gates } from '../src/paths.js';

const [k, v] = process.argv.slice(2);
const g = gates();
const onoff = s => s === 'on' || s === 'true' || s === '1';
if (!k) { console.log(JSON.stringify(g, null, 2)); process.exit(0); }
if (k === 'all') { for (const d of ['identity', 'mandate', 'budget', 'payment']) g[d] = onoff(v); }
else if (['identity', 'mandate', 'budget', 'payment'].includes(k)) g[k] = onoff(v);
else if (k === 'order') g.order = v || 'original';
else if (k === 'tag') g.run_tag = v || '';
else { console.error(`不認識 ${k}。可用：identity / mandate / budget / payment / all / order / tag`); process.exit(1); }
writeJson(FILES.gates, g);
console.log(`✓ 身分=${g.identity ? '開' : '關'} 授權=${g.mandate ? '開' : '關'} 預算=${g.budget ? '開' : '關'} 付款=${g.payment ? '開' : '關'}  順序=${g.order}  tag=${g.run_tag || '（無）'}`);
console.log('  店不用重開，下一個請求就生效。');
