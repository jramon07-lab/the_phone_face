(function(){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function identity(o={},x={},record={}){
 const p=o.contract_party||{},s=x.snapshot||{},v=record.data||{};
 const same=p.same!==false;
 return {name:p.contact_name||o.client_name||v['NOMBRE Y APELLIDOS']||s.contact_name||'Cliente',alias:v.APODO||v['APODO VISIBLE']||'',dni:p.contact_dni||(same?p.holder_dni:'')||v['DNI / NIF']||v.DNI||s.contact_dni||'',phone:p.contact_phone||o.phone||v['TELÉFONO']||v.TELEFONO||s.contact_phone||'',holder:p.holder_name||o.client_name||'Sin titular indicado',holderDni:p.holder_dni||(same?v['DNI / NIF']||v.DNI||'':''),recipient:p.recipient_name||s.recipient_name||'',recipientPhone:Object.hasOwn(p,'recipient_phone')?p.recipient_phone:s.recipient_phone||'',previous:o.after_sale_preferences?.previous_operator||s.previous_operator||'Sin indicar'};
}
async function tramitate(o,stage,preferences){
 if(!stage?.id)throw Error('No está disponible la columna Tramitado. Revisa las columnas de ventas.');
 let query=sb.from('sales_opportunities').update({stage_id:stage.id,position:0,after_sale_preferences:preferences}).eq('id',o.id).eq('stage_id',o.stage_id);
 if(o.updated_at)query=query.eq('updated_at',o.updated_at);
 const r=await query.select('*').single();
 if(r.error||!r.data)throw Error(r.error?.code==='PGRST116'?'La oportunidad cambió en otro dispositivo. Cierra y vuelve a abrir Gestionar antes de confirmar.':r.error?.message||'No se confirmó el guardado de la tramitación.');
 if(typeof salesCache!=='undefined'&&salesCache.opportunities)salesCache.opportunities=salesCache.opportunities.map(v=>String(v.id)===String(o.id)?r.data:v);
 if(typeof runOpportunityAutomations==='function')await runOpportunityAutomations(o.id);
 window.dispatchEvent(new CustomEvent('tpf:sales-updated'));
 return r.data;
}
async function open(id){
 const f=window.TPFOfferFollowup;
 let x=f?.state.offers.find(v=>String(v.id)===String(id));if(!x)return;
 document.getElementById('ofManageDialog')?.close();
 const origin=document.activeElement,scroll=[...document.querySelectorAll('#view-dashboard,.tdTableWrap')].map(el=>({el,top:el.scrollTop,left:el.scrollLeft}));
 const d=document.createElement('dialog');d.id='ofManageDialog';d.className='ofManageDialog ofManageDrawer';d.setAttribute('aria-label','Gestionar cliente');
 d.innerHTML='<header class="ofDrawerHead"><h3>Gestionar</h3><button type="button" data-of-close aria-label="Cerrar gestión">×</button></header><div class="ofDrawerBody" aria-live="polite">Cargando los datos del cliente…</div><footer class="ofDrawerFoot"><button type="button" data-of-close>Volver al listado</button></footer>';
 document.body.appendChild(d);d.addEventListener('close',()=>{d.remove();for(const v of scroll)if(v.el.isConnected){v.el.scrollTop=v.top;v.el.scrollLeft=v.left}if(origin?.isConnected)origin.focus({preventScroll:true})});d.showModal();
 const body=d.querySelector('.ofDrawerBody');let busy=false;
 d.addEventListener('cancel',e=>{if(busy)e.preventDefault()});
 try{
  const fresh=await sb.from('crm_offer_instances').select('*').eq('id',id).single();if(fresh.error)throw fresh.error;if(!fresh.data)throw Error('La oferta ya no está disponible.');x=fresh.data;
  const r=await sb.from('sales_opportunities').select('*').eq('id',x.opportunity_id).single();if(r.error)throw r.error;
  let o=r.data;if(!o)throw Error('Esta oportunidad ya no está disponible.');
  const recordId=o.record_id||x.contact_id;
  const rr=recordId?await sb.from('records').select('id,data').eq('id',recordId).maybeSingle():{data:null};if(rr.error)throw rr.error;
  if(!d.isConnected)return;
  const v=identity(o,x,rr.data||{}),field=(label,value)=>`<div><small>${label}</small><strong>${esc(value||'Sin indicar')}</strong>${value?`<button type="button" data-copy="${esc(value)}" aria-label="Copiar ${label}">Copiar</button>`:''}</div>`;
  body.innerHTML=`<section class="ofClientIdentity"><h2>${esc(v.name)}</h2>${v.alias?`<p>${esc(v.alias)}</p>`:''}<div class="ofIdentityGrid">${field('DNI / NIF',v.dni)}${field('Teléfono',v.phone)}<div><small>Compañía anterior</small><strong data-previous-label>${esc(v.previous)}</strong></div></div></section><section class="ofDrawerSection"><h4>Oferta</h4><p><strong>${esc(x.operator)} · ${esc(x.offer_name)}</strong> · ${esc(new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(Number(x.total_price)||0))}/mes</p><button type="button" class="ofView" data-of-view="${esc(x.id)}">Ver oferta enviada</button>${x.accepted_at?`<p>Aceptada el ${esc(new Date(x.accepted_at).toLocaleString('es-ES',{timeZone:'Europe/Madrid'}))}</p>`:''}</section><section class="ofDrawerSection"><h4>Titular y destinatario</h4><p><b>Titular:</b> ${esc(v.holder)}${v.holderDni?' · '+esc(v.holderDni):''}</p><p data-recipient><b>WhatsApp para:</b> ${esc(v.recipient||'Se comprueba al preparar el mensaje')} ${esc(v.recipientPhone)}</p></section><section class="ofDrawerSection ofFollowSection"><h4>Seguimiento</h4><div data-follow-summary>${f.htmlOffer(x,false)}</div><p data-of-error-detail hidden></p><div class="ofActionButtons">${['following','queued','paused'].includes(x.status)?`<button type="button" data-of-id="${esc(x.id)}" data-of-action="${x.status==='paused'?'resume':'pause'}">${x.status==='paused'?'Reanudar seguimiento':'Pausar seguimiento'}</button><button type="button" data-accept>Marcar aceptada y preparar tramitación</button><button type="button" data-of-id="${esc(x.id)}" data-of-action="cancel">Finalizar seguimiento</button>`:''}</div></section><details class="ofDrawerSection"><summary>Datos y documentación del cliente</summary><p>Consulta y gestiona sus documentos desde la ficha.</p><button type="button" data-contact ${recordId?'':'disabled'}>Abrir ficha del cliente</button><button type="button" data-opportunity>Abrir oportunidad completa</button></details><section class="ofDrawerSection" data-processing hidden><h4>Preparar tramitación</h4><p>La activación llegará del Excel mensual. Aquí se prepara el mensaje de instalación y devolución.</p><div class="tpfRouterFields" data-router></div><p role="alert" data-process-error hidden></p><button type="button" class="ofConfirmProcessing" data-confirm-processing disabled>Confirmar tramitación</button></section><p role="alert" class="ofError" data-panel-error hidden></p>`;
  body.addEventListener('click',async e=>{const b=e.target.closest('[data-copy]');if(!b)return;try{await navigator.clipboard.writeText(b.dataset.copy);b.textContent='Copiado'}catch(_){b.textContent='No se pudo copiar'}});
  body.querySelector('[data-contact]').onclick=()=>{d.close();window.openContact?.(recordId)};
  body.querySelector('[data-opportunity]').onclick=async()=>{try{await window.loadSales?.();d.close();window.openOpportunityFull?.(o.id)}catch(error){const err=body.querySelector('[data-panel-error]');err.hidden=false;err.textContent=error.message||'No se pudo abrir la oportunidad.'}};
  window.TPFOfferWorkPlan?.decorate(d,x);
  const history=d.querySelector('.ofPlanHistory');if(history)body.appendChild(history);
  let routerReady=false;
  const setBusy=value=>{busy=value;d.querySelectorAll('button').forEach(b=>{if(value){b.dataset.wasDisabled=String(b.disabled);b.disabled=true}else if(b.dataset.wasDisabled!==undefined){b.disabled=b.dataset.wasDisabled==='true';delete b.dataset.wasDisabled}})};
  async function prepare(){
   const section=body.querySelector('[data-processing]'),err=body.querySelector('[data-process-error]'),button=body.querySelector('[data-confirm-processing]');section.hidden=false;err.hidden=true;
   try{const data=await window.TPFRouterReturn.preview({id:o.id,operator:x.operator,netflix:!!x.snapshot?.netflix_followup});if(!d.isConnected)return;
    if(!data.available)throw Error(data.reason||'No se puede preparar el envío: revisa el destinatario y la plantilla de instalación.');
    if(data.recipient||data.phone)body.querySelector('[data-recipient]').textContent='WhatsApp para: '+(data.recipient||'')+' · '+(data.phone||'Sin teléfono válido');
    const binding=window.TPFRouterReturn.bind(body.querySelector('[data-router]'),data,{id:o.id,operator:x.operator,preferences:{...(data.preferences||{}),...(o.after_sale_preferences||{}),send:true}});
    const previous=body.querySelector('[data-router] [data-previous]');previous?.addEventListener('change',()=>body.querySelector('[data-previous-label]').textContent=previous.value||'Sin indicar');
    if(previous?.value)body.querySelector('[data-previous-label]').textContent=previous.value;
    routerReady=true;button.disabled=false;button.onclick=async()=>{if(busy)return;err.hidden=true;try{
     const preferences=binding.get();setBusy(true);
     const sr=await sb.from('sales_stages').select('id,name,pipeline_id').eq('active',true);if(sr.error)throw sr.error;
     const stage=(sr.data||[]).find(s=>s.pipeline_id===o.pipeline_id&&String(s.name).trim().toLowerCase()==='tramitado');
     await binding.saveTemplate();await tramitate(o,stage,preferences);d.close();
    }catch(error){err.textContent=error.message||'No se pudo tramitar';err.hidden=false}finally{setBusy(false)}};
   }catch(error){err.textContent=error.message||'No se pudo preparar el mensaje';err.hidden=false}
  }
  body.querySelector('[data-accept]')?.addEventListener('click',async()=>{if(busy)return;setBusy(true);try{if(await window.TPFControlWhatsappOffer(x.id,'accept')){const current=await sb.from('sales_opportunities').select('*').eq('id',o.id).single();if(current.error)throw current.error;o=current.data;await f.load(true);if(!d.isConnected)return;const updated=f.state.offers.find(v=>String(v.id)===String(x.id));if(updated)body.querySelector('[data-follow-summary]').innerHTML=f.htmlOffer(updated,false);body.querySelector('[data-accept]').remove();body.querySelector('.ofActionButtons').hidden=true;await prepare()}}catch(error){const err=body.querySelector('[data-panel-error]');err.hidden=false;err.textContent=error.message}finally{setBusy(false);if(routerReady&&d.isConnected)body.querySelector('[data-confirm-processing]').disabled=false}});
  if(x.status==='accepted')await prepare();
  if(x.status==='error'){const p=body.querySelector('[data-of-error-detail]');p.hidden=false;p.textContent='Consultando el motivo…';const er=await sb.from('crm_server_automation_jobs').select('error_message').eq('status','failed').contains('context',{offer_instance_id:x.id}).order('updated_at',{ascending:false}).limit(1);if(d.isConnected)p.textContent=er.error?'No se pudo consultar el motivo.':er.data?.[0]?.error_message||'No hay detalle registrado del fallo.';}
 }catch(error){if(d.isConnected)body.textContent='No se pudo abrir la gestión. '+(error.message||'Vuelve a intentarlo.')}
}
window.TPFHomeManage={open,identity,tramitate};
if(sb.auth?.onAuthStateChange)sb.auth.onAuthStateChange((event,session)=>{if(!session)document.getElementById('ofManageDialog')?.close()});
const style=document.createElement('style');style.textContent=`#ofManageDialog.ofManageDrawer{box-sizing:border-box;position:fixed;inset:0 0 0 auto;margin:0;border:0;border-left:1px solid #dbe4ef;border-radius:0;padding:0;width:min(600px,100vw);height:100dvh;max-height:100dvh;max-width:100vw;overflow:auto;box-shadow:-12px 0 40px #14233724;color:#24354b}#ofManageDialog.ofManageDrawer::backdrop{background:#14233733}.ofDrawerHead,.ofDrawerFoot{position:sticky;z-index:2;background:white;display:flex;align-items:center;justify-content:space-between;padding:16px 22px;border-bottom:1px solid #dbe4ef}.ofDrawerHead{top:0}.ofDrawerHead h3{margin:0!important;font-size:20px!important}.ofDrawerHead button{font-size:24px!important;border:0;background:transparent}.ofDrawerFoot{bottom:0;border-top:1px solid #dbe4ef;border-bottom:0}.ofDrawerBody{padding:20px 22px}.ofDrawerBody h2{margin:0 0 6px;font-size:23px}.ofDrawerBody p{font-size:13px;line-height:1.5}.ofDrawerBody button,.ofDrawerFoot button{border:1px solid #cad6e5;background:white;color:#245fba;border-radius:8px;padding:9px 12px;cursor:pointer}.ofDrawerBody button:disabled{opacity:.5;cursor:wait}.ofDrawerSection{border-top:1px solid #e2e8f0;margin-top:20px;padding-top:16px}.ofDrawerSection h4{margin:0 0 10px;font-size:15px}.ofDrawerSection summary{font-weight:600;cursor:pointer}.ofIdentityGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px}.ofIdentityGrid>div{background:#f4f7fb;border-radius:9px;padding:10px;min-width:0}.ofIdentityGrid small,.ofIdentityGrid strong{display:block;overflow-wrap:anywhere}.ofIdentityGrid small{font-size:11px;color:#64748b;margin-bottom:5px}.ofIdentityGrid strong{font-size:14px}.ofIdentityGrid button{margin-top:6px;padding:4px 8px;font-size:11px}.ofConfirmProcessing{background:#0866ef!important;color:white!important;width:100%;margin-top:14px;font-weight:700}#ofManageDialog [data-process-error]{color:#b42318}#ofManageDialog .tpfRouterColumns{grid-template-columns:1fr;gap:8px}#ofManageDialog [data-text]{min-height:200px}#ofManageDialog [hidden]{display:none!important}@media(max-width:600px){.ofDrawerHead,.ofDrawerFoot{padding:14px 16px}.ofDrawerBody{padding:16px}}`;document.head.appendChild(style);
})();
