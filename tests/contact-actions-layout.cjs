const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Exercise the actual renderer with a list larger than the auxiliary 1,000-row
// cache, then a newly created contact and a pagination redraw. No backend calls.
const file = process.argv[2] || 'js/modules/contacts-list-ui.js';
const source = fs.readFileSync(file, 'utf8');
const elements = new Map();
const document = {getElementById(id) {
  if (!elements.has(id)) elements.set(id, {
    innerHTML:'', textContent:'', classList:{toggle(){}},
  });
  return elements.get(id);
}};
const window = {TPFModules:{register(){}}, dispatchEvent(){}};
vm.runInNewContext(source.replace("M.register('contacts-list-ui',", "window.testContacts={state,renderList};M.register('contacts-list-ui',"), {
  window, document, console, requestAnimationFrame(){},
});
const {state, renderList} = window.testContacts;
const row = id => ({id:String(id),first:'Contacto',last:String(id),fullName:'Contacto '+id,source:'BASE DE DATOS'});
state.filtered = state.rows = Array.from({length:1243},(_,i)=>row(1243-i));
for(const r of state.rows) state.labelsByContact.set(r.id,[]);
const cases = [];
function capture(name) {
  renderList();
  cases.push({name, body:elements.get('tpfContactsRows').innerHTML});
}
capture('initial contacts beyond auxiliary cache');
state.rows.unshift(row('new-contact'));
state.labelsByContact.set('new-contact',[]);
capture('new contact before auxiliary cache refresh');
state.page=12;
capture('pagination redraw');
const head=source.match(/<thead>[\s\S]*?<\/thead>/)[0];
const headers=[...head.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/g)];
assert.equal(headers.length,8,'Expected eight headers from the first render');
assert.match(headers[6][1],/^Oportunidades/);
assert.equal(headers[7][1],'Acciones');
for(const {name,body} of cases) {
  const rows=[...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)];
  assert.equal(rows.length,25,name+': missing rows');
  for(const row of rows) {
    const cells=[...row[1].matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/g)];
    assert.equal(cells.length,headers.length,name+': mismatched columns');
    assert.match(cells[6][1],/class="tpfOppCell"/,name+': missing reserved cell');
    assert.match(cells[7][1],/class="tpfContactActionsCell"/,name+': actions shifted');
    assert.equal((cells[7][2].match(/<button\b/g)||[]).length,3,name+': missing buttons');
  }
  console.log(name+': PASS');
}
