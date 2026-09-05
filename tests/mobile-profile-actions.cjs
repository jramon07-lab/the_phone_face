const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('js/mobile-app.js','utf8');
const calls=[],assigned=new Map([['c1',['a','b']],['c2',['b']]]);
let failSave=false,failDelete=false,confirmDelete=true,stillExists=false,refreshes=0;
const catalog=[{id:'a',name:'ALFA'},{id:'b',name:'BETA'},{id:'c',name:'GAMMA'}];
const labels=id=>(assigned.get(id)||[]).map(id=>catalog.find(l=>l.id===id)||{id,name:id});
let inserted=null;
const client={
  async rpc(name,args){
    calls.push({name,args});
    if(name==='crm_list_labels')return {data:catalog};
    if(name==='crm_get_contact_labels')return {data:labels(args.p_contact_id)};
    if(name==='crm_set_contact_labels'){
      if(failSave)return {error:{message:'Save failed'}};
      assigned.set(args.p_contact_id,args.p_label_ids);return {data:null};
    }
    if(name==='delete_sales_opportunity')return failDelete?{error:{message:'Delete failed'}}:{data:null};
    throw Error('Unexpected RPC '+name);
  },
  from(table){if(table==='app_settings'){const q={select(){return q},eq(){return q},async maybeSingle(){return {data:{value:{a:'Operadores',b:'Tiendas',c:'Operadores'}}}}};return q;}assert.equal(table,'sales_opportunities');const q={
    select(){return q},eq(){return q},
    async maybeSingle(){return {data:stillExists?{id:'o1'}:null}},
    insert(row){inserted=row;return q},async single(){return {data:{id:'new-opportunity'}}},
  };return q},
};
const nodes=new Map();
function node(id){if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',disabled:false,classList:{add(){},toggle(){}}});return nodes.get(id);}
const location={hash:'#/contact/c1',replace(value){this.hash=value}};
const context={window:{supabase:{createClient:()=>client}},console,Date,Intl,URLSearchParams,Set,
  setTimeout(){return 1},clearTimeout(){},confirm:()=>confirmDelete,location,
  document:{getElementById:node,querySelector:()=>node('action'),querySelectorAll:()=>[]},
  testRefresh(){refreshes++},
};
const testSource=source.replace(/\s*boot\(\);\s*\}\)\(\);\s*$/,`
render=()=>{};updateAlertDot=()=>{};refreshData=async()=>testRefresh();
window.testProfile={state,renderContact,renderContactOpportunity,saveContactOpportunity,deleteProfileOpportunity,openProfileLabels,loadProfileLabels,renderProfileLabels,saveProfileLabels,get editor(){return profileLabels}};
})();`);
assert.notEqual(testSource,source);vm.runInNewContext(testSource,context);
const api=context.window.testProfile;
api.state.user={id:'user1'};api.state.perms={can_manage_labels:true,can_edit_sales:true,can_view_sales:true};
api.state.contacts=[{id:'c1',first:'Uno',fullName:'Cliente Uno',phone:'600000001'},{id:'c2',fullName:'Cliente Dos'}];
api.state.board={stages:[{id:'s1',pipeline_id:'p1',name:'Nueva'}],opportunities:[{id:'o1',record_id:'c1',title:'Primera'},{id:'o2',record_id:'c2',title:'Otra'}]};
async function run(){
  let html=api.renderContact('c1');assert.match(html,/new-contact-opportunity\/c1/);assert.match(html,/Gestionar etiquetas/);
  api.state.profileTab='opportunities';html=api.renderContact('c1');assert.match(html,/profile-delete-opportunity/);assert(!html.includes('data-id="o2"'));
  assert.match(api.renderContactOpportunity('c1'),/Cliente Uno/);
  node('contactOppTitle').value='Nueva';node('contactOppStage').value='s1';node('contactOppAmount').value='12,50';
  await api.saveContactOpportunity('c1');assert.equal(inserted.record_id,'c1');assert.equal(inserted.phone,'600000001');assert.equal(inserted.amount,12.5);assert.equal(refreshes,1);assert.equal(location.hash,'#/contact/c1');
  api.openProfileLabels('c1');await api.loadProfileLabels('c1');
  assert.match(api.renderProfileLabels('c1'),/checked/);assert.match(api.renderProfileLabels('c1'),/Todas las categorías/);assert.match(api.renderProfileLabels('c1'),/Operadores/);assert.match(api.renderProfileLabels('c1'),/Tiendas/);
  api.editor.selected.delete('a');api.editor.selected.add('c');assigned.get('c1').push('external');
  await api.saveProfileLabels('c1');assert.deepEqual([...assigned.get('c1')].sort(),['b','c','external']);assert.deepEqual(assigned.get('c2'),['b']);
  assert(!calls.some(c=>c.name==='crm_delete_label'),'Must never delete the global label');
  api.openProfileLabels('c1');await api.loadProfileLabels('c1');const before=calls.length;await api.saveProfileLabels('c1');assert.equal(calls.length,before,'Unchanged labels must not trigger another write');
  api.openProfileLabels('c1');await api.loadProfileLabels('c1');api.editor.selected.clear();failSave=true;await api.saveProfileLabels('c1');assert.equal(api.editor.error,'Save failed');assert.equal(api.editor.selected.size,0);assert.equal(location.hash,'#/contact-labels/c1');
  failSave=false;await api.saveProfileLabels('c1');assert.equal(assigned.get('c1').length,0);
  const deleteButton=node('delete');let callCount=calls.length;
  await api.deleteProfileOpportunity('o2','c1',deleteButton);assert.equal(calls.length,callCount,'Reject opportunity from a different contact');
  confirmDelete=false;await api.deleteProfileOpportunity('o1','c1',deleteButton);assert.equal(calls.length,callCount);
  confirmDelete=true;failDelete=true;await api.deleteProfileOpportunity('o1','c1',deleteButton);assert.equal(api.state.board.opportunities.length,2);
  failDelete=false;stillExists=true;await api.deleteProfileOpportunity('o1','c1',deleteButton);assert.equal(api.state.board.opportunities.length,2);
  stillExists=false;await Promise.all([api.deleteProfileOpportunity('o1','c1',deleteButton),api.deleteProfileOpportunity('o1','c1',deleteButton)]);assert.equal(api.state.board.opportunities.length,1);assert.equal(api.state.board.opportunities[0].id,'o2');assert.equal(deleteButton.disabled,false);
  api.state.perms={};callCount=calls.length;api.openProfileLabels('c2');await api.saveProfileLabels('c2');await api.deleteProfileOpportunity('o2','c2',deleteButton);assert.equal(calls.length,callCount);assert(!api.renderContact('c2').includes('profile-delete-opportunity'));assert(!api.renderContact('c2').includes('Gestionar etiquetas'));
  console.log('PASS: contact-bound creation, label add/remove/no-op/concurrent preservation/errors, scoped verified deletion, double-click guard and permissions');
}
run().catch(e=>{console.error(e);process.exitCode=1});
