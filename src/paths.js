import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const p = (...xs) => path.join(ROOT, ...xs);
// Isolate demos/tests without touching an existing key registry or experiment logs.
const state = (...xs) => path.join(process.env.YOGA_STORE_STATE_DIR || ROOT, ...xs);

export const FILES = {
  products: state('data', 'products.json'),
  gates: state('config', 'gates.json'),
  agents: state('config', 'agents.json'),
  ownerKey: state('keys', 'owner.json'),
  agentKey: state('keys', 'agent.json'),
  mandate: state('keys', 'mandate.json'),
  requestsLog: state('logs', 'requests.jsonl'),
  ordersLog: state('logs', 'orders.jsonl'),
};

export function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { if (fallback !== undefined) return fallback; throw new Error(`讀不到 ${file}`); }
}
export function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}
export function appendLog(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify({ ts: new Date().toISOString(), ...obj }) + '\n', 'utf8');
}
export const gates = () => readJson(FILES.gates, { identity: true, mandate: true, budget: true, payment: true, order: 'original', run_tag: '' });
