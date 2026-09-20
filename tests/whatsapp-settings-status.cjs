const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/modules/whatsapp-settings-status.js'), 'utf8');
const authSource = fs.readFileSync(path.join(root, 'js/core/api-auth.js'), 'utf8');
const settingsKeys = ['crm_server_scheduled_whatsapp_enabled', 'crm_server_automations_enabled'];

function harness(options = {}) {
  const ids = ['whatsappSettingsStatus', 'whatsappSettingsTitle', 'whatsappSettingsDetail', 'whatsappSettingsProvider',
    'whatsappSettingsScheduled', 'whatsappSettingsAutomations', 'whatsappSettingsChecked', 'whatsappSettingsRefresh', 'view-settings'];
  const elements = new Map(ids.map(id => [id, {
    dataset: {}, textContent: '', disabled: false, attributes: {}, listeners: {},
    classList: { contains: () => true },
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, callback) { this.listeners[name] = callback; }
  }]));
  const calls = { settings: [], fetches: [], sessions: 0 };
  let payload = options.payload || { ok: true, state: 'authorized' };
  let error = options.networkError;
  const context = {
    URL, Headers, AbortController, Date, clearTimeout,
    setTimeout: options.fastTimeout ? callback => setTimeout(callback, 0) : setTimeout,
    location: { href: 'https://crm.example.test/', origin: 'https://crm.example.test' },
    document: { readyState: 'complete', getElementById: id => elements.get(id) },
    MutationObserver: class { observe() {} },
    sb: {
      auth: { async getSession() { calls.sessions++; return { data: { session: { access_token: 'test-session' } } }; } },
      from(table) {
        assert.equal(table, 'app_settings', 'status check must not access queues or contacts');
        return { select(columns) {
          assert.equal(columns, 'key,value');
          return { in(column, keys) {
            assert.equal(column, 'key');
            assert.deepEqual(Array.from(keys), settingsKeys);
            calls.settings.push({ table, columns, keys: Array.from(keys) });
            const result = options.settingsPending ? new Promise(() => {}) : Promise.resolve({
              data: options.rows || settingsKeys.map(key => ({ key, value: true })),
              error: options.settingsError || null
            });
            result.abortSignal = () => result;
            return result;
          } };
        } };
      }
    },
    async fetch(url, init) {
      calls.fetches.push({ url, init });
      assert.equal(url, '/api/green?action=state');
      assert.equal(init.method, 'GET', 'status checks must not send messages or change configuration');
      assert.equal(init.body, undefined);
      assert.equal(init.cache, 'no-store');
      assert.equal(init.headers.get('Authorization'), 'Bearer test-session', 'use the existing authenticated fetch wrapper');
      if (error) throw error;
      if (options.providerPending) return new Promise(() => {});
      return { ok: options.httpOk !== false, async json() { if (options.invalidJson) throw Error('invalid JSON'); return payload; } };
    }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(authSource, context);
  vm.runInContext(source, context);
  return {
    refresh: context.TPFWhatsAppSettingsStatus.refresh,
    element: id => elements.get(id), calls,
    state: () => elements.get('whatsappSettingsStatus').dataset.state,
    fail() { error = Error('private provider details'); },
    payload(value) { payload = value; }
  };
}

test('authorized provider and both server switches produce active status using read-only authenticated requests', async () => {
  const h = harness();
  assert.equal(h.calls.fetches.length, 0, 'hidden settings must not start a background poll');
  const first = h.refresh();
  assert.equal(h.refresh(), first, 'concurrent clicks must share the same status request');
  await first;
  assert.equal(h.state(), 'active');
  assert.equal(h.element('whatsappSettingsProvider').textContent, 'Autorizado');
  assert.match(h.element('whatsappSettingsTitle').textContent, /servidor activo/);
  assert.equal(h.calls.fetches.length, 1);
  assert.equal(h.calls.settings.length, 1);
  assert.equal(h.calls.sessions, 1);
  assert.equal(h.element('whatsappSettingsRefresh').disabled, false);
});

test('provider disconnect is shown without falsely marking delivery active or changing server switches', async () => {
  const h = harness({ payload: { ok: true, state: 'notAuthorized' } });
  await h.refresh();
  assert.equal(h.state(), 'disconnected');
  assert.equal(h.element('whatsappSettingsScheduled').textContent, 'Habilitados');
  assert.equal(h.element('whatsappSettingsProvider').textContent, 'No autorizado para enviar');
});

for (const [name, options] of [
  ['empty HTTP 200', { payload: {} }],
  ['unsuccessful HTTP 200', { payload: { ok: false, state: 'authorized' } }],
  ['unknown provider state', { payload: { ok: true, state: 'unknown' } }],
  ['degraded cached authorization', { payload: { ok: true, state: 'authorized', cached: true, degraded: true } }],
  ['HTTP error', { httpOk: false }],
  ['network error', { networkError: Error('secret provider response') }],
  ['invalid JSON', { invalidJson: true }],
  ['settings permission error', { settingsError: { message: 'denied' } }],
  ['missing server switch', { rows: [{ key: settingsKeys[0], value: true }] }],
  ['unrecognized server switch value', { rows: settingsKeys.map(key => ({ key, value: 'true' })) }],
  ['timeout', { settingsPending: true, providerPending: true, fastTimeout: true }]
]) test(`${name} stays unverified instead of showing manual or active delivery`, async () => {
  const h = harness(options);
  await h.refresh();
  assert.equal(h.state(), 'unknown');
  assert.equal(h.element('whatsappSettingsTitle').textContent, 'Estado sin comprobar');
  assert.doesNotMatch(h.element('whatsappSettingsDetail').textContent, /secret|denied|manual|private/);
  assert.equal(h.element('whatsappSettingsRefresh').disabled, false);
});

test('paused and partially enabled server configurations retain their actual state', async () => {
  for (const values of [[false, false], [true, false], [false, true]]) {
    const h = harness({ rows: settingsKeys.map((key, index) => ({ key, value: values[index] })) });
    await h.refresh();
    assert.equal(h.state(), 'paused');
    assert.equal(h.element('whatsappSettingsScheduled').textContent, values[0] ? 'Habilitados' : 'Desactivados');
    assert.equal(h.element('whatsappSettingsAutomations').textContent, values[1] ? 'Habilitadas' : 'Desactivadas');
  }
});

test('a failed recheck removes the previous positive status', async () => {
  const h = harness();
  await h.refresh();
  assert.equal(h.state(), 'active');
  h.fail();
  await h.refresh();
  assert.equal(h.state(), 'unknown');
  assert.equal(h.element('whatsappSettingsProvider').textContent, 'Sin comprobar');
});

test('HTML starts unverified and loads the new module after API authentication', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /id="whatsappSettingsStatus" data-state="unknown"/);
  assert.doesNotMatch(html, /id="waModeManual"|id="waModeApi"/);
  assert.ok(html.indexOf('/js/core/api-auth.js?') < html.indexOf('/js/modules/whatsapp-settings-status.js?v='));
});
