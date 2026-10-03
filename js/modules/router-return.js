(function(){
'use strict';
const $=id=>document.getElementById(id);
const paragraphs={
 Yoigo:'📦 Te llegará un código por SMS para devolver el router anterior en Correos. El SMS puede tardar hasta 15 días en llegar.',
 'MásMóvil':'📦 Te llegará un código por SMS para devolver el router anterior en Correos. El SMS puede tardar hasta 15 días en llegar.',
 O2:'📦 Tienes que devolver el router anterior en una tienda Movistar.',
 Vodafone:'📦 Te llegarán las instrucciones para devolver el router anterior en Correos. Pueden tardar unos 15 días en llegar.',
 Digi:'📦 Contacta con Digi para confirmar cómo y en qué plazo debes devolver el router anterior. Conserva el justificante de devolución.',
 Pepephone:'📦 Contacta con Pepephone para confirmar cómo y en qué plazo debes devolver el router anterior. Conserva el justificante de devolución.',
 Jazztel:'📦 Contacta con Jazztel para confirmar cómo y en qué plazo debes devolver el router anterior. Conserva el justificante de devolución.',
 Orange:'📦 Contacta con Orange para confirmar cómo y en qué plazo debes devolver el router anterior. Conserva el justificante de devolución.',
 Lowi:'📦 Contacta con Lowi para confirmar cómo y en qué plazo debes devolver el router anterior. Conserva el justificante de devolución.',
 Movistar:'📦 Contacta con Movistar para confirmar cómo y en qué plazo debes devolver el router anterior. Conserva el justificante de devolución.',
 Ninguno:'',Otro:'📦 Escribe aquí las instrucciones para devolver el router anterior.'
};
const defaults={...paragraphs},templatePrefix='crm_router_template:';
const escapeHtml=value=>String(value).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
function operatorName(value){const name=String(value||'').normalize('NFKC').trim().replace(/\s+/g,' ');if(!name||name.length>80||/[\x00-\x1f]/.test(name)||['__proto__','prototype','constructor','Ninguno','Otro'].includes(name))throw Error('Indica un nombre de operador válido (máximo 80 caracteres).');return Object.keys(paragraphs).find(x=>x.toLocaleLowerCase('es')===name.toLocaleLowerCase('es'))||name;}
function operatorOptions(){return Object.keys(paragraphs).map(x=>'<option value="'+escapeHtml(x)+'">'+escapeHtml(x==='Ninguno'?'Sin router que devolver':x==='Otro'?'Otro operador (texto manual)':x)+'</option>').join('');}
async function loadTemplates(){
 const {data,error}=await sb.from('app_settings').select('key,value').like('key',templatePrefix+'%');if(error)throw error;
 for(const name of Object.keys(paragraphs))delete paragraphs[name];Object.assign(paragraphs,defaults);
 for(const row of data||[]){try{const name=operatorName(row.value?.operator),body=String(row.value?.text||'').trim();if(body&&body.length<=4000)paragraphs[name]=body.startsWith('📦')?body:'📦 '+body;}catch(_){}}
}
async function storeTemplate(operator,body){
 const name=operatorName(operator),text=String(body||'').trim();if(!text||text.length>4000)throw Error('Escribe las instrucciones de devolución (máximo 4000 caracteres).');
 const value={operator:name,text:text.startsWith('📦')?text:'📦 '+text};
 const {data,error}=await sb.from('app_settings').upsert({key:templatePrefix+encodeURIComponent(name.toLocaleLowerCase('es')),value,updated_at:new Date().toISOString()},{onConflict:'key'}).select('key,value').single();
 if(error)throw error;if(!data?.value?.text)throw Error('No se pudo verificar el texto guardado.');paragraphs[name]=data.value.text;return name;
}
function namedParagraph(previous,paragraph){
 const content=String(paragraph||'').trim();if(!content||!previous||['Ninguno','Otro'].includes(previous))return content;
 const instructions=content.replace(/^📦[ \t]*/u,'').replace(/^Devolución del router de [^\n]+\n/u,'');
 return '📦 Devolución del router de '+previous+'\n'+instructions;
}
function nameExistingMessage(body,previous){return String(body||'').replace(/📦[\s\S]*$/u,paragraph=>namedParagraph(previous,paragraph));}
function message(body,previous,paragraph=paragraphs[previous]){paragraph=namedParagraph(previous,paragraph);return String(body||'').replace(/(?:\n[ \t]*)*📦[^\n]*(?:\n[^\n]+)*/u,'').trim()+(paragraph?'\n\n'+paragraph:'')}
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
// Mirrors automaticSendWindow in the server runner. The requested send_at stays
// unchanged; this only previews the first allowed sending window in Madrid.
function businessSlot(local){
 const day=new Date(local.slice(0,10)+'T12:00:00Z');let minute=Number(local.slice(11,13))*60+Number(local.slice(14,16));
 const weekday=day.getUTCDay();
 if(weekday===0){day.setUTCDate(day.getUTCDate()+1);minute=600;}
 else if(weekday===6){if(minute<600)minute=600;else if(minute>=840){day.setUTCDate(day.getUTCDate()+2);minute=600;}}
 else if(minute<600)minute=600;
 else if(minute>=840&&minute<1050)minute=1050;
 else if(minute>=1230){day.setUTCDate(day.getUTCDate()+1);minute=600;}
 return day.toISOString().slice(0,10)+'T'+String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0');
}
function fields(){return `<div class="tpfRouterFields">
 <div class="tpfRouterOperator"><label>Operador anterior<select data-previous><option value="">Selecciona el operador anterior</option>${operatorOptions()}</select></label><button type="button" data-edit-template class="secondary">Editar texto del operador</button><button type="button" data-show-add class="secondary">+ Añadir operador</button></div>
 <div data-template-panel hidden><div data-add-panel hidden><label>Nuevo operador<input data-new-operator maxlength="80" placeholder="Nombre del operador"></label><button type="button" data-add-operator>Añadir operador</button></div><label>Instrucciones de devolución para este operador<textarea data-template rows="3" maxlength="4000"></textarea></label><small>Este texto es común para todos. Se guarda al confirmar la venta o al pulsar «Guardar texto para todos». El nombre del cliente se añade automáticamente.</small><button type="button" data-save-template class="primary">Guardar texto para todos</button><p data-template-status role="status"></p></div>
 <div class="tpfRouterColumns"><div><label>Mensaje para este cliente<textarea data-text rows="10" maxlength="10000"></textarea></label><small>Los cambios aquí se aplican solo a este cliente.</small></div>
 <div class="tpfRouterDelivery"><label class="tpfRouterCheck"><input type="checkbox" data-send><span>Enviar al cliente</span></label><p data-recipient></p><p data-status></p><label>Tipo de mensaje<select data-mode><option value="full">Instalación y devolución</option><option value="return">Solo devolución del router</option></select></label><label>Cuándo enviarlo<select data-timing><option value="day_one">Día siguiente, a la hora de creación</option><option value="custom">Elegir fecha y hora</option></select></label><div data-date-label hidden><label>Fecha (Madrid)<input type="date" data-date></label><label>Hora<select data-hour>${Array.from({length:24},(_,i)=>'<option>'+String(i).padStart(2,'0')+'</option>').join('')}</select></label><label>Minutos<select data-minute><option>00</option><option>30</option></select></label></div>
 <div class="tpfRouterForecast"><small>Envío previsto · Madrid</small><strong data-forecast></strong><small>Ajustado al horario de atención: lunes a viernes 10:00–14:00 y 17:30–20:30; sábado 10:00–14:00.</small><small data-default-time></small></div><button type="button" data-choose-time class="secondary">Elegir otra fecha y hora</button></div></div><p data-error role="alert"></p></div>`;}
function style(){if($('tpfRouterStyle'))return;const s=document.createElement('style');s.id='tpfRouterStyle';s.textContent=`
#tpfRouterDialog{width:min(960px,calc(100vw - 28px));box-sizing:border-box;max-height:calc(100dvh - 28px);overflow:auto;border:1px solid #dbe4ef;border-radius:14px;padding:20px;color:#24354b}#tpfRouterDialog::backdrop{background:#14233788}#tpfRouterDialog header,#tpfRouterDialog footer{display:flex;justify-content:space-between;gap:12px;align-items:center}#tpfRouterDialog h3{margin:0;font-size:19px}
.tpfRouterFields{container-type:inline-size}.tpfRouterFields label{display:block;margin:12px 0;font-size:13px;font-weight:700}.tpfRouterFields select,.tpfRouterFields textarea,.tpfRouterFields input[type=date],.tpfRouterFields input[data-new-operator]{display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:9px;border:1px solid #cbd5e1;border-radius:9px;background:#fff;color:#24354b;font:inherit}.tpfRouterFields textarea{background:#f4faf2;line-height:1.5;resize:vertical}.tpfRouterFields small,.tpfRouterFields p{display:block;color:#64748b;font-size:12px;line-height:1.4}.tpfRouterFields .tpfRouterCheck{display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:9px!important}.tpfRouterFields .tpfRouterCheck input{flex:none;width:16px!important;height:16px;margin:0!important}.tpfRouterFields [data-date-label]{display:grid;grid-template-columns:minmax(110px,2fr) minmax(60px,1fr) minmax(60px,1fr);gap:8px}.tpfRouterFields [data-template-panel]{border:1px solid #dbe4ef;border-radius:9px;padding:12px;background:#f8fafc}.tpfRouterFields [data-template]{min-height:90px!important}.tpfRouterFields [data-template-status]{color:#175cd3}.tpfRouterFields [data-error]{color:#b42318}.tpfRouterFields [hidden]{display:none!important}.tpfRouterFields button,#tpfRouterDialog button{padding:9px 14px;border-radius:9px;white-space:normal}.tpfRouterFields button:disabled{opacity:.5}#tpfRouterDialog footer{margin-top:16px}
.tpfRouterOperator{display:flex;gap:10px;align-items:end;flex-wrap:wrap}.tpfRouterOperator label{flex:1;min-width:200px;margin-bottom:0}.tpfRouterOperator button{margin-bottom:0}.tpfRouterColumns{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,2fr);gap:24px}.tpfRouterColumns>div{min-width:0}.tpfRouterFields [data-text]{min-height:300px}.tpfRouterForecast{padding:14px;background:#edf5ff;border:1px solid #d0e2fa;border-radius:10px;margin:14px 0}.tpfRouterForecast strong{display:block;font-size:18px;line-height:1.5;margin:5px 0;color:#175cd3}.tpfRouterDelivery [data-choose-time]{width:100%}
#directSaleModal .tpfRouterFields label:not(.tpfRouterCheck){display:block!important;width:100%;margin:12px 0!important}#directSaleModal .tpfRouterFields select,#directSaleModal .tpfRouterFields textarea,#directSaleModal .tpfRouterFields input[type=date]{width:100%!important;font-weight:400!important}#directSaleModal .tpfRouterFields [data-date-label] label{min-width:0}#directSaleModal .tpfRouterFields textarea{max-height:400px}
@container(max-width:680px){.tpfRouterColumns{grid-template-columns:minmax(0,1fr);gap:8px}.tpfRouterOperator label{flex-basis:100%}.tpfRouterOperator button{flex:1}.tpfRouterFields [data-text]{min-height:210px}}
@media(max-width:500px){#tpfRouterDialog{padding:14px}#tpfRouterDialog h3{font-size:17px}.tpfRouterFields [data-date-label]{grid-template-columns:minmax(0,1.7fr) minmax(0,1fr) minmax(0,1fr)}}`;document.head.appendChild(s);}
function bind(root,data,options={}){
 style();root.innerHTML=fields();const q=x=>root.querySelector('[data-'+x+']');
 const mode=q('mode'),previous=q('previous'),text=q('text'),send=q('send'),timing=q('timing'),date=q('date'),hour=q('hour'),minute=q('minute');
 const saved=options.preferences||data.preferences||{},available=!!data.available;
 if(saved.previous_operator&&!Object.hasOwn(paragraphs,saved.previous_operator)){const option=document.createElement('option');option.value=saved.previous_operator;option.textContent=saved.previous_operator;previous.appendChild(option);}previous.value=saved.previous_operator||'';mode.value=saved.message_mode||(saved.text?.includes('📦')&&!saved.text.includes('Cuando te instalen')?'return':'full');
 text.value=saved.text?nameExistingMessage(saved.text,previous.value):(mode.value==='return'?returnOnly(options.text||data.text,previous.value):message(options.text||data.text,previous.value));
 const drafts={[mode.value]:text.value},templateDrafts=new Map();let activeMode=mode.value;
 const template=q('template'),templateStatus=q('template-status');
 const editable=()=>previous.value&& !['Ninguno','Otro'].includes(previous.value);
 const paragraph=()=>editable()&&templateDrafts.has(previous.value)?'📦 '+templateDrafts.get(previous.value).replace(/^📦\s*/u,''):paragraphs[previous.value];
 const showTemplate=()=>{template.value=templateDrafts.get(previous.value)??String(paragraphs[previous.value]||'').replace(/^📦\s*/u,'');template.disabled=!editable();q('save-template').disabled=!editable();templateStatus.textContent='';q('edit-template').disabled=!editable();q('edit-template').textContent=editable()?'Editar texto de '+previous.value:'Editar texto del operador';};
 const saveTemplate=async()=>{if(!editable()||!templateDrafts.has(previous.value))return;const name=previous.value,body=templateDrafts.get(name);await storeTemplate(name,body);templateDrafts.delete(name);templateStatus.textContent='Texto guardado para '+name+' · Disponible para todos.';};
 template.addEventListener('input',()=>{templateDrafts.set(previous.value,template.value);text.value=message(text.value,previous.value,paragraph());options.onchange?.();});
 q('save-template').onclick=async()=>{const button=q('save-template');button.disabled=true;templateStatus.textContent='Guardando…';try{templateDrafts.set(previous.value,template.value);await saveTemplate();}catch(error){templateStatus.textContent='No se pudo guardar: '+error.message;}finally{button.disabled=!editable();}};
 q('add-operator').onclick=()=>{try{const name=operatorName(q('new-operator').value);if(![...previous.options].some(x=>x.value===name)){const option=document.createElement('option');option.value=name;option.textContent=name;previous.appendChild(option);templateDrafts.set(name,'Contacta con '+name+' para confirmar cómo y en qué plazo debes devolver el router anterior. Conserva el justificante de devolución.');}previous.value=name;previous.onchange();q('new-operator').value='';q('add-panel').hidden=true;template.focus();}catch(error){templateStatus.textContent=error.message;}};
 q('edit-template').onclick=()=>{q('template-panel').hidden=!q('template-panel').hidden;q('add-panel').hidden=true;if(!q('template-panel').hidden)template.focus();};
 q('show-add').onclick=()=>{q('template-panel').hidden=false;q('add-panel').hidden=false;q('new-operator').focus();};
 showTemplate();
 send.checked=available&&options.send!==false&&saved.send!==false;send.disabled=!available;
 q('recipient').textContent='Para '+(data.recipient||'Sin contacto vinculado')+(data.phone?' · '+data.phone:'');
 q('status').textContent=available?'':'Este operador nuevo no tiene mensaje de instalación configurado.';
 const slot=saved.local_date||nextDaySlot();date.value=slot.slice(0,10);hour.value=slot.slice(11,13);minute.value=slot.slice(14,16);timing.value=saved.timing||'day_one';
 const updateForecast=()=>{if(!send.checked){q('forecast').textContent='Sin envío';q('default-time').textContent='';return;}try{const requested=timing.value==='custom'?date.value+'T'+hour.value+':'+minute.value:nextDaySlot(),adjusted=businessSlot(requested);const iso=madridIso(adjusted);q('forecast').textContent=new Intl.DateTimeFormat('es-ES',{timeZone:'Europe/Madrid',weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}).format(new Date(iso));q('default-time').textContent=timing.value==='day_one'?'Se recalcula al confirmar con la hora de creación, redondeada a 00 o 30 minutos.':'Fecha elegida: '+requested.replace('T',' · ');}catch(error){q('forecast').textContent='Elige una fecha y hora futuras';q('default-time').textContent=error.message;}};
 const update=()=>{for(const el of [mode,previous,text,timing,date,hour,minute])el.disabled=!send.checked;q('date-label').hidden=timing.value!=='custom';updateForecast();options.onchange?.();};
 q('choose-time').onclick=()=>{timing.value='custom';update();date.focus();};for(const el of [date,hour,minute])el.onchange=update;
 previous.onchange=()=>{showTemplate();text.value=message(text.value,previous.value,paragraph());update();};
 mode.onchange=()=>{drafts[activeMode]=text.value;activeMode=mode.value;text.value=message(drafts[activeMode]||(activeMode==='return'?returnOnly(text.value,previous.value):data.text),previous.value,paragraph());update();};send.onchange=update;timing.onchange=update;update();
 return {available,send,previous,text,saveTemplate:async()=>{if(send.checked)await saveTemplate();},get(){
  if(send.checked&&!previous.value)throw Error('Selecciona el operador anterior o «Sin router que devolver».');
  if(send.checked&&editable()&&templateDrafts.has(previous.value)&&!template.value.trim())throw Error('Escribe las instrucciones de devolución del operador.');
  if(send.checked&&!text.value.trim())throw Error('El mensaje no puede estar vacío.');
  if(send.checked&&previous.value==='Otro'&&text.value.includes(paragraphs.Otro))throw Error('Escribe las instrucciones del operador anterior.');
  if(!['00','30'].includes(minute.value))throw Error('Los minutos deben ser 00 o 30.');
  return {message_mode:mode.value,previous_operator:previous.value||'Ninguno',text:nameExistingMessage(text.value,previous.value).trim(),send:send.checked,send_at:send.checked?madridIso(timing.value==='custom'?date.value+'T'+hour.value+':'+minute.value:nextDaySlot()):null,operator:data.operator||options.operator||'',rule_id:data.rule_id||null};
 },snapshot(){return {message_mode:mode.value,previous_operator:previous.value,text:text.value,send:send.checked,timing:timing.value,local_date:date.value+'T'+hour.value+':'+minute.value};}};
}
async function preview(options){await loadTemplates();const {data,error}=await sb.rpc('crm_router_return_preview',{p_opportunity_id:options.id||null,p_contact_id:options.contactId||null,p_manager_contact_id:options.managerId||null,p_recipient_contact_id:options.recipientId||null,p_operator:options.operator||null,p_netflix_followup:!!options.netflix});if(error)throw error;return data;}
async function choose(options){
 if($('tpfRouterDialog'))throw Error('Termina primero la devolución de router abierta.');
 const data=await preview(options),d=document.createElement('dialog');d.id='tpfRouterDialog';d.setAttribute('aria-label','Tramitado: instalación y devolución de router');
 d.innerHTML='<form method="dialog"><header><h3>Instalación y devolución del router</h3><button value="cancel" aria-label="Cerrar">×</button></header><div data-fields></div><footer><button value="cancel">Cancelar</button><button value="save" class="primary">Confirmar y continuar</button></footer></form>';
 document.body.appendChild(d);const controller=bind(d.querySelector('[data-fields]'),data,{...options,send:true,preferences:{...(options.preferences||data.preferences||{}),send:true}});
 return new Promise(resolve=>{d.addEventListener('close',()=>{const result=d._result||null;d.remove();resolve(result);},{once:true});d.querySelector('form').addEventListener('submit',async e=>{if(e.submitter?.value!=='save')return;e.preventDefault();try{const result=controller.get();e.submitter.disabled=true;await controller.saveTemplate();d._result=result;d.close('save');}catch(error){d.querySelector('[data-error]').textContent=error.message;e.submitter.disabled=false;}});d.showModal();});
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
 const prefs=await choose({id,contactId:payload.record_id,managerId:party.manager_record_id||party.manager_contact_id,recipientId:party.recipient_contact_id,operator});
 return prefs?{...payload,after_sale_preferences:prefs}:null;
}
window.TPFRouterReturn={choose,bind,preview,nextDaySlot,prepare:async(id,payload)=>{try{return await prepare(id,payload);}catch(error){alert('No se pudo preparar Tramitado: '+error.message);return null;}},message,returnOnly,madridIso,businessSlot,paragraphs,defaults,operatorName,loadTemplates,storeTemplate};
})();
