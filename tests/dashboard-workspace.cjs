'use strict';
// Synthetic-only unit checks: no account, database, network or real contact data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('js/modules/dashboard-performance-guard.js', 'utf8');
const nodes = new Map();
const tabs = [];
function node(id) {
  if (nodes.has(id)) return nodes.get(id);
  const classes = new Set();
  const item = {
    id, hidden: false, disabled: false, textContent: '', innerHTML: '', value: '', dataset: {}, attributes: {},
    classList: { contains: value => classes.has(value), add: value => classes.add(value), remove: value => classes.delete(value), toggle(value, on) { if (on) classes.add(value); else classes.delete(value); } },
    setAttribute(key, value) { this.attributes[key] = String(value); },
  };
  nodes.set(id, item);
  return item;
}
const storage = new Map();
class FilterElement {
  constructor(key) { this.dataset = { homeFilter: key }; }
  closest(selector) { return selector === '[data-home-filter]' ? this : null; }
}
const sandbox = {
  window: { TPFModules: { register() {} }, sessionStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) } },
  document: { getElementById: node, querySelectorAll: () => tabs, querySelector: () => null },
  Element: FilterElement, Intl, Date, Map, console, setTimeout, clearTimeout, setInterval, clearInterval,
};
vm.runInNewContext(source.replace("M.register('dashboard-performance-guard'", "window.workTests={D,workRows,upcomingRows,renderPriority,renderUpcoming,renderActivity,saveWorkState,restoreWorkState,handleClick};M.register('dashboard-performance-guard'"), sandbox);
const { D, workRows, upcomingRows, renderPriority, renderUpcoming, renderActivity, saveWorkState, restoreWorkState, handleClick } = sandbox.window.workTests;
const ids = rows => Array.from(rows, row => row.id);

assert.doesNotMatch(source, /scrollIntoView\s*\(/, 'Filter actions must not jump to another section of the page');
assert.doesNotMatch(source, /class="tdPipelineGrid"|class="tdPipelineRow"/, 'The duplicate preview columns must not be generated');
assert.match(source, /data-home-filter="priority"/);
assert.match(source, /id="tdWorkSearch"/);
assert.match(source, /id="tdPageSize"/);
assert.equal(D.pageSize, '10');

const searchable = [
  { id: 'a', name: 'Álvaro Demo', title: 'Renovación fibra', phone: '600111222' },
  { id: 'b', name: 'Beatriz Test', title: 'Oferta móvil', phone: '600333444' },
];
assert.deepEqual(ids(workRows(searchable, '')), ['a', 'b']);
assert.deepEqual(ids(workRows(searchable, ' ALVARO ')), ['a'], 'Name search ignores case and accents');
assert.deepEqual(ids(workRows(searchable, 'renovacion')), ['a'], 'Search includes the opportunity/task title');
assert.deepEqual(ids(workRows(searchable, '600333')), ['b'], 'Search includes telephone numbers');
assert.deepEqual(ids(workRows(searchable, 'no-match-synthetic')), []);
assert.equal(searchable.length, 2, 'Search does not mutate its input');

const stages = [{ id: 'open', name: 'Seguimiento' }, { id: 'won', name: 'Ganado' }, { id: 'lost', name: 'Perdido' }];
const map = new Map(stages.map(stage => [stage.id, stage]));
const today = '2026-09-19';
const upcomingData = {
  today, stages,
  opps: [
    { id: 'future-opp-1', client_name: 'Demo A', title: 'Demo oferta', expected_date: '2026-09-20', stage_id: 'open', status: 'open' },
    { id: 'future-opp-2', client_name: 'Demo B', title: 'Demo oferta', expected_date: '2026-09-22', stage_id: 'open', status: 'open' },
    { id: 'late-future-opp', client_name: 'Demo C', title: 'Demo futura', expected_date: '2035-01-01', stage_id: 'open', status: 'open' },
    { id: 'past-opp', expected_date: '2026-09-18', stage_id: 'open', status: 'open' },
    { id: 'won-opp', expected_date: '2026-09-20', stage_id: 'won', status: 'open' },
    { id: 'lost-opp', expected_date: '2026-09-20', stage_id: 'lost', status: 'open' },
    { id: 'undated-opp', stage_id: 'open', status: 'open' },
  ],
};
const pending = [
  { id: 'future-task-2', customer_name: 'Demo D', title: 'Demo tarea', starts_at: '2026-09-23T10:00:00Z', status: 'pending' },
  { id: 'future-task-1', customer_name: 'Demo E', title: 'Demo tarea', starts_at: '2026-09-21T10:00:00Z', status: 'pending' },
  { id: 'past-task', starts_at: '2026-09-18T10:00:00Z', status: 'pending' },
  { id: 'undated-task', status: 'pending' },
];
assert.deepEqual(ids(upcomingRows(upcomingData, map, pending)), ['future-opp-1', 'future-task-1', 'future-opp-2', 'future-task-2', 'late-future-opp'], 'Upcoming tasks and opportunities must be merged chronologically, not choose one group over the other');
D.upcomingAll = false;
renderUpcoming(upcomingData, map, pending);
assert.equal((node('dashPriorityFollowups').innerHTML.match(/class="tdUpcoming /g) || []).length, 3);
assert.equal(node('tdUpcomingMore').hidden, false);
D.upcomingAll = true;
renderUpcoming(upcomingData, map, pending);
assert.equal((node('dashPriorityFollowups').innerHTML.match(/class="tdUpcoming /g) || []).length, 5);
assert.equal(node('tdUpcomingMore').textContent, 'Ver menos');

for (const filter of ['priority', 'calls', 'followup', 'processing']) {
  const tab = node(`tab-${filter}`); tab.dataset.homeFilter = filter; tabs.push(tab);
}
const data = { today, stages, tasks: [], opps: Array.from({ length: 73 }, (_, index) => ({ id: `opp-${index}`, client_name: `Synthetic ${index}`, title: 'Synthetic opportunity', phone: `600${String(index).padStart(6, '0')}`, expected_date: '2026-09-18', stage_id: 'open', status: 'open' })) };
function rowCount() { return (node('dashAlerts').innerHTML.match(/<tr>/g) || []).length - 1; }
D.filter = 'priority'; D.query = ''; D.page = 0; D.pageSize = '10';
renderPriority(data, map, []);
assert.equal(rowCount(), 10);
assert.equal(node('tdPageInfo').textContent, '1–10 de 73 gestiones');
assert.equal(node('tdPrevPage').disabled, true);
assert.equal(node('tdNextPage').disabled, false);
D.page = 1; renderPriority(data, map, []);
assert.equal(node('tdPageInfo').textContent, '11–20 de 73 gestiones');
for (const [size, expected] of [['25', 25], ['50', 50], ['all', 73]]) {
  D.pageSize = size; D.page = 0; renderPriority(data, map, []);
  assert.equal(rowCount(), expected);
  assert.equal(node('tdPageInfo').textContent, `1–${expected} de 73 gestiones`);
}
assert.equal(node('tdNextPage').disabled, true, 'Todas gives access to every loaded result');
D.query = 'no-match-synthetic'; renderPriority(data, map, []);
assert.equal((node('dashAlerts').innerHTML.match(/<tr>/g) || []).length, 0);
assert.equal(node('tdPrevPage').disabled, true);
assert.equal(node('tdNextPage').disabled, true);
D.query = ''; renderPriority(data, map, []);
assert.equal(rowCount(), 73);

D.data = data; D.filter = 'priority'; D.query = ''; D.pageSize = '10'; D.page = 2;
handleClick({ target: new FilterElement('followup') });
assert.equal(D.filter, 'followup');
assert.equal(D.page, 0);
handleClick({ target: new FilterElement('followup') });
assert.equal(D.filter, 'followup', 'Clicking the selected filter must not silently return to Priorities');
assert.equal(tabs.filter(tab => tab.attributes['aria-pressed'] === 'true').length, 1);
assert.equal(node('tab-followup').attributes['aria-pressed'], 'true');

D.filter = 'followup'; D.query = 'Synthetic'; D.pageSize = '25'; D.page = 1;
saveWorkState();
D.filter = 'priority'; D.query = ''; D.pageSize = '10'; D.page = 0;
restoreWorkState();
assert.deepEqual([D.filter, D.query, D.pageSize, D.page], ['followup', 'Synthetic', '25', 1], 'Reload restores only interface preferences');

D.data = { activity: Array.from({ length: 40 }, (_, index) => ({ entity_type: 'opportunity', action: 'updated', entity_id: `synthetic-${index}`, created_at: '2026-09-19T10:00:00Z' })) };
D.activityAll = false; renderActivity();
assert.equal((node('dashActivity').innerHTML.match(/class="tdActivityRow/g) || []).length, 5);
D.activityAll = true; renderActivity();
assert.equal((node('dashActivity').innerHTML.match(/class="tdActivityRow/g) || []).length, 40);
console.log('dashboard workspace: synthetic search, full pagination, idempotent tabs, preference restore, chronological mixed upcoming 3/all and activity 5/40 passed');
