// 簽一張授權書給 agent：能買什麼、上限多少、幾天內有效。
//   npm run mandate -- --max 1200 --category yoga-pants --days 7
import { FILES, readJson, writeJson } from '../src/paths.js';
import { createMandate } from '../src/mandate.js';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const max = +opt('--max', 1200);
const categories = opt('--category', 'yoga-pants').split(',');
const days = +opt('--days', 7);
const note = opt('--note', '');

const owner = readJson(FILES.ownerKey, null);
const agent = readJson(FILES.agentKey, null);
if (!owner || !agent) { console.error('還沒有鑰匙。先跑：npm run keygen'); process.exit(1); }

const env = createMandate({ ownerKeyid: owner.keyid, ownerPrivateKeyPem: owner.private_key_pem, agentKeyid: agent.keyid, allowedCategories: categories, maxAmount: max, days, note });
writeJson(FILES.mandate, env);
console.log(`✓ 簽好了 → keys/mandate.json`);
console.log(`  ${owner.keyid} 授權 ${agent.keyid}：只能買 ${categories.join('、')}，上限 NT$ ${max}，${days} 天內有效`);
console.log(`  mandate id ${env.mandate.id}`);
console.log(`\n下一步：開店 →  npm start   然後在另一個視窗跑  npm run agent  看 agent 走一遍後門`);
