(function(){
'use strict';
const M=window.TPFModules;
if(!M||window.__tpfContactAutomationConsistency)return;
window.__tpfContactAutomationConsistency=true;
const $=id=>document.getElementById(id);
let salesRefresh=null,realtimeChannel=null;

function activeContact(){
  try{return typeof currentContact!=='undefined'&&currentContact?.id?currentContact:null}catch(_){return null}
}
function field(data,...keys){
  for(const key of keys){const value=data?.[key];if(value!==undefined&&value!==null)return value}
  return '';
}
function contactContext(contact=activeContact()){
  if(!contact)return null;
  const data=contact.data||{};
  return {
    contact_id:String(contact.id),
    name:String($('contactName')?.value||field(data,'NOMBRE Y APELLIDOS','NOMBRE','CLIENTE','CLIENTE FINAL')||'').trim(),
    phone:String($('contactPhone')?.value||field(data,'TELÉFONO','TELEFONO','PHONE','MOVIL')||'').trim(),
    dni:String($('contactDni')?.value||field(data,'DNI / NIF','DNI','NIF')||'').trim()
  };
}
async function labelsFor(contactId){
  if(!contactId||typeof crmGetContactLabels!=='function')return [];
  try{return await crmGetContactLabels(contactId)||[]}catch(error){console.warn('Etiquetas del contacto',error);return []}
}
async function refreshSales(){
  if(typeof loadSales!=='function')return;
  if(salesRefresh)return salesRefresh;
  salesRefresh=Promise.resolve().then(()=>loadSales()).catch(error=>console.warn('Actualizar oportunidades',error)).finally(()=>{salesRefresh=null});
  return salesRefresh;
}
async function refreshVisibleContact(){
  const contact=activeContact(),modal=$('contactModal');
  if(!contact||!modal||modal.classList.contains('hidden'))return;
  const id=String(contact.id);
  await refreshSales();
  const current=activeContact();
  if(!current||String(current.id)!==id||typeof renderContactProfile!=='function')return;
  try{await renderContactProfile()}catch(error){console.warn('Actualizar ficha del contacto',error)}
}
function wrapOpenContact(){
  const original=window.openContact;
  if(typeof original!=='function'||original.__tpfFreshOpportunities)return;
  const wrapped=async function(){await refreshSales();return original.apply(this,arguments)};
  wrapped.__tpfFreshOpportunities=true;
  wrapped.__tpfOriginal=original;
  window.openContact=wrapped;
}
async function matchingAutomations(labelId){
  let rows=Array.isArray(window.crmAutomations)?window.crmAutomations:[];
  if(!rows.length){
    try{
      const result=await sb.rpc('crm_list_automations');
      if(!result.error&&Array.isArray(result.data)){window.crmAutomations=result.data;rows=result.data}
    }catch(_){}
  }
  return rows.filter(rule=>rule?.enabled&&rule?.trigger_type==='label_assigned'&&String(rule?.trigger_config?.label_id||'')===String(labelId));
}
async function executionAlreadyStarted(automationIds,ctx,labelId,since){
  if(!automationIds.length)return false;
  try{
    const result=await sb.from('crm_server_automation_jobs')
      .select('automation_id,context,created_at')
      .in('automation_id',automationIds)
      .gte('created_at',since)
      .order('created_at',{ascending:false})
      .limit(100);
    if(!result.error&&(result.data||[]).some(row=>String(row.context?.contact_id||'')===String(ctx.contact_id)&&String(row.context?.label_id||'')===String(labelId)))return true;
  }catch(_){}
  try{
    const result=await sb.from('crm_automation_runs')
      .select('automation_id,context,created_at')
      .in('automation_id',automationIds)
      .gte('created_at',since)
      .order('created_at',{ascending:false})
      .limit(100);
    if(!result.error&&(result.data||[]).some(row=>String(row.context?.contact_id||'')===String(ctx.contact_id)&&String(row.context?.label_id||'')===String(labelId)))return true;
  }catch(_){}
  return false;
}
function wrapManageLabels(){
  const button=$('contactLabelsSave');
  if(!button||button.dataset.tpfAutomationConsistency==='1')return;
  const original=button.onclick;
  button.onclick=async function(event){
    const ctx=contactContext(),before=ctx?await labelsFor(ctx.contact_id):[];
    const since=new Date(Date.now()-1500).toISOString();
    const result=typeof original==='function'?await original.call(this,event):undefined;
    if(!ctx)return result;
    const after=await labelsFor(ctx.contact_id),oldIds=new Set(before.map(label=>String(label.id)));
    const added=after.filter(label=>!oldIds.has(String(label.id)));
    for(const label of added){
      const rules=await matchingAutomations(label.id);
      if(!rules.length||typeof auto2Fire!=='function')continue;
      await new Promise(resolve=>setTimeout(resolve,180));
      const started=await executionAlreadyStarted(rules.map(rule=>String(rule.id)),ctx,label.id,since);
      if(started)continue;
      try{
        await auto2Fire('label_assigned',{...ctx,label_id:label.id,label_name:label.name||''},`label:${ctx.contact_id}:${label.id}:${Date.now()}`);
      }catch(error){console.warn('Disparar automatización de etiqueta',error)}
    }
    await refreshVisibleContact();
    return result;
  };
  button.dataset.tpfAutomationConsistency='1';
}
function bindOpportunityTab(){
  document.addEventListener('click',event=>{
    const tab=event.target?.closest?.('#contactModal .cpTabs span,#contactModal .cpTabs b');
    if(!tab||!/oportunidades/i.test(tab.textContent||''))return;
    setTimeout(()=>refreshVisibleContact(),0);
  },true);
}
function bindFocusRefresh(){
  window.addEventListener('focus',()=>refreshVisibleContact());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshVisibleContact()});
}
function subscribeOpportunityChanges(){
  try{
    if(typeof sb==='undefined'||!sb?.channel||realtimeChannel)return;
    realtimeChannel=sb.channel('tpf-contact-opportunities-live')
      .on('postgres_changes',{event:'*',schema:'public',table:'sales_opportunities'},()=>refreshVisibleContact())
      .subscribe();
  }catch(error){console.warn('Actualización en vivo de oportunidades',error)}
}
function install(){
  wrapOpenContact();
  wrapManageLabels();
  bindOpportunityTab();
  bindFocusRefresh();
  subscribeOpportunityChanges();
  let tries=0;
  const timer=setInterval(()=>{
    wrapOpenContact();
    wrapManageLabels();
    if(++tries>=20)clearInterval(timer);
  },250);
}
M.register('contact-automation-consistency',{install});
})();
