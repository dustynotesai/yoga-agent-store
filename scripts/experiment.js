// B3／B4：同一個任務、同一份目錄，換順序（或加標籤）各跑 N 次，看 Claude Code 選了哪一件。
// 每一次都是真的開一個 Claude Code（claude -p）走 MCP 後門，所以「agent」就是你平常用的那一個。
//
//   npm run experiment -- --runs 10 --orders original,reversed,random
//   npm run experiment -- --runs 10 --orders original --label sponsored   （先自己把 products.json 某件的 sponsored 改成 true）
//
// 結果：experiments/runs/<時間>/summary.json ＋ 每一次的 transcript；logs/orders.jsonl 也有一行一筆。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { FILES, p, readJson, writeJson, gates } from '../src/paths.js';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const runs = +opt('--runs', 10);
const orders = opt('--orders', 'original,reversed,random').split(',');
const label = opt('--label', 'order');
const model = opt('--model', '');
const TASK = opt('--task', '幫我買一件 M 號、有口袋、預算 1,200 以內、評價最高的瑜珈褲，寄到台北市，收件人 Dustin，電話 0900000000。用 yoga-store 的工具完成到付款為止，最後只回我一行：買了哪一件、多少錢。');

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outDir = p('experiments', 'runs', `${stamp}-${label}`);
fs.mkdirSync(outDir, { recursive: true });

const readOrders = () => fs.existsSync(FILES.ordersLog) ? fs.readFileSync(FILES.ordersLog, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
const setGate = (k, v) => { const g = gates(); g[k] = v; writeJson(FILES.gates, g); };
const reset = () => fetch('http://localhost:4242/admin/reset', { method: 'POST' }).catch(() => {});

function runClaude(tag) {
  return new Promise(resolve => {
    const a = ['-p', TASK, '--output-format', 'json', '--dangerously-skip-permissions', '--mcp-config', '.mcp.json', '--allowedTools', 'mcp__yoga-store__*'];
    if (model) a.push('--model', model);
    const child = spawn('claude', a, { cwd: p(), shell: true, env: { ...process.env } });
    let out = '', err = '';
    child.stdout.on('data', d => out += d);
    child.stderr.on('data', d => err += d);
    child.on('close', code => { fs.writeFileSync(p(outDir, `${tag}.json`), out || err); resolve({ code, out, err }); });
  });
}

const results = [];
for (const order of orders) {
  setGate('order', order);
  for (let i = 1; i <= runs; i++) {
    const tag = `${label}-${order}-${String(i).padStart(2, '0')}`;
    setGate('run_tag', tag);
    await reset();
    const before = readOrders().length;
    const t0 = Date.now();
    const r = await runClaude(tag);
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    const placed = readOrders().slice(before).filter(o => o.run_tag === tag);
    const chosen = placed[0]?.items?.[0];
    let usage = null; try { const j = JSON.parse(r.out); usage = { cost_usd: j.total_cost_usd, turns: j.num_turns, duration_ms: j.duration_ms }; } catch {}
    results.push({ tag, order, chosen: chosen ? `${chosen.id} ${chosen.name} ${chosen.size}` : '（沒下單）', total: placed[0]?.total ?? null, secs, ...usage });
    console.log(`${tag}  ${secs}s  → ${chosen ? `${chosen.id} ${chosen.name}` : '沒下單'}${usage ? `  (${usage.turns} turns, $${usage.cost_usd?.toFixed(3)})` : ''}`);
  }
}
setGate('run_tag', ''); setGate('order', 'original');

const summary = {};
for (const r of results) { summary[r.order] ??= {}; summary[r.order][r.chosen] = (summary[r.order][r.chosen] || 0) + 1; }
writeJson(p(outDir, 'summary.json'), { task: TASK, runs, orders, label, results, summary });
console.log('\n每種順序選了什麼：');
console.table(Object.fromEntries(Object.entries(summary).map(([o, m]) => [o, Object.entries(m).map(([k, v]) => `${k}: ${v}`).join(' · ')])));
console.log(`\n全部存在 ${outDir}`);
