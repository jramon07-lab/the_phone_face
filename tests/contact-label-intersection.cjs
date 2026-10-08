const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const window={TPFModules:{register(){}}};
const source=fs.readFileSync('js/modules/contacts-list-ui.js','utf8');
vm.runInNewContext(source.replace("M.register('contacts-list-ui',","window.test={state,applyFilters};M.register('contacts-list-ui',"),{window,document:{},console});
const {state,applyFilters}=window.test;
state.rows=['both','only-a','only-b','neither','extra'].map(id=>({id,fullName:id}));
for(const [id,labels] of [['both',['a','b']],['only-a',['a']],['only-b',['b']],['neither',[]],['extra',['a','b','c']]])state.labelsByContact.set(id,labels.map(id=>({id})));
function check(labels,expected){state.filters.labels=labels;applyFilters();assert.deepEqual(Array.from(state.filtered,r=>r.id),expected);}
check(['a'],['both','only-a','extra']);
check(['a','b'],['both','extra']);
check(['b','a'],['both','extra']);
check(['missing'],[]);
check([],['both','only-a','only-b','neither','extra']);
// Related managers must not inherit a holder's label in this filter.
state.rows.push({id:'manager',fullName:'Manager',data:{TPF_RELACIONES:{managed_contacts:[{record_id:'both'}]}}});
check(['a','b'],['both','extra']);
console.log('Single and combined label filters require all selected labels.');

state.filters.labelMode='exact';
check(['a'],['only-a']);
check(['b'],['only-b']);
check(['a','b'],['both']);
check(['b','a','a'],['both']);
check(['a','b','c'],['extra']);
check(['missing'],[]);
state.filters.excludeLabels=['b'];check(['a','b'],[]);check(['a'],['only-a']);
state.filters.excludeLabels=[];
state.filters.labelMode='any';check(['a','b'],['both','only-a','only-b','extra']);
state.filters.labelMode='none';check([],['neither','manager']);
state.filters.labelMode='all';check(['a','b'],['both','extra']);
assert.match(source,/<option value="exact">Solo tiene las etiquetas marcadas<\/option>/);
assert.match(source,/<option value="all">Tiene las etiquetas marcadas<\/option>/);
assert.match(source,/<option value="none">Sin etiquetas<\/option>/);
assert.doesNotMatch(source,/data-mode="any"/);
console.log('Exact labels exclude extra labels, ignore order/duplicates, respect exclusions and preserve all/any/none.');
