// agent 那一邊用的：拿私鑰蓋章、附上授權書，去敲店的後門。
// MCP server 跟 scripts/agent-demo.js 都用這一份，所以「蓋章」這件事 Claude Code 完全不用管。
import { FILES, readJson } from './paths.js';
import { signRequest } from './auth.js';

export const STORE_URL = process.env.STORE_URL || 'http://localhost:4242';

export function loadAgentKey() {
  const k = readJson(FILES.agentKey, null);
  if (!k) throw new Error('還沒有 agent 的鑰匙。先跑：npm run keygen');
  return k;
}
export const loadMandate = () => readJson(FILES.mandate, null);

export async function call(method, path, body) {
  const key = loadAgentKey();
  const raw = body === undefined ? '' : JSON.stringify(body);
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': `yoga-agent/0.1 (${key.keyid})`,
    ...signRequest({ method, path, body: raw, privateKeyPem: key.private_key_pem, keyid: key.keyid }),
  };
  const res = await fetch(STORE_URL + path, { method, headers, body: body === undefined ? undefined : raw });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, ok: res.ok, tokens: +res.headers.get('x-tokens') || null, headers, json };
}
