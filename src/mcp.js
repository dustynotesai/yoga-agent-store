// agent 門的 MCP 版：同一個後門，包成 Claude Code 看得懂的工具。
// 每個工具底下都是去打 /agent/* 的 REST，蓋章跟授權書由 client.js 處理。
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { call, loadMandate, STORE_URL } from './client.js';

const server = new McpServer({ name: 'yoga-store', version: '0.1.0' });
const text = obj => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });

server.tool('list_products', `列出 Mountain Flow Yoga 的商品（${STORE_URL}）。可用 category 篩：yoga-pants 或 yoga-top。回傳每件的價格、尺寸庫存、口袋、評價。`,
  { category: z.enum(['yoga-pants', 'yoga-top']).optional() },
  async ({ category }) => text((await call('GET', '/agent/products' + (category ? `?category=${category}` : ''))).json));

server.tool('get_product', '拿一件商品的完整資料。', { id: z.string() },
  async ({ id }) => text((await call('GET', `/agent/products/${id}`)).json));

server.tool('create_checkout', '建立結帳 session。items 是 [{id, size, quantity}]，buyer 是收件人。回傳 session id 跟金額。',
  { items: z.array(z.object({ id: z.string(), size: z.enum(['S', 'M', 'L', 'XL']), quantity: z.number().int().min(1).default(1) })), buyer: z.object({ name: z.string(), address: z.string(), phone: z.string().optional() }) },
  async ({ items, buyer }) => text((await call('POST', '/agent/checkout_sessions', { items, buyer })).json));

server.tool('complete_checkout', '完成付款。會自動附上使用者簽的授權書（mandate）跟測試卡 token。店會檢查身分、授權、預算、付款四道門，被擋會回 error 跟 hint。',
  { session_id: z.string() },
  async ({ session_id }) => {
    const mandate = loadMandate();
    const r = await call('POST', `/agent/checkout_sessions/${session_id}/complete`, { mandate: mandate || undefined, payment_data: { type: 'card', token: 'tok_visa' } });
    return text(r.json);
  });

server.tool('cancel_checkout', '取消結帳 session。', { session_id: z.string() },
  async ({ session_id }) => text((await call('POST', `/agent/checkout_sessions/${session_id}/cancel`)).json));

await server.connect(new StdioServerTransport());
