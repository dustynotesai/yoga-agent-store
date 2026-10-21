// 授權跟預算那兩道門：一張你（owner）簽給 agent 的紙。
// 形狀照 Google AP2 的 mandate：誰簽的、給哪個 agent、能買什麼、上限多少、到什麼時候。
import crypto from 'node:crypto';
import { signObject, verifyObject } from './auth.js';

export function createMandate({ ownerKeyid, ownerPrivateKeyPem, agentKeyid, allowedCategories, maxAmount, currency = 'TWD', days = 7, note = '' }) {
  const now = new Date();
  const mandate = {
    id: 'mnd_' + crypto.randomBytes(6).toString('hex'),
    owner_keyid: ownerKeyid,
    agent_keyid: agentKeyid,
    allowed_categories: allowedCategories,
    max_amount: maxAmount,
    currency,
    created: now.toISOString(),
    expires: new Date(now.getTime() + days * 86400e3).toISOString(),
    note,
  };
  return { mandate, signature: signObject(mandate, ownerPrivateKeyPem) };
}

// 回傳 { ok, reason, hint }；gates 決定哪幾條要看
export function checkMandate({ envelope, agentKeyid, categories, amount, agents, gates }) {
  if (!gates.mandate && !gates.budget) return { ok: true, skipped: true };
  if (!envelope?.mandate || !envelope?.signature) return { ok: false, reason: 'missing_mandate', hint: '結帳沒有附授權（mandate）' };
  const { mandate, signature } = envelope;
  const owner = agents.owners?.[mandate.owner_keyid];
  if (!owner) return { ok: false, reason: 'unknown_owner', hint: `店裡沒有登記 owner=${mandate.owner_keyid}` };
  if (!verifyObject(mandate, signature, owner.public_key_pem)) return { ok: false, reason: 'mandate_signature_invalid', hint: '授權書的簽名對不上' };
  if (!Number.isFinite(Date.parse(mandate.expires)) || !Array.isArray(mandate.allowed_categories) || !Number.isSafeInteger(mandate.max_amount) || mandate.max_amount < 0) return { ok: false, reason: 'invalid_mandate', hint: '授權書欄位不完整或格式錯誤' };
  if (new Date(mandate.expires) < new Date()) return { ok: false, reason: 'mandate_expired', hint: '授權書過期' };
  if (gates.mandate) {
    if (mandate.agent_keyid !== agentKeyid) return { ok: false, reason: 'mandate_wrong_agent', hint: `授權書是給 ${mandate.agent_keyid}，敲門的是 ${agentKeyid}` };
    const bad = categories.filter(c => !mandate.allowed_categories.includes(c));
    if (bad.length) return { ok: false, reason: 'category_not_allowed', hint: `授權書不允許買 ${bad.join(', ')}` };
  }
  if (gates.budget) {
    if (mandate.currency !== 'TWD') return { ok: false, reason: 'currency_mismatch', hint: '幣別不對' };
    if (amount > mandate.max_amount) return { ok: false, reason: 'over_budget', hint: `金額 ${amount} 超過授權上限 ${mandate.max_amount}` };
  }
  return { ok: true, mandate_id: mandate.id };
}
