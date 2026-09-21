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
