const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const ctx={window:{},document:{readyState:'loading',addEventListener(){}},Date};vm.runInNewContext(fs.readFileSync('js/modules/sales-installation-preview.js','utf8'),ctx);const api=ctx.window.TPFInstallationPreview;
const sale={DNI:'12345678Z',Operador:'O2',Transaccion:'TX',OrderLine:'1',Fecha_Activacion:'05/09/2026',Cancelada:'No'};
const contact={id:'c',data:{DNI:'12345678Z',NOMBRE:'Cliente'}};
let rows=api.analyse([sale], [contact], []);assert.equal(rows[0].action,'Crear en Ganado');assert.equal(rows[0].expected,'');assert.equal(rows[0].next,'2027-08-05');assert.equal(rows[0].review,'2027-09-05');
rows=api.analyse([sale],[contact],[{id:'o',record_id:'c',title:'CAMBIO O2',expected_date:'2027-10-01'}]);assert.equal(rows[0].action,'Revisar oportunidad existente');assert.equal(rows[0].expected,'2027-10-01');
assert.equal(api.analyse([sale],[],[])[0].action,'Cliente no encontrado');assert.equal(api.analyse([sale,sale],[contact],[])[1].action,'Duplicada en Excel');
assert.equal(api.analyse([{Comentario:'Filtros aplicados'}],[contact],[]).length,0);
assert.equal(api.months('2024-02-29',12),'2025-02-28');
assert.equal(api.analyse([sale],[contact,{id:'manager',data:{TPF_TITULAR:{holder_dni:'12345678Z'}}}],[])[0].action,'Crear en Ganado');
console.log('PASS: installed-sales preview preserves expected dates, DNI matching, duplicates and calendar boundaries');

assert.equal(api.date(46270),'2026-09-05');

assert.equal(api.date('31/02/2026'),'');
assert.equal(api.date('29/02/2024'),'2024-02-29');
assert.equal(api.analyse([{...sale,Fecha_Activacion:''}],[contact],[])[0].selected,false);
assert.equal(api.analyse([{...sale,DNI:''}],[contact],[])[0].issue,'Falta DNI');
assert.equal(api.validPrice(-1),false);assert.equal(api.validPrice('abc'),false);assert.equal(api.validPrice(''),true);
assert.equal(api.sourceMonth({month:'September2026'}),'2026-09-01');
assert.equal(api.analyse([sale],[contact],[{id:'imported',import_reference:'8554:1',amount:null}])[0].imported,true);
console.log('Monthly dates, missing data, price validation and stable references OK');

const manager={id:'m',data:{NOMBRE:'Gestor',DNI:'87654321X',TPF_RELACIONES:{managed_contacts:[{record_id:'c'}]}}};
const managed=api.analyse([sale],[contact,manager],[])[0];
assert.equal(managed.contactId,'c');assert.equal(managed.managerId,'');assert.equal(managed.recipientId,'');assert.equal(managed.selected,false);
assert.equal(api.analyse([sale],[contact],[{id:'wrong',record_id:'c',title:'O2',contract_party:{holder_dni:'OTHER'}}])[0].candidates.length,0);
assert.equal(api.analyse([sale],[contact,{...contact,id:'duplicate'}],[])[0].issue,'Revisar titular / gestor');
console.log('Holder identity and explicit manager routing OK');

const existing={id:'one',record_id:'c',title:'CAMBIO O2',amount:33};
let found=api.analyse([sale],[contact],[existing])[0];
assert.equal(found.choice,'one');assert.equal(found.selected,false);
found=api.analyse([sale],[contact],[existing,{...existing,id:'two'}])[0];
assert.equal(found.choice,'');assert.equal(found.related.length,2);
found=api.analyse([sale],[contact],[existing,{...existing,id:'other',title:'Vodafone'}])[0];
assert.equal(found.related.length,2);assert.equal(found.choice,'one');
assert.equal(api.analyse([sale],[contact],[{...existing,import_reference:'8554:other'}])[0].choice,'');
assert.equal(api.analyse([sale],[contact,{...contact,id:'duplicate'}],[existing])[0].choice,'');
console.log('Existing opportunities displayed, unique match prefilled, ambiguous imports remain unselected');

// Pending-first presentation retains the original index used by all row actions.
const ready={...api.analyse([sale],[contact],[])[0],ledgerId:'ready',amount:25};
const noPrice={...ready,ledgerId:'no-price',amount:''};
const unresolved={...ready,ledgerId:'unresolved',choice:'',selected:false};
const imported={...ready,ledgerId:'imported',imported:true,selected:false};
const reviewImported={...imported,amount:null};
assert.equal(api.needsReview(ready),false);
assert.equal(api.needsReview(noPrice),true);
assert.equal(api.eligible(noPrice),true,'missing price remains importable');
assert.equal(api.needsReview(unresolved),true);
const list=[ready,noPrice,unresolved,imported,reviewImported];
assert.deepEqual(Array.from(api.visibleRows(list),x=>x.i),[1,2,4,0,3]);
assert.deepEqual(Array.from(api.visibleRows(list,'pending'),x=>x.i),[1,2,4]);
assert.deepEqual(Array.from(api.visibleRows(list,'price'),x=>x.i),[1,4]);
assert.equal(list[0],ready,'sorting does not mutate source rows');
// Exercise actual renderer with a minimal, isolated DOM (no database or network).
const nodes=Object.fromEntries(['installedFilter','previewHead','previewRows','runImport','installedSelection','importInfo'].map(id=>[id,{value:'all',innerHTML:'',textContent:''}]));
const renderContext={window:{},document:{readyState:'loading',addEventListener(){},getElementById(id){return nodes[id];}},Date};
const renderSource=fs.readFileSync('js/modules/sales-installation-preview.js','utf8').replace('window.TPFInstallationPreview={','window.testRender=(items,sales)=>{rows=items;opps=sales;render();};window.TPFInstallationPreview={');
vm.runInNewContext(renderSource,renderContext);
renderContext.window.testRender([ready,noPrice,unresolved],[]);
assert.equal((nodes.previewHead.innerHTML.match(/<th>/g)||[]).length,6);
assert.match(nodes.previewRows.innerHTML,/<summary>Revisar datos<\/summary>/);
assert.match(nodes.previewRows.innerHTML,/data-installed-manager="1"/);
assert.match(nodes.previewRows.innerHTML,/data-installed-recipient="1"/);
assert.match(nodes.previewRows.innerHTML,/11 meses: 05\/08\/2027/);
assert.match(nodes.previewRows.innerHTML,/12 meses: 05\/09\/2027/);
assert.match(nodes.previewRows.innerHTML,/Mes de venta: 01\/09\/2026/);
assert.match(nodes.installedSelection.textContent,/2 seleccionadas para importar/);
assert.equal(nodes.runImport.textContent,'Confirmar 2 ventas');
assert.match(nodes.importInfo.textContent,/2 para revisar/);
assert.ok(nodes.previewRows.innerHTML.indexOf('data-installed-select="1"')<nodes.previewRows.innerHTML.indexOf('data-installed-select="0"'));
ready.selected=false;
renderContext.window.testRender([ready,noPrice,unresolved],[]);
assert.match(nodes.installedSelection.textContent,/1 seleccionada para importar/);
assert.equal(nodes.runImport.textContent,'Confirmar 1 venta');
console.log('Compact import rendering, original action indices, selection counts and review filters OK');
