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
function madridIso(value){
 if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value))throw Error('Elige una fecha y hora.');
 const nominal=Date.parse(value+':00Z');let stamp=nominal;
 for(let i=0;i<3;i++){const p=Object.fromEntries(new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(stamp)).map(x=>[x.type,x.value]));const shown=Date.parse(p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute+':00Z');stamp+=nominal-shown;}
 const actual=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(stamp)).replace(' ','T');
 if(actual!==value)throw Error('Esa hora no existe por el cambio de horario.');
 if(stamp<=Date.now()+60000)throw Error('Elige una fecha y hora futuras.');
 return new Date(stamp).toISOString();
}
async function choose(options){
 if($('tpfRouterDialog'))throw Error('Termina primero la devolución de router abierta.');
 const {data,error}=await sb.rpc('crm_router_return_preview',{p_opportunity_id:options.id||null,p_contact_id:options.contactId||null,p_manager_contact_id:options.managerId||null,p_recipient_contact_id:options.recipientId||null,p_operator:options.operator||null,p_netflix_followup:!!options.netflix});
 if(error)throw error;
 const d=document.createElement('dialog');d.id='tpfRouterDialog';d.setAttribute('aria-label','Tramitado: instalación y devolución de router');
 d.innerHTML='<form method="dialog"><header><h3>Instalación y devolución del router</h3><button value="cancel" aria-label="Cerrar">×</button></header><p data-recipient></p><label>Operador anterior<select data-previous><option value="">Selecciona el operador anterior</option>'+Object.keys(paragraphs).map(x=>'<option value="'+x+'">'+(x==='Ninguno'?'Sin router que devolver':x==='Otro'?'Otro operador (texto manual)':x)+'</option>').join('')+'</select></label><label class="tpfRouterCheck"><input type="checkbox" data-send> Enviar el mensaje de instalación y devolución</label><p data-status></p><label>Mensaje que recibirá el cliente<textarea data-text rows="9" maxlength="10000"></textarea></label><small>Editable. Seleccionar otro operador anterior regenera el párrafo del router.</small><label>Cuándo enviarlo<select data-timing><option value="day_one">Día siguiente, en horario de atención</option><option value="custom">Elegir fecha y hora</option></select></label><label data-date-label hidden>Fecha y hora (Madrid)<input type="datetime-local" data-date></label><small>El envío se ajustará al horario de atención. Elige una fecha posterior a la instalación si todavía no tiene fibra.</small><p data-error role="alert"></p><footer><button value="cancel">Cancelar</button><button value="save" class="primary">Confirmar y continuar</button></footer></form>';
 if(!$('tpfRouterStyle')){const s=document.createElement('style');s.id='tpfRouterStyle';s.textContent='#tpfRouterDialog{width:min(620px,calc(100vw - 28px));max-height:calc(100dvh - 28px);overflow:auto;border:1px solid #dbe4ef;border-radius:12px;padding:20px;color:#24354b}#tpfRouterDialog::backdrop{background:#14233788}#tpfRouterDialog header,#tpfRouterDialog footer{display:flex;justify-content:space-between;gap:12px;align-items:center}#tpfRouterDialog h3{margin:0}#tpfRouterDialog label{display:block;margin:12px 0}#tpfRouterDialog select,#tpfRouterDialog textarea,#tpfRouterDialog input[type=datetime-local]{display:block;width:100%;box-sizing:border-box;margin-top:5px;font:inherit}#tpfRouterDialog textarea{background:#eef8eb;padding:12px;resize:vertical}#tpfRouterDialog small{display:block;color:#64748b}#tpfRouterDialog [data-error]{color:#b42318}#tpfRouterDialog button{padding:8px 14px}#tpfRouterDialog footer{margin-top:18px}#tpfRouterDialog [hidden]{display:none!important}';document.head.appendChild(s);}
 document.body.appendChild(d);
 const previous=d.querySelector('[data-previous]'),text=d.querySelector('[data-text]'),send=d.querySelector('[data-send]'),timing=d.querySelector('[data-timing]'),date=d.querySelector('[data-date]');
 d.querySelector('[data-recipient]').textContent='Destinatario: '+(data.recipient||'Sin contacto vinculado')+(data.phone?' · '+data.phone:'');
 const saved=data.preferences||{},available=!!data.available;
 send.checked=options.send!==false&&available&&saved.send!==false;send.disabled=!available;
 d.querySelector('[data-status]').textContent=available?'Se conservarán los demás seguimientos de la venta.':'No hay mensaje del día siguiente configurado para el operador nuevo. Puedes continuar sin este envío.';
 previous.value=saved.previous_operator||'';text.value=saved.text||options.text||data.text||'';
 const update=()=>{text.disabled=!send.checked;timing.disabled=!send.checked;date.disabled=!send.checked;d.querySelector('[data-date-label]').hidden=timing.value!=='custom';};
 previous.onchange=()=>{text.value=message(options.text||data.text,previous.value);update();};
 send.onchange=update;timing.onchange=update;update();
 return new Promise(resolve=>{
  d.addEventListener('close',()=>{const result=d._result||null;d.remove();resolve(result);},{once:true});
  d.querySelector('form').addEventListener('submit',e=>{
   if(e.submitter?.value!=='save')return;e.preventDefault();
   try{
    if(send.checked&&!previous.value)throw Error('Selecciona el operador anterior o «Sin router que devolver».');
    if(send.checked&&!text.value.trim())throw Error('El mensaje no puede estar vacío.');
    if(send.checked&&previous.value==='Otro'&&text.value.includes(paragraphs.Otro))throw Error('Escribe las instrucciones del operador anterior.');
    d._result={previous_operator:previous.value||'Ninguno',text:text.value.trim(),send:send.checked,send_at:send.checked&&timing.value==='custom'?madridIso(date.value):null,operator:data.operator||options.operator||'',rule_id:data.rule_id||null};
    d.close('save');
   }catch(error){d.querySelector('[data-error]').textContent=error.message;}
  });
  d.showModal();
 });
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
window.TPFRouterReturn={choose,prepare:async(id,payload)=>{try{return await prepare(id,payload);}catch(error){alert('No se pudo preparar Tramitado: '+error.message);return null;}},message,madridIso,paragraphs};
})();
