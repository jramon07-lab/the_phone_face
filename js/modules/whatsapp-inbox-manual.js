/* Shared conversation organization; never modifies automation jobs. */
(function(){
'use strict';
const $=id=>document.getElementById(id),rows=new Map(),busy=new Set();let generation=0,loading=false;
const state=()=>{try{return waLiveState}catch(_){return window.waLiveState}};
const db=()=>{try{return sb}catch(_){return window.sb}};
const stamp=x=>Date.parse(x||'')/1000||0;
const current=()=>state()?.selected?.id;
function category(chat,incoming){
 const r=rows.get(String(chat.id));if(!r)return null;
 if(Number(window.waMeta?.(chat.id)?.archivedAt||0)>=stamp(r.inbox_since))return null;
 if(incoming>stamp(r.inbox_since)&&['waiting','snoozed'].includes(r.inbox_state))return 'unanswered';
 if(r.inbox_state==='waiting')return 'waiting';
 if(r.inbox_state==='pending')return 'unanswered';
 if(r.inbox_state==='snoozed')return stamp(r.inbox_until)>Date.now()/1000?'snoozed':'unanswered';
 return null;
}
function describe(chat){const r=rows.get(String(chat.id));if(!r)return '';const inc=Math.max(chat._lastIncomingAt||0,window.waMeta?.(chat.id)?.lastIncomingAt||0);if(inc>stamp(r.inbox_since))return '';if(r.inbox_state==='waiting')return r.inbox_reason+' · desde '+new Date(r.inbox_since).toLocaleDateString('es-ES');if(r.inbox_state==='snoozed')return 'Recordatorio: '+new Date(r.inbox_until).toLocaleString('es-ES',{dateStyle:'short',timeStyle:'short'});return '';}
function refresh(){window.renderWhatsAppChats?.();window.waRefreshChatTopButtons?.();controls();}
async function sync(){
 if(loading||!db()?.from||document.hidden)return;loading=true;const revision=generation;
 try{const next=new Map();let after='';for(;;){let q=db().from('crm_whatsapp_chat_state').select('chat_id,inbox_state,inbox_reason,inbox_since,inbox_until').order('chat_id').limit(500);if(after)q=q.gt('chat_id',after);const {data,error}=await q;if(error)throw error;for(const r of data||[])next.set(r.chat_id,r);if((data||[]).length<500)break;after=data[data.length-1].chat_id;}if(revision===generation&&!busy.size){rows.clear();for(const [k,v] of next)rows.set(k,v);refresh();}}
 catch(e){console.warn('No se pudieron actualizar los estados de conversación',e)}finally{loading=false;}
}
async function save(id,kind,reason='',until=null){
 if(!id||busy.has(id))throw Error('Espera a que termine el guardado');if(!db()?.from)throw Error('No hay conexión');
 busy.add(id);generation++;
 try{
 const now=new Date().toISOString(),payload={chat_id:id,inbox_state:kind,inbox_reason:reason.slice(0,300),inbox_since:now,inbox_until:until,archived:false,reopened_at:now,updated_at:now};
 const {data,error}=await db().from('crm_whatsapp_chat_state').upsert(payload,{onConflict:'chat_id'}).select('chat_id,inbox_state,inbox_reason,inbox_since,inbox_until').single();if(error)throw error;
 rows.set(id,data);const apply=window.__tpfWaArchiveBaseSave||window.waMetaSave;apply?.(id,{archived:false},{render:false});refresh();return data;
 }finally{busy.delete(id);generation++;}
}
function open(kind){
 const id=current();if(!id)return;const selectedName=$('waChatName')?.textContent||'Conversación';$('waInboxDialog')?.remove();
 const d=document.createElement('dialog');d.id='waInboxDialog';
 d.innerHTML='<form><h2></h2><p class="waInboxDialogName"></p><div class="waInboxFields"></div><p>Si el cliente escribe, volverá a Pendientes.</p><p class="waInboxSafe">Los seguimientos automáticos continúan activos.</p><p role="alert" class="waInboxError"></p><footer><button type="button" class="secondary" data-cancel>Cancelar</button><button type="submit">Guardar</button></footer></form>';
 d.querySelector('h2').textContent=kind==='waiting'?'Dejar en espera':'Recordar conversación';d.querySelector('.waInboxDialogName').textContent=selectedName;
 const fields=d.querySelector('.waInboxFields');
 if(kind==='waiting')fields.innerHTML='<label>¿Qué esperas del cliente?<select name="reason"><option>Documentación del cliente</option><option>Confirmación del cliente</option><option>Respuesta a una consulta</option><option>Otro motivo</option></select></label><label>Detalle (opcional)<input name="detail" maxlength="240" placeholder="Por ejemplo: factura de este mes"></label>';
 else{const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);tomorrow.setHours(10,0,0,0);const pad=n=>String(n).padStart(2,'0');const value=tomorrow.getFullYear()+'-'+pad(tomorrow.getMonth()+1)+'-'+pad(tomorrow.getDate())+'T10:00';fields.innerHTML='<label>Fecha y hora<input name="until" type="datetime-local" required></label>';fields.querySelector('input').value=value;}
 d.querySelector('[data-cancel]').onclick=()=>d.close();d.addEventListener('close',()=>d.remove());
 d.querySelector('form').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,submit=form.querySelector('[type=submit]');submit.disabled=true;try{const f=new FormData(form);let until=null,reason='';if(kind==='waiting')reason=String(f.get('reason'))+(f.get('detail')?' — '+f.get('detail'):'');else{const date=new Date(String(f.get('until')));if(!Number.isFinite(date.getTime())||date<=new Date())throw Error('Elige una fecha y hora futuras');until=date.toISOString();}await save(id,kind,reason,until);d.close();}catch(error){d.querySelector('.waInboxError').textContent=error.message||'No se pudo guardar';}finally{submit.disabled=false;}};
 document.body.append(d);d.showModal();
}
function controls(){
 const actions=document.querySelector('#view-whatsapplive .waChatTopActions');if(!actions)return;
 for(const [id,label,kind] of [['waWaitManual','En espera','waiting'],['waSnoozeManual','Recordar mañana','snoozed']]){if(!$(id)){const b=document.createElement('button');b.id=id;b.type='button';b.className='secondary';b.textContent=label;b.onclick=()=>open(kind);actions.insertBefore(b,$('waArchiveChat'));}}
 const tabs=document.querySelector('#view-whatsapplive .waTabs'),host=tabs?.querySelector('.waCleanFilters>div')||tabs;
 if(host&&!document.querySelector('[data-wa-tab="snoozed"]')){const b=document.createElement('button');b.type='button';b.dataset.waTab='snoozed';b.textContent='Aplazados';host.append(b);}
}

// Offer a separate, explicit close action after a known sale moves to Tramitado.
const saleStages=new Map();
window.addEventListener('tpf:sales-updated',event=>{
 const opportunities=event.detail?.opportunities;if(!Array.isArray(opportunities))return;
 let stages=[];try{stages=salesCache.stages||[]}catch(_){}
 for(const opp of opportunities){const old=saleStages.get(String(opp.id));saleStages.set(String(opp.id),String(opp.stage_id));if(old===undefined||old===String(opp.stage_id))continue;
 const stage=stages.find(s=>String(s.id)===String(opp.stage_id));if(String(stage?.name||'').toLowerCase().trim()!=='tramitado')continue;
 const phone=String(opp.phone||'').replace(/\D/g,'').slice(-9);if(phone.length!==9)continue;
 const chat=state()?.chats?.find(c=>String(c.id).split('@')[0].replace(/\D/g,'').slice(-9)===phone);if(!chat)continue;
 $('waSaleResolvedNotice')?.remove();const notice=document.createElement('div');notice.id='waSaleResolvedNotice';notice.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:95000;background:white;border:1px solid #dce4ee;box-shadow:0 8px 35px #15253f30;border-radius:10px;padding:16px;max-width:90vw';
 const label=document.createElement('p');label.textContent='Venta tramitada: '+(chat.name||opp.client_name||'Cliente')+'. ¿Marcar también la conversación como atendida?';notice.append(label);
 const close=document.createElement('button');close.textContent='Resolver conversación';close.onclick=()=>{window.waMetaSave?.(chat.id,{archived:true,archivedAt:Math.floor(Date.now()/1000)},{render:true});notice.remove();refresh();};
 const dismiss=document.createElement('button');dismiss.textContent='Mantener abierta';dismiss.className='secondary';dismiss.onclick=()=>notice.remove();notice.append(close,dismiss);document.body.append(notice);
 }
});

window.TPFInboxManual={category,describe,save,sync,open};
const style=document.createElement('style');style.textContent='#waInboxDialog{width:min(440px,90vw);padding:26px;border:1px solid #dde5ef;border-radius:12px;color:#20344f;box-shadow:0 16px 60px #15253f30}#waInboxDialog::backdrop{background:#15253f30}#waInboxDialog h2{margin:0 0 12px;font-size:20px}#waInboxDialog p{font-size:13px;line-height:1.6}#waInboxDialog label{display:block;font-size:13px;margin:16px 0}#waInboxDialog input,#waInboxDialog select{display:block;width:100%;padding:11px;margin-top:8px;box-sizing:border-box}#waInboxDialog footer{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}.waInboxSafe{background:#edf7f1;color:#2f7150;padding:12px;border-radius:7px}.waInboxError{color:#b42318}.waInboxReason{display:block;font-size:10px;color:#667085;white-space:normal;margin-top:5px}#view-whatsapplive .waChatTopActions{flex-wrap:wrap}#view-whatsapplive #waWaitManual,#view-whatsapplive #waSnoozeManual{font-size:11px;padding:7px!important}';document.head.append(style);
 function install(){controls();sync();setInterval(()=>{if(!document.hidden){sync();refresh();}},20000);window.addEventListener('focus',sync);window.addEventListener('online',sync);document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
