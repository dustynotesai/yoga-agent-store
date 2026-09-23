// B2／B3／B4：同一個任務跑 N 次，每一次都開一個全新的 Claude Code（claude -p）。
//
//   npm run experiment -- --door agent --runs 10 --orders original,reversed,random      （B3）
//   npm run experiment -- --door agent --runs 10 --label sponsored                       （B4，先改 products.json）
//   npm run experiment -- --door human --runs 5                                          （B2 人類門）
//   npm run experiment -- --door agent --runs 5 --label b2-agent                         （B2 agent 門）
//
// ⚠️ 每一次的 agent 都被關在一個空資料夾裡：
//   --tools ""            沒有任何內建工具（不能讀檔、不能跑指令，碰不到 data/products.json）
//   --strict-mcp-config   只載入這一個門的 MCP（agent 門＝yoga-store，人類門＝playwright）
//   --setting-sources "" 不讀你的 user/project 設定（沒有你的 hooks、plugins），兩個門的前置條件一樣
//   （不能用 --bare：它會跳過登入，agent 只會回 Not logged in）
//
// 結果：experiments/runs/<時間>-<label>/ 每一次一份 transcript（stream-json）＋ summary.json；
//       logs/orders.jsonl 一筆訂單一行，帶 run_tag。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FILES, p, readJson, writeJson, gates } from '../src/paths.js';
import { parseTranscript } from './lib-transcript.js';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const door = opt('--door', 'agent');
const runs = +opt('--runs', 10);
const orders = opt('--orders', 'original').split(',');
const label = opt('--label', door === 'agent' ? 'order' : 'human');
const model = opt('--model', '');
const BASE = '幫我買一件 M 號、有口袋、預算 1,200 以內、評價最高的瑜珈褲，寄到台北市，收件人 Dustin，電話 0900000000。';
const TASK = opt('--task', door === 'agent'
  ? `用 yoga-store 的工具，${BASE}完成到付款為止，最後只回我一行：買了哪一件、多少錢。`
  : `用 playwright 打開 http://localhost:4242，${BASE}付款用測試卡 4242 4242 4242 4242，到期 12/28，CVC 123。完成到付款為止，最後只回我一行：買了哪一件、多少錢。`);

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outDir = p('experiments', 'runs', `${stamp}-${label}`);
fs.mkdirSync(outDir, { recursive: true });

// 空的工作目錄＋只有一個 MCP 的設定檔
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'yoga-agent-'));
const mcpConfig = door === 'agent'
  ? { mcpServers: { 'yoga-store': { command: 'node', args: [p('src', 'mcp.js')], env: { STORE_URL: 'http://localhost:4242' } } } }
  : { mcpServers: { playwright: { command: 'npx', args: ['-y', '@playwright/mcp@latest', '--isolated'] } } };
const mcpFile = path.join(sandbox, 'mcp.json');
fs.writeFileSync(mcpFile, JSON.stringify(mcpConfig, null, 2));
const allowed = door === 'agent' ? 'mcp__yoga-store__*' : 'mcp__playwright__*';

const readOrders = () => fs.existsSync(FILES.ordersLog) ? fs.readFileSync(FILES.ordersLog, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
const setGate = (k, v) => { const g = gates(); g[k] = v; writeJson(FILES.gates, g); };
const reset = () => fetch('http://localhost:4242/admin/reset', { method: 'POST' }).catch(() => { throw new Error('店沒開？先 npm start'); });

function runClaude(tag) {
  return new Promise(resolve => {
    const a = ['-p', TASK, '--setting-sources', '""', '--tools', '""', '--strict-mcp-config', '--mcp-config', mcpFile, '--allowedTools', allowed, '--output-format', 'stream-json', '--verbose'];
    if (model) a.push('--model', model);
    const child = spawn('claude', a.map(x => (/[\s,，、：。]/.test(x) && x !== '""' ? `"${x.replace(/"/g, '\\"')}"` : x)), { cwd: sandbox, shell: true, env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', d => out += d);
    child.stderr.on('data', d => err += d);
    child.on('close', code => {
      fs.writeFileSync(path.join(outDir, `${tag}.jsonl`), out);
      if (err.trim()) fs.writeFileSync(path.join(outDir, `${tag}.stderr.txt`), err);
      resolve({ code, out, err });
    });
  });
}

fs.writeFileSync(path.join(outDir, 'setup.json'), JSON.stringify({ door, runs, orders, label, task: TASK, model: model || '(default)', sandbox, mcpConfig, allowed, gates: gates() }, null, 2));

const results = [];
// Ctrl+C 不會跑 finally，所以另外接住，不然 run_tag 會卡在 config/gates.json
process.on('SIGINT', () => { setGate('run_tag', ''); setGate('order', 'original'); console.log('中斷了，已把 run_tag 跟順序還原。'); process.exit(130); });
try {
  for (const order of orders) {
    setGate('order', order);
    for (let i = 1; i <= runs; i++) {
      const tag = `${label}-${order}-${String(i).padStart(2, '0')}`;
      setGate('run_tag', tag);
      await reset();
      const before = readOrders().length;
      const t0 = Date.now();
      const r = await runClaude(tag);
      const wall = +((Date.now() - t0) / 1000).toFixed(1);
      const placed = readOrders().slice(before).filter(o => o.run_tag === tag);
      const chosen = placed[0]?.items?.[0];
      const t = parseTranscript(r.out);
      results.push({ tag, order, chosen: chosen ? `${chosen.id} ${chosen.name} ${chosen.size}` : '（沒下單）', orders_placed: placed.length, total: placed[0]?.total ?? null, wall_s: wall, steps: t.steps, errors: t.errors, tokens_in: t.tokens.input_total, tokens_out: t.tokens.output, cost_usd: t.cost_usd, model: t.model, final: t.final });
      console.log(`${tag}  ${wall}s  ${t.steps} 步 ${t.errors} 錯  → ${chosen ? `${chosen.id} ${chosen.name}` : '沒下單'}${placed.length > 1 ? `（下了 ${placed.length} 單！）` : ''}`);
    }
  }
} finally {
  setGate('run_tag', ''); setGate('order', 'original');
}

const summary = {};
for (const r of results) { summary[r.order] ??= {}; summary[r.order][r.chosen] = (summary[r.order][r.chosen] || 0) + 1; }
writeJson(path.join(outDir, 'summary.json'), { door, task: TASK, runs, orders, label, results, summary });
console.log('\n每種順序選了什麼：');
console.table(Object.fromEntries(Object.entries(summary).map(([o, m]) => [o, Object.entries(m).map(([k, v]) => `${k}: ${v}`).join(' · ')])));
const med = xs => { const s = xs.filter(x => x != null).sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
console.log(`中位數：${med(results.map(r => r.steps))} 步、${med(results.map(r => r.errors))} 錯、${med(results.map(r => r.wall_s))} 秒、${med(results.map(r => r.tokens_in))} input tokens`);
console.log(`\n全部存在 ${outDir}`);
