'use strict';

// Exercise the deployed entry points with isolated RPC/database/provider doubles.
// This test never loads credentials, reaches a provider, or writes to Supabase.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const canonical = 'https://the-phone-face-app-whatsapp-fotos-y.vercel.app/api/green';
const secret = 'isolated-test-secret-'.repeat(4);
const clone = value => JSON.parse(JSON.stringify(value));

function loadEdge(slug, options = {}) {
  const calls = [], queries = [], rpcs = [];
  const defaultQuery = query => {
    if (query.table === 'app_settings') return { data: { value: true }, error: null };
    if (query.kind === 'update' && query.selection) return { data: [{ id: 'job-1' }], error: null };
    return { data: null, error: null };
  };
  const sb = {
    async rpc(name, args) {
      rpcs.push({ name, args });
      if (name === 'crm_check_runner_secret') return { data: args.p_secret === secret, error: null };
      if (name === 'crm_lifecycle_job_guard') return { data: { allow: true }, error: null };
      if (name === 'crm_recover_stale_scheduled_whatsapp') return { data: 0, error: null };
      if (name === 'crm_claim_scheduled_whatsapp' || name === 'crm_server_claim_jobs') {
        return { data: clone(options.rows || []), error: null };
      }
      throw new Error(`Unexpected RPC: ${name}`);
    },
    from(table) {
      const query = { table, kind: 'select', filters: [] };
      let result;
      const execute = () => {
        if (!result) {
          queries.push(clone(query));
          result = Promise.resolve(options.query?.(query) ?? defaultQuery(query));
        }
        return result;
      };
      const chain = {
        select(fields) { query.selection = fields; return chain; },
        update(value) { query.kind = 'update'; query.value = clone(value); return chain; },
        insert(value) { query.kind = 'insert'; query.value = clone(value); return chain; },
        upsert(value) { query.kind = 'upsert'; query.value = clone(value); return chain; },
        eq(...args) { query.filters.push(['eq', ...args]); return chain; },
        gt(...args) { query.filters.push(['gt', ...args]); return chain; },
        gte(...args) { query.filters.push(['gte', ...args]); return chain; },
        like(...args) { query.filters.push(['like', ...args]); return chain; },
        limit() { return chain; },
        maybeSingle: execute,
        single: execute,
        then(resolve, reject) { return execute().then(resolve, reject); }
      };
      return chain;
    }
  };
  class TestDate extends Date {
    constructor(...args) { super(...(args.length ? args : [options.now || '2026-09-25T08:30:00Z'])); }
    static now() { return new Date(options.now || '2026-09-25T08:30:00Z').getTime(); }
  }
  const context = {
    Request, Response, Headers, Date: TestDate, JSON, console,
    createClient: () => sb,
    Deno: {
      env: { get: key => key === 'SUPABASE_URL' ? 'https://isolated.invalid' : 'fake-service-key' },
      serve: handler => { context.handler = handler; }
    },
    async fetch(url, request = {}) {
      const action = new URL(url).searchParams.get('action');
      assert.equal(String(url).split('?')[0], canonical, 'all server traffic uses the canonical proxy');
      assert.equal(request.headers?.['x-tpf-cron-secret'], secret, 'the validated secret reaches the proxy');
      calls.push({ action, request });
      if (options.fetch) return options.fetch(action, request);
      if (action === 'state') return Response.json({ ok: true, state: 'authorized' });
      if (action === 'history') return Response.json({ ok: true, messages: [] });
      return Response.json({ ok: true, idMessage: 'provider-message-1' });
    }
  };
  vm.createContext(context);
  const directory = path.join(root, 'supabase/functions', slug);
  const helpers = slug === 'crm-automation-runner'
    ? ['lifecycle.ts', 'contact-party.ts', 'business-time.ts', 'delivery-receipt.ts'] : [];
  const source = [...helpers, 'index.ts'].map(file => fs.readFileSync(path.join(directory, file), 'utf8'))
    .join('\n').replace(/^import .*;\n/gm, '').replace(/^export /gm, '');
  vm.runInContext(stripTypeScriptTypes(source), context, { filename: `${slug}.ts` });
  return { context, calls, queries, rpcs };
}

async function invoke(edge, { webhook = false, credential = secret, body, method = 'POST' } = {}) {
  const headers = credential ? (webhook
    ? { authorization: `Bearer ${credential}` }
    : { 'x-tpf-cron-secret': credential }) : {};
  const request = new Request('https://isolated.invalid/function', {
    method, headers, ...(body && method !== 'GET' ? { body: JSON.stringify(body) } : {})
  });
  const response = await edge.context.handler(request);
  return { status: response.status, body: await response.json() };
}

const scheduledRow = {
  id: 'agenda-1', whatsapp_phone: '600000000', whatsapp_message: 'Isolated test',
  whatsapp_scheduled_at: '2030-01-01T10:00:00Z'
};
const automationJob = {
  id: 'job-1', user_id: 'user-1', automation_id: 'automation-1', event_key: 'existing-event',
  action_type: '__send_whatsapp', action_config: { text: 'Isolated test' },
  context: { phone: '600000000' }, status: 'running', attempts: 1
};

for (const slug of ['crm-automation-runner', 'crm-whatsapp-scheduled-runner', 'crm-green-webhook']) {
  test(`${slug}: missing or invalid authentication performs no work`, async () => {
    for (const credential of ['', 'invalid-but-long-secret-'.repeat(4)]) {
      const edge = loadEdge(slug, { rows: [scheduledRow] });
      const result = await invoke(edge, { credential, webhook: slug === 'crm-green-webhook' });
      assert.equal(result.status, 401);
      assert.equal(edge.calls.length, 0);
      assert.equal(edge.queries.length, 0);
      assert.ok(edge.rpcs.every(call => call.name === 'crm_check_runner_secret'));
    }
  });
}

test('scheduled: existing row is sent once through the authenticated proxy', async () => {
  const edge = loadEdge('crm-whatsapp-scheduled-runner', { rows: [scheduledRow] });
  const result = await invoke(edge);
  assert.equal(result.body.sent, 1);
  assert.deepEqual(edge.calls.map(call => call.action), ['state', 'send']);
  assert.equal(edge.rpcs.filter(call => call.name === 'crm_claim_scheduled_whatsapp').length, 1);
  const writes = edge.queries.filter(query => query.kind === 'update');
  assert.equal(writes.length, 1);
  assert.equal(writes[0].table, 'agenda_items');
  assert.deepEqual(writes[0].filters, [['eq', 'id', scheduledRow.id]]);
  assert.equal(writes[0].value.whatsapp_delivery_status, 'sent');
  assert.equal(writes[0].value.whatsapp_provider_message_id, 'provider-message-1');
  assert.equal(writes[0].value.whatsapp_scheduled_at, undefined, 'original scheduled date is preserved');
  assert.ok(edge.queries.every(query => !['insert', 'upsert'].includes(query.kind)));
});

test('scheduled: unavailable WhatsApp leaves the existing row pending without a send', async () => {
  const edge = loadEdge('crm-whatsapp-scheduled-runner', {
    rows: [scheduledRow], fetch: () => Response.json({ ok: true, state: 'unknown' })
  });
  const result = await invoke(edge);
  assert.equal(result.body.waiting, 1);
  assert.deepEqual(edge.calls.map(call => call.action), ['state']);
  assert.equal(edge.queries.find(query => query.kind === 'update').value.whatsapp_delivery_status, 'pending');
});

test('scheduled: ambiguous provider result is uncertain and never retried', async () => {
  const edge = loadEdge('crm-whatsapp-scheduled-runner', {
    rows: [scheduledRow], fetch: action => {
      if (action === 'state') return Response.json({ ok: true, state: 'authorized' });
      throw new Error('Provider response was lost');
    }
  });
  const result = await invoke(edge);
  assert.equal(result.body.uncertain, 1);
  assert.deepEqual(edge.calls.map(call => call.action), ['state', 'send']);
  assert.equal(edge.queries.find(query => query.kind === 'update').value.whatsapp_delivery_status, 'uncertain');
});

test('automation: sends once and preserves the receipt before later verification', async () => {
  const edge = loadEdge('crm-automation-runner', { rows: [automationJob] });
  const result = await invoke(edge);
  assert.equal(result.body.requeued, 1);
  assert.deepEqual(edge.calls.map(call => call.action), ['state', 'send']);
  const receiptWrite = edge.queries.find(query => query.value?.action_config?.__delivery_receipt);
  assert.equal(receiptWrite.value.status, 'pending');
  assert.equal(receiptWrite.value.action_config.__delivery_receipt.idMessage, 'provider-message-1');
  assert.ok(receiptWrite.filters.some(filter => filter[1] === 'id' && filter[2] === automationJob.id));
  assert.ok(edge.queries.every(query => query.kind !== 'insert'), 'migration does not introduce a second queue');
});

test('automation: existing accepted message is verified through history, never resent', async () => {
  const job = clone(automationJob);
  job.action_config.__delivery_receipt = { idMessage: 'accepted-before-migration', chatId: '34600000000@c.us' };
  const edge = loadEdge('crm-automation-runner', {
    now: '2026-09-25T06:06:00Z', rows: [job], fetch: action => {
      assert.equal(action, 'history');
      return Response.json({ ok: true, messages: [{ idMessage: 'accepted-before-migration', statusMessage: 'delivered' }] });
    }
  });
  const result = await invoke(edge);
  assert.equal(result.body.done, 1);
  assert.deepEqual(edge.calls.map(call => call.action), ['history']);
  assert.equal(edge.queries.find(query => query.table === 'crm_server_automation_jobs').value.status, 'done');
});

test('automation: preserve the active Saturday restriction and calendar month calculations', () => {
  const edge = loadEdge('crm-automation-runner');
  assert.equal(edge.context.nextBusinessSendAt(new Date('2026-09-18T14:00:00Z'), 1, 'days').toISOString(), '2026-09-21T08:00:00.000Z');
  assert.equal(edge.context.nextBusinessSendAt(new Date('2026-09-18T11:00:00Z'), 1, 'days').toISOString(), '2026-09-19T11:00:00.000Z');
  assert.equal(edge.context.madridDateAfter(new Date('2026-09-20T10:00:00Z'), 3, 'months'), '2026-12-20');
  assert.equal(edge.context.madridDateAfter(new Date('2026-09-20T10:00:00Z'), 11, 'months'), '2027-08-20');
});

const webhookBody = {
  typeWebhook: 'incomingMessageReceived', senderData: { chatId: '34600000000@c.us' },
  idMessage: 'incoming-1', timestamp: 1800000000,
  messageData: { interactiveButtonsResponse: { selectedDisplayText: 'Quiero mirar otra cosa' } }
};
function webhookQuery(query) {
  if (query.table === 'crm_offer_response_states') return { data: { offer_instance_id: 'offer-1', action: 'alternative' } };
  if (query.table === 'crm_server_automation_jobs' && query.kind === 'update' && query.selection) {
    return { data: { ...clone(automationJob), action_config: { text: 'Isolated response', reply_buttons: [{ buttonId: 'a', buttonText: 'Option' }] } } };
  }
  return { data: null, error: null };
}

test('webhook: duplicate incoming event never starts another reply', async () => {
  const edge = loadEdge('crm-green-webhook', {
    query: query => {
      assert.equal(query.table, 'wa_messages');
      return { error: { code: '23505' } };
    }
  });
  const result = await invoke(edge, { webhook: true, body: webhookBody });
  assert.equal(result.body.duplicate, true);
  assert.equal(edge.calls.length, 0);
  assert.equal(edge.queries.length, 1);
});

test('webhook: authenticated incoming event uses canonical reply and records its receipt', async () => {
  const edge = loadEdge('crm-green-webhook', { query: webhookQuery });
  const result = await invoke(edge, { webhook: true, body: webhookBody });
  assert.equal(result.body.immediate.sent, true);
  assert.deepEqual(edge.calls.map(call => call.action), ['state', 'sendbuttons']);
  const writes = edge.queries.filter(query => query.table === 'crm_server_automation_jobs' && query.kind === 'update');
  assert.equal(writes.length, 2);
  assert.ok(writes[0].filters.some(filter => filter[1] === 'status' && filter[2] === 'pending'));
  assert.equal(writes[1].value.action_config.__delivery_receipt.idMessage, 'provider-message-1');
  assert.equal(writes[1].value.status, 'pending');
});

test('webhook: unavailable provider defers the claimed reply without sending', async () => {
  const edge = loadEdge('crm-green-webhook', {
    query: webhookQuery, fetch: () => Response.json({ ok: true, state: 'unknown' })
  });
  const result = await invoke(edge, { webhook: true, body: webhookBody });
  assert.equal(result.body.immediate.reason, 'whatsapp_unavailable');
  assert.deepEqual(edge.calls.map(call => call.action), ['state']);
  assert.equal(edge.queries.at(-1).value.status, 'pending');
});
