// 身分那一道門：HTTP Message Signatures（RFC 9421 的形狀，Web Bot Auth 用的那套）
// agent 每個請求帶 Content-Digest / Signature-Input / Signature 三個 header，
// 店拿 keyid 去 config/agents.json 找公鑰驗章。
import crypto from 'node:crypto';

export function contentDigest(body = '') {
  return 'sha-256=:' + crypto.createHash('sha256').update(body).digest('base64') + ':';
}

function signatureBase({ method, path, digest, created, expires, nonce, keyid, tag }) {
  const params = `("@method" "@path" "content-digest");created=${created};expires=${expires};nonce="${nonce}";keyid="${keyid}";alg="ed25519";tag="${tag}"`;
  const base = [
    `"@method": ${method.toUpperCase()}`,
    `"@path": ${path}`,
    `"content-digest": ${digest}`,
    `"@signature-params": ${params}`,
  ].join('\n');
  return { base, params };
}

export function signRequest({ method, path, body = '', privateKeyPem, keyid, tag = 'agent-payer-auth', ttl = 300 }) {
  const created = Math.floor(Date.now() / 1000);
  const expires = created + ttl;
  const nonce = crypto.randomBytes(12).toString('base64url');
  const digest = contentDigest(body);
  const { base, params } = signatureBase({ method, path, digest, created, expires, nonce, keyid, tag });
  const sig = crypto.sign(null, Buffer.from(base), crypto.createPrivateKey(privateKeyPem)).toString('base64');
  return {
    'Content-Digest': digest,
    'Signature-Input': `sig1=${params}`,
    'Signature': `sig1=:${sig}:`,
  };
}

const RE = /^sig1=\(([^)]*)\);created=(\d+);expires=(\d+);nonce="([^"]+)";keyid="([^"]+)";alg="ed25519";tag="([^"]+)"$/;
const seenNonces = new Map(); // nonce -> expires

export function verifyRequest({ method, path, rawBody = '', headers, agents }) {
  const input = headers['signature-input'];
  const sigHeader = headers['signature'];
  const digestHeader = headers['content-digest'];
  if (!input || !sigHeader) return { ok: false, reason: 'missing_signature', hint: '請求沒有帶 Signature-Input / Signature' };
  const m = RE.exec(input);
  if (!m) return { ok: false, reason: 'bad_signature_input', hint: 'Signature-Input 的形狀不對' };
  const [, , created, expires, nonce, keyid, tag] = m;
  const now = Math.floor(Date.now() / 1000);
  if (now < +created - 60 || now > +expires) return { ok: false, reason: 'expired', hint: '簽章過期或時鐘不對' };
  for (const [n, e] of seenNonces) if (e < now) seenNonces.delete(n);
  if (seenNonces.has(nonce)) return { ok: false, reason: 'replay', hint: '同一個 nonce 用了兩次' };
  const agent = agents.agents?.[keyid];
  if (!agent) return { ok: false, reason: 'unknown_keyid', hint: `店裡沒有登記 keyid=${keyid}` };
  const digest = contentDigest(rawBody);
  if (digestHeader !== digest) return { ok: false, reason: 'digest_mismatch', hint: '內容跟 Content-Digest 對不上' };
  const { base } = signatureBase({ method, path, digest, created, expires, nonce, keyid, tag });
  const sigMatch = /^sig1=:([^:]+):$/.exec(sigHeader);
  if (!sigMatch) return { ok: false, reason: 'bad_signature', hint: 'Signature 的形狀不對' };
  let ok = false;
  try {
    ok = crypto.verify(null, Buffer.from(base), crypto.createPublicKey(agent.public_key_pem), Buffer.from(sigMatch[1], 'base64'));
  } catch { ok = false; }
  if (!ok) return { ok: false, reason: 'signature_invalid', hint: '章對不上公鑰' };
  seenNonces.set(nonce, +expires);
  return { ok: true, keyid, tag, agent };
}

export function generateKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    public_key_pem: publicKey.export({ type: 'spki', format: 'pem' }),
    private_key_pem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  };
}

export function canonical(obj) {
  if (Array.isArray(obj)) return '[' + obj.map(canonical).join(',') + ']';
  if (obj && typeof obj === 'object') return '{' + Object.keys(obj).sort().map(k => JSON.stringify(k) + ':' + canonical(obj[k])).join(',') + '}';
  return JSON.stringify(obj);
}
export function signObject(obj, privateKeyPem) {
  return crypto.sign(null, Buffer.from(canonical(obj)), crypto.createPrivateKey(privateKeyPem)).toString('base64');
}
export function verifyObject(obj, signature, publicKeyPem) {
  try { return crypto.verify(null, Buffer.from(canonical(obj)), crypto.createPublicKey(publicKeyPem), Buffer.from(signature, 'base64')); }
  catch { return false; }
}
