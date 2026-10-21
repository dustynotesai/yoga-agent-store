// 一個指令：產生 owner（你）跟 agent 兩對鑰匙，公鑰登記進店，私鑰留在 keys/（gitignored）。
import { FILES, readJson, writeJson } from '../src/paths.js';
import { generateKeyPair } from '../src/auth.js';

const ownerId = process.argv[2] || 'dustynotes';
const agentId = process.argv[3] || `${ownerId}-agent`;

const owner = generateKeyPair();
const agent = generateKeyPair();
writeJson(FILES.ownerKey, { keyid: ownerId, ...owner });
writeJson(FILES.agentKey, { keyid: agentId, owner: ownerId, ...agent });

const reg = readJson(FILES.agents, { owners: {}, agents: {} });
reg.owners[ownerId] = { public_key_pem: owner.public_key_pem, registered: new Date().toISOString() };
reg.agents[agentId] = { owner: ownerId, public_key_pem: agent.public_key_pem, registered: new Date().toISOString() };
writeJson(FILES.agents, reg);

console.log(`✓ 產生了兩對鑰匙（Ed25519）`);
console.log(`  你（owner）   keyid=${ownerId}   私鑰 → keys/owner.json`);
console.log(`  你的 agent    keyid=${agentId}   私鑰 → keys/agent.json`);
console.log(`✓ 兩把公鑰已登記進店：config/agents.json`);
console.log(`\n下一步：簽一張授權書給 agent →  npm run mandate -- --max 1200 --category yoga-pants`);
