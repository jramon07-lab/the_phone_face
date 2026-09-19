'use strict';
// Execute the real row mapping and HTML renderer with synthetic records only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('js/modules/dashboard-performance-guard.js', 'utf8');
const nodes = new Map();
const sandbox = {
  window: { TPFModules: { register() {} }, sessionStorage: { setItem() {} } },
  document: { getElementById(id) { if (!nodes.has(id)) nodes.set(id, {}); return nodes.get(id); } },
  Intl, Date, Map, console, setTimeout, clearTimeout,
};
vm.runInNewContext(source.replace("M.register('dashboard-performance-guard'", "window.routingTests={D,opportunityRow,taskRow,renderPriority};M.register('dashboard-performance-guard'"), sandbox);
const { D, opportunityRow, taskRow, renderPriority } = sandbox.window.routingTests;
const map = new Map([['follow', { name: 'Seguimiento' }]]);
const date = '2026-09-19';
const opp = { id: 'opp-demo', record_id: 'linked-contact', contact_id: 'wrong-contact', client_name: 'Cliente Demo', stage_id: 'follow', expected_date: date, title: 'Oferta demo' };
assert.equal(opportunityRow(opp, map, date).contactId, 'linked-contact');
assert.equal(opportunityRow({ ...opp, record_id: null }, map, date).contactId, 'wrong-contact');
assert.equal(opportunityRow({ id: 'orphan' }, map, date).contactId, '');
assert.equal(taskRow({ id: 'task', related_record_id: 'task-contact' }, date).contactId, 'task-contact');
D.filter = 'priority'; D.query = ''; D.page = 0; D.pageSize = '10';
renderPriority({ opps: [opp], today: date }, map, []);
const html = nodes.get('dashAlerts').innerHTML;
assert.match(html, /class="tdClientButton" data-open="1" data-type="contact" data-id="linked-contact"/);
assert.match(html, /class="tdInterestButton" data-open="1" data-type="opportunity" data-id="opp-demo"/);
renderPriority({ opps: [{ ...opp, record_id: null, contact_id: null }], today: date }, map, []);
assert.match(nodes.get('dashAlerts').innerHTML, /<div class="tdClientButton" title="Sin contacto vinculado">/);
assert.doesNotMatch(nodes.get('dashAlerts').innerHTML, /data-type="contact"/);
console.log('PASS: linked IDs, separate contact/opportunity actions, unlinked records remain non-clickable.');
