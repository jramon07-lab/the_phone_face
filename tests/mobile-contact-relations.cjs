const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const nodes={};
const source=fs.readFileSync('js/mobile-app.js','utf8');
const exposed=['state','mapContact','mobileHolders','mobileManagers','mobileRelationsSummary','relatedOpportunities','mobileOpportunityParties','mobileOpportunityIdentityHtml','mobileReadRelations','contactActivityIndex','mobileRelationEditor','mobileOpportunityChoice'];
const ctx={console,URLSearchParams,location:{hash:'#/contacts'},window:{},document:{getElementById:id=>nodes[id]||null,addEventListener(){},querySelector(){return null},querySelectorAll(){return []}},setTimeout,clearTimeout};
ctx.document.createElement=()=>({});ctx.document.head={appendChild(){}};ctx.window=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/modules/contact-party.js','utf8'),ctx);
vm.runInContext(source.replace(/\s*boot\(\);\s*\}\)\(\);\s*$/,`\nwindow.testApi={${exposed.join(',')}};\n})();`),ctx);
const a=ctx.testApi;
a.state.perms={is_admin:true};
const manager=a.mapContact({id:'m',data:{NOMBRE:'Ramón','TELÉFONO':'600111111',DNI:'GESTOR',TPF_RELACIONES:{version:1,managed_contacts:[{record_id:'h',name:'Old name'},{record_id:'h'},{record_id:'deleted'}]}}});
const holder=a.mapContact({id:'h',data:{NOMBRE:'MARTINA',APELLIDOS:'SANCHEZ','TELÉFONO':'600222222',DNI:'TITULAR'}});
a.state.contacts=[manager,holder];
a.state.board={stages:[],opportunities:[{id:'own',record_id:'m'},{id:'managed',record_id:'h'}]};
assert.equal(a.mobileHolders(manager).length,1);assert.equal(a.mobileManagers('h')[0].id,'m');
assert.equal(a.relatedOpportunities('m').length,2);assert.equal(a.relatedOpportunities('h').length,1);
assert.equal(a.contactActivityIndex().get('m').opportunities,2);
const summary=a.mobileRelationsSummary(manager);assert.match(summary,/Titulares asociados \(1\)/);assert.match(summary,/Martina Sanchez/);assert.match(summary,/contact\/h/);assert(!summary.includes('Old name'));assert(!summary.includes('<details class="m-info-card m-relations" open'));
nodes.mobileOppRelated={checked:true};nodes.mobileOppHolder={value:'h'};nodes.mobileOppManager={value:''};
let p=a.mobileOpportunityParties(manager);assert.equal(p.holder.id,'h');assert.equal(p.manager.id,'m');assert.equal(p.party.holder_dni,'TITULAR');assert.equal(p.party.recipient_phone,'600111111');assert.equal(p.party.contact_name,'Ramón');
nodes.mobileOppHolder.value='h';nodes.mobileOppManager.value='m';p=a.mobileOpportunityParties(holder);assert.equal(p.manager.id,'m');assert.equal(p.holder.id,'h');
nodes.mobileOppRelated.checked=false;p=a.mobileOpportunityParties(holder);assert.equal(p.manager,null);assert.equal(p.party.same,true);
const frozen={record_id:'h',client_name:'Fallback',contract_party:{same:false,holder_name:'Nombre histórico',holder_dni:'HISTORICO',contact_name:'Gestor histórico'}};
assert.match(a.mobileOpportunityIdentityHtml(frozen),/HISTORICO/);assert.match(a.mobileOpportunityIdentityHtml(frozen),/Gestor Histórico/);
const editSource=source.slice(source.indexOf('async function saveOpportunityDetail'),source.indexOf('async function saveOpportunityDetail')+2600);assert(!editSource.includes('patch.contract_party='));
nodes.editRelations={dataset:{owner:'m',selected:'["h","h"]'}};assert.equal(a.mobileReadRelations('edit').managed_contacts.length,1);
nodes.editRelations.dataset.selected='["m"]';assert.throws(()=>a.mobileReadRelations('edit'),/sí mismo/);
assert.match(a.mobileRelationEditor(manager,'edit'),/data-mobile-rel-search/);assert.match(a.mobileRelationEditor(manager,'edit'),/Crear nuevo titular/);
a.state.contacts=[manager];assert.equal(a.mobileHolders(manager).length,0);assert.equal(a.relatedOpportunities('m').length,1);
assert(source.includes('p_welcome:false'));assert(source.includes("query.eq('updated_at',latest.data.updated_at)"));
a.state.contacts=[manager,holder];
a.state.board.opportunities=[{id:'legacy-phone',phone:'+34 600111111',client_name:'Old name'},
 {id:'legacy-name',client_name:'MARTINA SANCHEZ'},
 {id:'explicit-holder',record_id:'h',phone:'600111111'},
 {id:'other-owner',record_id:'elsewhere',phone:'600111111'},
 {id:'no-owner'}, {id:'closed',phone:'600111111',status:'won'}];
assert.deepEqual(Array.from(a.relatedOpportunities('m'),o=>o.id),['legacy-phone','legacy-name','explicit-holder','closed']);
assert.deepEqual(Array.from(a.relatedOpportunities('h'),o=>o.id),['legacy-name','explicit-holder']);
assert.equal(a.contactActivityIndex().get('m').opportunities,3);
const duplicate=a.mapContact({id:'duplicate',data:{NOMBRE:'Martina',APELLIDOS:'Sanchez','TELÉFONO':'600111111'}});
a.state.contacts.push(duplicate);
assert.deepEqual(Array.from(a.relatedOpportunities('m'),o=>o.id),['explicit-holder']);
assert.equal(a.relatedOpportunities('duplicate').length,0);
console.log('PASS mobile relations and legacy opportunities: unique phone/name matches, explicit ownership precedence, ambiguous matches excluded, shared counters, frozen identity and safe links.');
