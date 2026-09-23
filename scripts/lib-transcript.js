// 讀 `claude -p --output-format stream-json --verbose` 的逐行紀錄，算出 B2 要的數字：
// 幾步（工具呼叫次數）、失敗幾次（工具回傳 is_error）、每一步呼叫了什麼、最後的回覆、時間、token。
import fs from 'node:fs';

export function parseTranscript(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const events = [];
  for (const l of lines) { try { events.push(JSON.parse(l)); } catch { /* 非 JSON 行略過 */ } }

  const steps = [];
  const byId = new Map();
  let init = null, result = null;
  for (const e of events) {
    if (e.type === 'system' && e.subtype === 'init') init = e;
    if (e.type === 'result') result = e;
    const content = e.message?.content;
    if (!Array.isArray(content)) continue;
    for (const c of content) {
      if (e.type === 'assistant' && c.type === 'tool_use') {
        const step = { n: steps.length + 1, tool: c.name.replace(/^mcp__[^_]+__/, ''), input: c.input, error: false };
        steps.push(step); byId.set(c.id, step);
      }
      if (e.type === 'user' && c.type === 'tool_result') {
        const step = byId.get(c.tool_use_id);
        if (!step) continue;
        const txt = Array.isArray(c.content) ? c.content.map(x => x.text || '').join('') : String(c.content ?? '');
        step.error = !!c.is_error;
        step.result_chars = txt.length;
        if (c.is_error) step.error_text = txt.slice(0, 300);
      }
    }
  }
  const u = result?.usage || {};
  const inputTotal = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
  return {
    model: init?.model || Object.keys(result?.modelUsage || {})[0] || null,
    tools_available: init?.tools?.length ?? null,
    steps: steps.length,
    errors: steps.filter(s => s.error).length,
    turns: result?.num_turns ?? null,
    duration_s: result?.duration_ms ? +(result.duration_ms / 1000).toFixed(1) : null,
    cost_usd: result?.total_cost_usd ?? null,
    tokens: { input_total: inputTotal, input: u.input_tokens || 0, cache_read: u.cache_read_input_tokens || 0, cache_write: u.cache_creation_input_tokens || 0, output: u.output_tokens || 0 },
    final: result?.result ?? null,
    is_error: result?.is_error ?? null,
    sequence: steps.map(s => `${s.n}. ${s.tool}${s.error ? ' ✗' : ''}${summarizeInput(s)}`),
    step_detail: steps,
  };
}

function summarizeInput(s) {
  const i = s.input || {};
  const v = i.url || i.element || i.ref || i.session_id || i.id || i.category || (i.values ? `${i.values.length} fields` : '') || (i.fields ? `${i.fields.length} fields` : '') || i.text || '';
  return v ? ` — ${String(v).slice(0, 60)}` : '';
}

export function parseFile(file) {
  return parseTranscript(fs.readFileSync(file, 'utf8'));
}

// 直接跑：node scripts/lib-transcript.js <transcript.jsonl> [summary.json]
if (process.argv[1] && process.argv[1].endsWith('lib-transcript.js')) {
  const [file, out] = process.argv.slice(2);
  const s = parseFile(file);
  if (out) fs.writeFileSync(out, JSON.stringify(s, null, 2) + '\n');
  const { step_detail, ...short } = s;
  console.log(JSON.stringify(short, null, 2));
}
