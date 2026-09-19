'use strict';
// Exercise presentation with synthetic data only. No network or CRM writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('js/modules/dashboard-performance-guard.js', 'utf8');
const nodes = new Map();
function node(id) {
  if (!nodes.has(id)) nodes.set(id, { innerHTML: '', textContent: '', hidden: false, attributes: {}, setAttribute(key, value) { this.attributes[key] = value; } });
  return nodes.get(id);
}
class ActivityFilter {
  constructor(filter) { this.dataset = { activityFilter: filter }; }
  closest(selector) { return selector === '[data-activity-filter]' ? this : null; }
}
const sandbox = { window: { TPFModules: { register() {} } }, document: { getElementById: node }, Element: ActivityFilter, Intl, Date, Map, console };
vm.runInNewContext(source.replace("M.register('dashboard-performance-guard'", "window.activityTests={D,activityKind,activityInfo,isTechnicalActivity,renderActivity,handleClick};M.register('dashboard-performance-guard'"), sandbox);
const { D, activityKind, activityInfo, isTechnicalActivity, renderActivity, handleClick } = sandbox.window.activityTests;
for (const [action, label] of [['create', 'Contacto creado'], ['update', 'Contacto actualizado'], ['delete', 'Contacto eliminado'], ['restore', 'Contacto restaurado'], ['unknown', 'Actividad del contacto']]) {
  assert.equal(activityInfo({ entity_type: 'contact', action })[1], label);
}
assert.equal(activityInfo({ entity_type: 'task', action: 'completed' })[1], 'Tarea completada');
assert.equal(activityInfo({ entity_type: 'opportunity', action: 'move' })[1], 'Oportunidad movida');
assert.equal(activityInfo({ entity_type: 'whatsapp', action: 'failed' })[1], 'Actividad de WhatsApp', 'An unknown or failed WhatsApp is not declared sent');
assert.equal(activityKind({ action: 'restore', summary: 'Restaurado desde papelera' }), 'restored', 'Restore wins over the word papelera');
for (const label of ['Validacion Excel 1789840453787 Demo', 'Integral 1789840360541 Gestor Demo', 'Integral 1789840360541 Titular Demo', 'Validacion 1789840336534 Movil', 'Validación 1789840336534 Contacto', 'Validacion 1789840336534 Editado']) {
  assert.equal(isTechnicalActivity({ entity_type: 'contact', details: { label } }), true, label);
}
for (const label of ['Cliente Demo', 'Demófilo García', 'Validacion de contrato', 'Integral Gestor Demo', 'Ana Test']) {
  assert.equal(isTechnicalActivity({ entity_type: 'contact', details: { label } }), false, 'Do not hide real names based on loose words: ' + label);
}
assert.equal(isTechnicalActivity({ entity_type: 'contact', details: { is_test: true } }), true);
assert.equal(isTechnicalActivity({ entity_type: 'contact', details: { source: 'e2e' } }), true);
assert.equal(isTechnicalActivity({ entity_type: 'contact', details: { source: 'google' } }), false);
const activity = [
  { entity_type: 'contact', entity_id: 'test-1', action: 'delete', created_at: '2026-09-19T12:00:00Z', details: { label: 'Validacion Excel 1789840453787 Demo' } },
  { entity_type: 'contact', entity_id: 'gone', action: 'delete', created_at: '2026-09-19T11:00:00Z', details: { label: 'Contacto sintético eliminado' } },
  { entity_type: 'contact', entity_id: 'gone', action: 'update', created_at: '2026-09-19T10:00:00Z', details: { label: 'Contacto sintético eliminado' } },
  { entity_type: 'contact', entity_id: 'active', action: 'create', created_at: '2026-09-19T09:00:00Z', details: { label: 'Cliente <script> & Demo' } },
];
const before = JSON.stringify(activity);
D.data = { activity }; renderActivity();
assert.equal(node('tdActivityCommercialCount').textContent, 3);
assert.equal(node('tdActivityTechnicalCount').textContent, 1);
assert.doesNotMatch(node('dashActivity').innerHTML, /Validacion Excel/);
assert.doesNotMatch(node('dashActivity').innerHTML, /data-id="gone"/);
assert.match(node('dashActivity').innerHTML, /<button type="button" class="tdActivityRow" data-open="1" data-type="contact" data-id="active"/);
assert.match(node('dashActivity').innerHTML, /Cliente &lt;script&gt; &amp; Demo/);
D.activityAll = true;
handleClick({ target: new ActivityFilter('technical') });
assert.equal(D.activityFilter, 'technical');
assert.equal(D.activityAll, false);
assert.match(node('dashActivity').innerHTML, /Validacion Excel/);
assert.doesNotMatch(node('dashActivity').innerHTML, /data-open/);
assert.equal(node('tdActivityTechnical').attributes['aria-pressed'], 'true');
handleClick({ target: new ActivityFilter('commercial') });
assert.equal(node('tdActivityCommercial').attributes['aria-pressed'], 'true');
assert.equal(JSON.stringify(activity), before, 'Filtering never edits or deletes audit data');
D.data.activity = [activity[0]]; renderActivity();
assert.match(node('dashActivity').innerHTML, /Sin actividad comercial en los últimos eventos/);
assert.match(node('dashActivity').innerHTML, /Técnica \/ pruebas/);
assert.equal(node('tdActivityMore').hidden, true);
D.data.activity = [];
D.activityFilter = 'technical'; renderActivity();
assert.match(node('dashActivity').innerHTML, /Sin actividad técnica \/ de pruebas/);
console.log('PASS: accurate activity labels, exact synthetic classification, read-only tabs, deleted-history safety and escaped keyboard-accessible links.');
