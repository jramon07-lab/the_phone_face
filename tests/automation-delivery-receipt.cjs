const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripTypeScriptTypes } = require('node:module');

const root = path.resolve(__dirname, '..');
const source = stripTypeScriptTypes(
  fs.readFileSync(path.join(root, 'supabase/functions/crm-automation-runner/delivery-receipt.ts'), 'utf8')
).replaceAll('export ', '');
const api = new Function(`${source}; return { extractGreenMessageId, classifyGreenDelivery };`)();

assert.equal(api.extractGreenMessageId({ idMessage: ' msg-1 ' }), 'msg-1');
assert.equal(api.extractGreenMessageId({ data: { idMessage: 'nested-1' } }), 'nested-1');
assert.equal(api.extractGreenMessageId({ ok: true }), '');

assert.deepEqual(api.classifyGreenDelivery([], 'msg-1'), {
  state: 'missing', status: '', description: ''
});
assert.deepEqual(api.classifyGreenDelivery([{ idMessage: 'msg-1', statusMessage: 'sent' }], 'msg-1'), {
  state: 'confirmed', status: 'sent', description: ''
});
assert.deepEqual(api.classifyGreenDelivery([{ idMessage: 'msg-1', statusMessage: 'delivered' }], 'msg-1'), {
  state: 'confirmed', status: 'delivered', description: ''
});
assert.deepEqual(api.classifyGreenDelivery([{ idMessage: 'msg-1', statusMessage: 'read' }], 'msg-1'), {
  state: 'confirmed', status: 'read', description: ''
});
assert.deepEqual(api.classifyGreenDelivery([{ idMessage: 'msg-1', statusMessage: 'pending' }], 'msg-1'), {
  state: 'pending', status: 'pending', description: ''
});
assert.deepEqual(api.classifyGreenDelivery([{ idMessage: 'msg-1', statusMessage: 'yellowCard' }], 'msg-1'), {
  state: 'pending', status: 'yellowcard', description: ''
});
assert.deepEqual(api.classifyGreenDelivery([{ idMessage: 'msg-1', statusMessage: 'failed', description: 'blocked' }], 'msg-1'), {
  state: 'failed', status: 'failed', description: 'blocked'
});

const runner = fs.readFileSync(path.join(root, 'supabase/functions/crm-automation-runner/index.ts'), 'utf8');
assert.match(runner, /extractGreenMessageId\(data\)/);
assert.match(runner, /classifyGreenDelivery\(body\.messages,receipt\.idMessage\)/);
assert.match(runner, /__delivery_receipt/);
assert.match(runner, /Confirmaci[oó]n de WhatsApp agotada/);

console.log('automation-delivery-receipt: ok');
