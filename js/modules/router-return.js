(function(){
'use strict';
const $=id=>document.getElementById(id);
const paragraphs={
 Yoigo:'📦 Te llegará un código por SMS para devolver el router anterior en Correos. El SMS puede tardar hasta 15 días en llegar.',
 'MásMóvil':'📦 Te llegará un código por SMS para devolver el router anterior en Correos. El SMS puede tardar hasta 15 días en llegar.',
 O2:'📦 Tienes que devolver el router anterior en una tienda Movistar.',
 Vodafone:'📦 Te llegarán las instrucciones para devolver el router anterior en Correos. Pueden tardar unos 15 días en llegar.',
 Ninguno:'',Otro:'📦 Escribe aquí las instrucciones para devolver el router anterior.'
};
function message(body,previous){return String(body||'').replace(/(?:\n[ \t]*)*📦[^\n]*(?:\n[^\n]+)*/u,'').trim()+(paragraphs[previous]?'\n\n'+paragraphs[previous]:'')}
function returnOnly(body,previous){const greeting=String(body||'').split(/\n[ \t]*\n/)[0].trim();return message(greeting,previous)}
function madridIso(value){
 if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value))throw Error('Elige una fecha y hora.');
 const nominal=Date.parse(value+':00Z');let stamp=nominal;
 for(let i=0;i<3;i++){const p=Object.fromEntries(new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(stamp)).map(x=>[x.type,x.value]));const shown=Date.parse(p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute+':00Z');stamp+=nominal-shown;}
 const actual=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(stamp)).replace(' ','T');
 if(actual!==value)throw Error('Esa hora no existe por el cambio de horario.');
 if(stamp<=Date.now()+60000)throw Error('Elige una fecha y hora futuras.');
 return new Date(stamp).toISOString();
}
function nextDaySlot(now=Date.now()){
 const rounded=new Date(Math.ceil(Number(now)/1800000)*1800000);
 const local=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(rounded).replace(' ','T');
 const day=new Date(local.slice(0,10)+'T12:00:00Z');day.setUTCDate(day.getUTCDate()+1);
 return day.toISOString().slice(0,10)+local.slice(10);
}
function fields(){return '<div class="tpfRouterFields"><label>Tipo de mensaje<select data-mode><option value="full">Instalación y devolución</option><option value="return">Solo devolución del router</option></select></label><label>Operador anterior<select data-previous><option value="">Selecciona el operador anterior</option>'+Object.keys(paragraphs).map(x=>'<option value="'+x+'">'+(x==='Ninguno'?'Sin router que devolver':x==='Otro'?'Otro operador (texto manual)':x)+'</option>').join('')+'</select></label><label class="tpfRouterCheck"><input type="checkbox" data-send><span>Enviar este mensaje al cliente</span></label><p data-recipient></p><p data-status></p><label>Mensaje que recibirá el cliente<textarea data-text rows="7" maxlength="10000"></textarea></label><small>Mensaje editable. Al cambiar el operador anterior se actualiza el párrafo del router.</small><label>Cuándo enviarlo<select data-timing><option value="day_one">Día siguiente, a la hora de creación</option><option value="custom">Elegir fecha y hora</option></select></label><p data-default-time></p><div data-date-label hidden><label>Fecha (Madrid)<input type="date" data-date></label><label>Hora<select data-hour>'+Array.from({length:24},(_,i)=>'<option>'+String(i).padStart(2,'0')+'</option>').join('')+'</select></label><label>Minutos<select data-minute><option>00</option><option>30</option></select></label></div><small>Hora automática redondeada al siguiente tramo de 00 o 30 minutos. El envío se ajustará al horario de atención.</small><p data-error role="alert"></p></div>';}
function style(){if($('tpfRouterStyle'))return;const s=document.createElement('style');s.id='tpfRouterStyle';s.textContent='#tpfRouterDialog{width:min(620px,calc(100vw - 28px));max-height:calc(100dvh - 28px);overflow:auto;border:1px solid #dbe4ef;border-radius:14px;padding:20px;color:#24354b}#tpfRouterDialog::backdrop{background:#14233788}#tpfRouterDialog header,#tpfRouterDialog footer{display:flex;justify-content:space-between;gap:12px;align-items:center}#tpfRouterDialog h3{margin:0;font-size:19px} .tpfRouterFields label{display:block;margin:12px 0;font-size:13px;font-weight:700}.tpfRouterFields select,.tpfRouterFields textarea,.tpfRouterFields input[type=date]{display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:9px;border:1px solid #cbd5e1;border-radius:9px;background:#fff;color:#24354b;font:inherit}.tpfRouterFields textarea{background:#f4faf2;line-height:1.5;resize:vertical}.tpfRouterFields small,.tpfRouterFields p{display:block;color:#64748b;font-size:12px;line-height:1.4}.tpfRouterFields .tpfRouterCheck{display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:9px!important}.tpfRouterFields .tpfRouterCheck input{flex:none;width:16px!important;height:16px;margin:0!important}.tpfRouterFields [data-date-label]{display:grid;grid-template-columns:minmax(130px,2fr) minmax(65px,1fr) minmax(65px,1fr);gap:8px}.tpfRouterFields [data-error]{color:#b42318}.tpfRouterFields [hidden]{display:none!important}#tpfRouterDialog button{padding:9px 14px;border-radius:9px}#tpfRouterDialog footer{margin-top:16px}#directSaleModal .tpfRouterFields label:not(.tpfRouterCheck){display:block!important;width:100%;margin:12px 0!important}#directSaleModal .tpfRouterFields select,#directSaleModal .tpfRouterFields textarea,#directSaleModal .tpfRouterFields input[type=date]{width:100%!important;font-weight:400!important}#directSaleModal .tpfRouterFields [data-date-label] label{min-width:0}#directSaleModal .tpfRouterFields textarea{min-height:190px;max-height:320px}';document.head.appendChild(s);}
function bind(root,data,options={}){
 style();root.innerHTML=fields();const q=x=>root.querySelector('[data-'+x+']');
 const mode=q('mode'),previous=q('previous'),text=q('text'),send=q('send'),timing=q('timing'),date=q('date'),hour=q('hour'),minute=q('minute');
 const saved=options.preferences||data.preferences||{},available=!!data.available;
 previous.value=saved.previous_operator||'';mode.value=saved.message_mode||(saved.text?.includes('📦')&&!saved.text.includes('Cuando te instalen')?'return':'full');
 text.value=saved.text||(mode.value==='return'?returnOnly(options.text||data.text,previous.value):message(options.text||data.text,previous.value));
 const drafts={[mode.value]:text.value};let activeMode=mode.value;
 send.checked=available&&options.send!==false&&saved.send!==false;send.disabled=!available;
 q('recipient').textContent='Para '+(data.recipient||'Sin contacto vinculado')+(data.phone?' · '+data.phone:'');
 q('status').textContent=available?'':'Este operador nuevo no tiene mensaje de instalación configurado.';
 const slot=saved.local_date||nextDaySlot();date.value=slot.slice(0,10);hour.value=slot.slice(11,13);minute.value=slot.slice(14,16);timing.value=saved.timing||'day_one';
 q('default-time').textContent='Hora automática: '+hour.value+':'+minute.value+' (Madrid), el día siguiente. Se tomará la hora al crear la venta.';
 const update=()=>{for(const el of [mode,previous,text,timing,date,hour,minute])el.disabled=!send.checked;q('date-label').hidden=timing.value!=='custom';q('default-time').hidden=timing.value==='custom';options.onchange?.();};
 previous.onchange=()=>{text.value=message(text.value,previous.value);update();};
 mode.onchange=()=>{drafts[activeMode]=text.value;activeMode=mode.value;text.value=message(drafts[activeMode]||(activeMode==='return'?returnOnly(text.value,previous.value):data.text),previous.value);update();};send.onchange=update;timing.onchange=update;update();
 return {available,send,previous,text,get(){
  if(send.checked&&!previous.value)throw Error('Selecciona el operador anterior o «Sin router que devolver».');
  if(send.checked&&!text.value.trim())throw Error('El mensaje no puede estar vacío.');
  if(send.checked&&previous.value==='Otro'&&text.value.includes(paragraphs.Otro))throw Error('Escribe las instrucciones del operador anterior.');
  if(!['00','30'].includes(minute.value))throw Error('Los minutos deben ser 00 o 30.');
  return {message_mode:mode.value,previous_operator:previous.value||'Ninguno',text:text.value.trim(),send:send.checked,send_at:send.checked?madridIso(timing.value==='custom'?date.value+'T'+hour.value+':'+minute.value:nextDaySlot()):null,operator:data.operator||options.operator||'',rule_id:data.rule_id||null};
 },snapshot(){return {message_mode:mode.value,previous_operator:previous.value,text:text.value,send:send.checked,timing:timing.value,local_date:date.value+'T'+hour.value+':'+minute.value};}};
}
async function preview(options){const {data,error}=await sb.rpc('crm_router_return_preview',{p_opportunity_id:options.id||null,p_contact_id:options.contactId||null,p_manager_contact_id:options.managerId||null,p_recipient_contact_id:options.recipientId||null,p_operator:options.operator||null,p_netflix_followup:!!options.netflix});if(error)throw error;return data;}
async function choose(options){
 if($('tpfRouterDialog'))throw Error('Termina primero la devolución de router abierta.');
 const data=await preview(options),d=document.createElement('dialog');d.id='tpfRouterDialog';d.setAttribute('aria-label','Tramitado: instalación y devolución de router');
 d.innerHTML='<form method="dialog"><header><h3>Instalación y devolución del router</h3><button value="cancel" aria-label="Cerrar">×</button></header><div data-fields></div><footer><button value="cancel">Cancelar</button><button value="save" class="primary">Confirmar y continuar</button></footer></form>';
 document.body.appendChild(d);const controller=bind(d.querySelector('[data-fields]'),data,options);
 return new Promise(resolve=>{d.addEventListener('close',()=>{const result=d._result||null;d.remove();resolve(result);},{once:true});d.querySelector('form').addEventListener('submit',e=>{if(e.submitter?.value!=='save')return;e.preventDefault();try{d._result=controller.get();d.close('save');}catch(error){d.querySelector('[data-error]').textContent=error.message;}});d.showModal();});
}
async function prepare(id,payload){
 if(!payload.stage_id||payload.after_sale_preferences)return payload;
 let stage=(typeof salesCache!=='undefined'?salesCache.stages:[])?.find(x=>String(x.id)===String(payload.stage_id));
 if(!stage){const r=await sb.from('sales_stages').select('id,name').eq('id',payload.stage_id).single();if(r.error)throw r.error;stage=r.data;}
 if(String(stage?.name||'').trim().toLowerCase()!=='tramitado')return payload;
 let current=id?(typeof salesCache!=='undefined'?salesCache.opportunities:[])?.find(x=>String(x.id)===String(id)):null;
 if(id&&!current){const r=await sb.from('sales_opportunities').select('id,stage_id').eq('id',id).single();if(r.error)throw r.error;current=r.data;}
 if(current&&String(current.stage_id)===String(payload.stage_id))return payload;
 const party=payload.contract_party||{},operator=(String(payload.title||'').match(/\b(Vodafone|Yoigo|MásMóvil|Masmovil|O2|Orange|Lowi)\b/i)||[])[1];
 const prefs=await choose({id,contactId:payload.record_id,managerId:party.manager_contact_id,recipientId:party.recipient_contact_id,operator});
 return prefs?{...payload,after_sale_preferences:prefs}:null;
}
window.TPFRouterReturn={choose,bind,preview,nextDaySlot,prepare:async(id,payload)=>{try{return await prepare(id,payload);}catch(error){alert('No se pudo preparar Tramitado: '+error.message);return null;}},message,returnOnly,madridIso,paragraphs};
})();
