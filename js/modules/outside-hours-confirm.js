(function(){
'use strict';
if(window.TPFOutsideHours)return;
const nativeFetch=window.fetch.bind(window),ZONE='Europe/Madrid',HEADER='x-client-info';
function parts(at){return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(at).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));}
function atLocal(p,minute){let t=Date.UTC(p.year,p.month-1,p.day,Math.floor(minute/60),minute%60);for(let i=0;i<3;i++){const v=parts(new Date(t));t+=Date.UTC(p.year,p.month-1,p.day,Math.floor(minute/60),minute%60)-Date.UTC(v.year,v.month-1,v.day,v.hour,v.minute);}return new Date(t);}
function nextWindow(at=new Date()){
 const p=parts(at),dow=new Date(Date.UTC(p.year,p.month-1,p.day)).getUTCDay(),m=p.hour*60+p.minute;
 if(dow!==0&&(m>=600&&m<840||dow!==6&&m>=1050&&m<1230))return null;
 if(dow!==0&&m<600)return atLocal(p,600);
 if(dow!==0&&dow!==6&&m<1050)return atLocal(p,1050);
 const d=new Date(Date.UTC(p.year,p.month-1,p.day+(dow===6?2:1)));return atLocal({year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate()},600);
}
function classify(url,method,body,now=new Date()){
 if(method!=='POST'&&method!=='PATCH')return null;
 const rpc=url.hostname==='overfzbjtpjqxzbujezg.supabase.co'&&url.pathname.startsWith('/rest/v1/rpc/'),name=rpc?url.pathname.split('/').pop():'';
 const direct=url.origin===location.origin&&['/api/green','/api/mobile-green','/api/green-reply','/api/green-file-safe'].includes(url.pathname)&&(['send','sendbuttons','sendfile'].includes(url.searchParams.get('action'))||url.pathname==='/api/green-reply'||url.pathname==='/api/green-file-safe');
 const agenda=url.hostname==='overfzbjtpjqxzbujezg.supabase.co'&&url.pathname==='/rest/v1/agenda_items'&&body?.whatsapp_enabled===true;
 let sends=direct||agenda;
 if(rpc){
  sends=/^crm_create_contact_(?:with_welcome(?:_variant)?|guarded)$/.test(name)&&body?.p_welcome===true;
  sends=sends||/^crm_create_(?:offer_(?:composition|execution_v\d+)|direct_sale(?:_v\d+)?)$/.test(name)&&body?.p_send_message===true;
  sends=sends||['crm_change_offer_stage','crm_set_opportunity_stage_guarded','crm_create_opportunity_guarded_v2'].includes(name)&&(['Tramitado'].includes(body?.p_stage)||!!body?.p_after_sale)&&((body?.p_preferences||body?.p_after_sale)?.send===true||(body?.p_preferences||body?.p_after_sale)?.communication_mode==='return');
  const patch=body?.p_patch||body?.p_preferences;
  sends=sends||['crm_installation_update','crm_installation_adopt'].includes(name)&&(patch?.send===true||patch?.communication_mode==='return'||!!patch?.confirm_installed_on);
  sends=sends||name==='crm_control_scheduled_whatsapp'&&['resume','retry'].includes(body?.p_action);
  sends=sends||['crm_retry_automation_step','crm_retry_automation_job_safe','crm_send_automation_now'].includes(name);
 }
 if(!sends)return null;
 const target=agenda?body.whatsapp_scheduled_at:body?.p_send_at;
 const date=target&&Number.isFinite(Date.parse(target))?new Date(target):now,next=nextWindow(date);
 if(!next)return null;
 return {direct,rpc,agenda,name,next:next.toISOString(),at:date.toISOString(),scheduled:!!target,label:body?.p_welcome?'Bienvenida':direct?'WhatsApp':'Mensaje al cliente',message:body?.message||body?.p_message_text||body?.p_group_message||body?.whatsapp_message||body?.p_patch?.text||''};
}
let dialogQueue=Promise.resolve();
function choose(info){const pending=dialogQueue.then(()=>new Promise(resolve=>{
 const d=document.createElement('dialog');d.id='tpfOutsideHoursDialog';d.setAttribute('aria-labelledby','tpfOutsideTitle');
 d.innerHTML='<style>#tpfOutsideHoursDialog{box-sizing:border-box;width:min(520px,calc(100vw - 24px));max-height:85dvh;overflow:auto;border:1px solid #d5deea;border-radius:14px;padding:22px;color:#243247;background:white}#tpfOutsideHoursDialog::backdrop{background:#0f172a88}#tpfOutsideHoursDialog h3{margin-top:0}#tpfOutsideHoursDialog button{width:100%;padding:13px;margin-top:9px;border:1px solid #cbd5e1;border-radius:9px;background:white;font:inherit}#tpfOutsideHoursDialog [data-choice=now]{background:#175cd3;color:white}#tpfOutsideHoursDialog pre{white-space:pre-wrap;max-height:180px;overflow:auto;font:inherit;background:#f1f5f9;padding:12px;border-radius:8px}</style><h3 id="tpfOutsideTitle">Fuera de horario</h3><p data-description></p><p>Horario de Madrid: lunes a viernes, 10:00–14:00 y 17:30–20:30; sábados, 10:00–14:00.</p><pre hidden></pre><button type="button" data-choice="now">Sí, enviar ahora</button><button type="button" data-choice="next">Dejar para la próxima franja</button><button type="button" data-choice="cancel">Cancelar y volver</button>';
 const format=value=>new Date(value).toLocaleString('es-ES',{timeZone:ZONE,dateStyle:'full',timeStyle:'short'});
 d.querySelector('[data-description]').textContent=info.scheduled
  ? 'La hora elegida ('+format(info.at)+') está fuera del horario de envío. Puedes conservarla o programar para la próxima franja: '+format(info.next)+'.'
  : info.label+' está fuera del horario de envío. Próxima franja: '+format(info.next)+'. Tú decides si continuar.';
 if(info.scheduled){
  d.querySelector('[data-choice=now]').textContent='Programar para '+format(info.at);
  d.querySelector('[data-choice=next]').textContent='Programar para '+format(info.next);
 }
 if(info.message){d.querySelector('pre').hidden=false;d.querySelector('pre').textContent=info.message;}
 // Direct provider requests have no durable queue. Never pretend they were scheduled.
 d.querySelector('[data-choice=next]').hidden=info.direct;
 let finished=false;const finish=value=>{if(finished)return;finished=true;d.close();d.remove();resolve(value);};
 d.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>finish(b.dataset.choice));d.addEventListener('cancel',e=>{e.preventDefault();finish('cancel');});
 document.body.appendChild(d);d.showModal();d.querySelector('[data-choice=cancel]').focus();
 }));dialogQueue=pending.catch(()=>{});return pending;}
const scheduleChoices=new Map();
const api={nextWindow,classify,choose,consumeScheduleChoice(original,saved){
 const key=new Date(original).toISOString(),chosen=scheduleChoices.get(key);
 scheduleChoices.delete(key);
 return !!chosen&&Date.parse(chosen)===Date.parse(saved);
}};window.TPFOutsideHours=api;
window.fetch=async function(input,init){
 const request=input instanceof Request?input:null,url=new URL(request?request.url:String(input),location.href),method=String(init?.method||request?.method||'GET').toUpperCase();
 if(method!=='POST'&&method!=='PATCH')return nativeFetch(input,init);
 let body=null,raw=init?.body;
 if(raw===undefined&&request&&String(request.headers.get('content-type')||'').includes('application/json')){try{raw=await request.clone().text();}catch(_){return nativeFetch(input,init);}}
 if(typeof raw==='string'){try{body=JSON.parse(raw);}catch(_){}}
 const info=classify(url,method,body);if(!info)return nativeFetch(input,init);
 const decision=await api.choose(info);
 if(decision==='cancel')return new Response(JSON.stringify({ok:false,code:'TPF_SEND_CANCELLED',error:'Envío cancelado. No se ha guardado ni enviado.',message:'Envío cancelado. No se ha guardado ni enviado.'}),{status:409,headers:{'content-type':'application/json'}});
 const headers=new Headers(init?.headers||request?.headers);if(info.rpc)headers.set(HEADER,(headers.get(HEADER)||'')+' tpf-outside-hours='+decision);
 if(info.scheduled||info.agenda){const key=info.agenda?'whatsapp_scheduled_at':'p_send_at';body[key]=decision==='next'?info.next:info.at;if(info.agenda)body.starts_at=body[key];raw=JSON.stringify(body);}
 const options={...init,method,headers,...(raw!==undefined?{body:raw}:{})};
 const result=await nativeFetch(request?new Request(request,options):input,request?undefined:options);
 if(result.ok&&info.agenda&&info.scheduled){
  if(scheduleChoices.size>=100)scheduleChoices.clear();
  scheduleChoices.set(info.at,body.whatsapp_scheduled_at);
 }
 if(result.ok&&decision==='next'){const note=document.createElement('div');note.setAttribute('role','status');note.style.cssText='position:fixed;bottom:100px;left:12px;right:12px;z-index:2147483647;background:#edf4ff;border:1px solid #2563eb;color:#163a70;padding:15px;border-radius:10px';note.textContent='Envío previsto: '+new Date(info.next).toLocaleString('es-ES',{timeZone:ZONE,dateStyle:'short',timeStyle:'short'});document.body.appendChild(note);setTimeout(()=>note.remove(),8000);}
 return result;
};
})();
