(function(){
'use strict';

const M=window.TPFModules;
if(!M)return;

const $=id=>document.getElementById(id);
const pad=value=>String(value).padStart(2,'0');
const hasOwn=(object,key)=>Object.prototype.hasOwnProperty.call(object||{},key);

let activeContext=null;
let escapeHandler=null;

function canScheduleWhatsapp(){
  try{
    if(typeof crmCan==='function')return crmCan('can_schedule_whatsapp');
    if(typeof perms!=='undefined')return Boolean(perms?.is_admin||perms?.can_schedule_whatsapp);
  }catch(_){}
  return false;
}

function showPermissionError(){
  const message='No tienes permiso para programar WhatsApp.';
  try{
    if(typeof showToast==='function')showToast(message,true);
    else alert(message);
  }catch(_){}
}

function digits(value){
  return String(value||'').replace(/\D/g,'');
}

function comparablePhone(value){
  const phone=digits(value);
  return phone.length===11&&phone.startsWith('34')?phone.slice(2):phone;
}

function samePhone(a,b){
  const first=comparablePhone(a);
  const second=comparablePhone(b);
  return Boolean(first&&second&&first===second);
}

function localValue(date){
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function atTen(date){
  const result=new Date(date);
  result.setHours(10,0,0,0);
  return result;
}

function quickChoices(){
  const now=new Date();
  const tomorrow=new Date(now);
  const monday=new Date(now);
  const week=new Date(now);
  const month=new Date(now);
  tomorrow.setDate(tomorrow.getDate()+1);
  let add=(8-now.getDay())%7;
  if(!add)add=7;
  monday.setDate(monday.getDate()+add);
  week.setDate(week.getDate()+7);
  month.setMonth(month.getMonth()+1);
  return[
    ['Mañana',atTen(tomorrow)],
    ['Próximo lunes',atTen(monday)],
    ['En una semana',atTen(week)],
    ['En un mes',atTen(month)]
  ];
}

function selectedChat(){
  try{
    return typeof waLiveState!=='undefined'?waLiveState?.selected||null:null;
  }catch(_){
    return null;
  }
}

function currentContactData(){
  try{
    return typeof currentContact!=='undefined'?currentContact||null:null;
  }catch(_){
    return null;
  }
}

function selectedContactData(){
  try{
    return typeof waLiveState!=='undefined'?waLiveState?.contact||null:null;
  }catch(_){
    return null;
  }
}

function contactField(record,...keys){
  const data=record?.data||{};
  for(const key of keys){
    const value=data[key];
    if(value!=null&&String(value).trim())return String(value).trim();
  }
  return '';
}

function contextFor(prefill={}){
  const selected=selectedChat();
  const selectedContact=selectedContactData();
  const record=currentContactData();
  const quickContext=window.__tpfWaQuickContext||{};
  const quickPhone=String($('waQuickPhone')?.value||'').trim();
  const contactPhone=String($('contactPhone')?.value||'').trim();
  const selectedPhone=digits(selected?.id||'');
  const phone=String(
    hasOwn(prefill,'phone')?prefill.phone:
    quickPhone||contactPhone||selectedPhone
  ).trim();

  let name=String(hasOwn(prefill,'name')?prefill.name:'').trim();
  let dni=String(hasOwn(prefill,'dni')?prefill.dni:'').trim();
  if(!name&&samePhone(phone,quickContext.phone))name=String(quickContext.name||'').trim();
  if(!dni&&samePhone(phone,quickContext.phone))dni=String(quickContext.dni||'').trim();
  if(!name&&samePhone(phone,selectedPhone))name=String(selected?.name||$('waChatName')?.textContent||'').trim();
  if(!name&&samePhone(phone,selectedPhone))name=contactField(selectedContact,'NOMBRE Y APELLIDOS','CLIENTE','NOMBRE');
  if(!dni&&samePhone(phone,selectedPhone))dni=contactField(selectedContact,'DNI / NIF','DNI','NIF');
  if(!name&&samePhone(phone,contactPhone))name=String($('contactName')?.value||'').trim();
  if(!dni&&samePhone(phone,contactPhone))dni=String($('contactDni')?.value||'').trim();

  let contactId=null;
  if(hasOwn(prefill,'contactId'))contactId=prefill.contactId||null;
  else if(samePhone(phone,quickContext.phone)&&quickContext.contactId)contactId=quickContext.contactId;
  else if(samePhone(phone,selectedPhone)&&selectedContact?.id)contactId=selectedContact.id;
  else if(samePhone(phone,contactPhone)&&record?.id)contactId=record.id;

  const message=String(
    hasOwn(prefill,'message')?prefill.message:
    $('waQuickMessage')?.value||''
  );
  const programId=String(
    hasOwn(prefill,'programId')?prefill.programId:
    $('waQuickProgramId')?.value||''
  ).trim();

  return{
    phone,
    name,
    dni,
    message,
    programId,
    contactId,
    source:String(prefill.source||'direct')
  };
}

function contextFromQuick(){
  return contextFor({
    phone:$('waQuickPhone')?.value||'',
    message:$('waQuickMessage')?.value||'',
    programId:$('waQuickProgramId')?.value||'',
    source:'quick'
  });
}

function contextFromContact(){
  return contextFor({
    phone:$('contactPhone')?.value||'',
    name:$('contactName')?.value||'',
    dni:$('contactDni')?.value||'',
    message:$('waQuickMessage')?.value||'',
    source:'contact'
  });
}

function contextFromChat(){
  const chat=selectedChat();
  return contextFor({
    phone:digits(chat?.id||''),
    name:String(chat?.name||$('waChatName')?.textContent||'').trim(),
    message:$('waComposerText')?.value||'',
    source:'chat'
  });
}

function ensureStyles(){
  if($('tpfSched3Css'))return;
  const style=document.createElement('style');
  style.id='tpfSched3Css';
  style.textContent=`
    #tpfSched3{position:fixed;inset:0;z-index:200000;background:#10182870;display:grid;place-items:center;padding:18px}
    .tpfS3{width:min(760px,94vw);max-height:92dvh;overflow:auto;background:#fff;border-radius:20px;box-shadow:0 24px 70px #0004}
    .tpfS3h,.tpfS3f{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 22px;border-bottom:1px solid #eaecf0}
    .tpfS3h h2{margin:0;font-size:23px}.tpfS3h p{margin:3px 0 0;color:#667085;font-size:13px}
    .tpfS3b{padding:20px 22px}.tpfS3 label{display:block;font-size:13px;font-weight:700;color:#475467;margin:0 0 7px}
    .tpfS3 input,.tpfS3 textarea{width:100%;box-sizing:border-box;border:1px solid #d0d5dd;border-radius:11px;padding:12px 14px;font:inherit;background:#fff}
    .tpfS3 textarea{min-height:110px;resize:vertical}.tpfS3messageHead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:14px;margin-bottom:7px}
    .tpfS3messageHead label{margin:0}.tpfS3template{border:1px solid #b9c8e4;border-radius:9px;background:#f5f8ff;color:#244f91;padding:8px 11px;font-size:12px;font-weight:750;cursor:pointer}
    .tpfS3selected{min-height:18px;margin:6px 0 0;color:#315ea8;font-size:12px}.tpfS3grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:8px 0 18px}
    .tpfS3q{border:1px solid #d0d5dd;border-radius:12px;background:#fff;padding:14px 8px;cursor:pointer;text-align:center}.tpfS3q.on{border-color:#2563eb;background:#f5f8ff}
    .tpfS3q b,.tpfS3q small{display:block}.tpfS3q small{margin-top:5px;color:#667085}.tpfS3custom{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .tpfS3hint{margin-top:14px;padding:10px 12px;border-radius:10px;background:#f5f8ff;color:#315ea8;font-size:13px}.tpfS3error{min-height:18px;margin-top:10px;color:#b42318;font-size:13px}
    .tpfS3f{border-top:1px solid #eaecf0;border-bottom:0}.tpfS3btn{border:1px solid #d0d5dd;border-radius:10px;background:#fff;padding:11px 17px;font-weight:700;cursor:pointer}
    .tpfS3primary{background:#172033;color:#fff;border-color:#172033}.tpfS3btn:disabled{opacity:.65;cursor:wait}
    @media(max-width:650px){
      #tpfSched3{padding:10px}.tpfS3{width:calc(100vw - 20px);max-height:94dvh}.tpfS3grid{grid-template-columns:1fr 1fr}.tpfS3custom{grid-template-columns:1fr}
      .tpfS3h,.tpfS3b,.tpfS3f{padding-left:15px;padding-right:15px}.tpfS3f{flex-direction:column-reverse}.tpfS3btn{width:100%}.tpfS3template{width:auto}
    }
  `;
  document.head.appendChild(style);
}

function resetQuickState(){
  ['waQuickProgramId','waQuickWhen','waQuickPhone','waQuickMessage'].forEach(id=>{
    const field=$(id);
    if(field)field.value='';
  });
  const message=$('waQuickMsg');
  if(message)message.textContent='';
  const send=$('waQuickSend');
  if(send){
    send.disabled=false;
    send.dataset.mode='send';
    send.textContent='Enviar ahora';
  }
  $('waQuickScheduleBox')?.classList.add('hidden');
  window.__tpfWaQuickContext=null;
}

function close(options={}){
  const reset=options.reset!==false;
  const hideQuick=options.hideQuick!==false;
  $('tpfSched3')?.remove();
  window.closeWhatsAppTemplatePicker?.('schedule-close');
  if(escapeHandler){
    document.removeEventListener('keydown',escapeHandler);
    escapeHandler=null;
  }
  activeContext=null;
  if(hideQuick)$('waQuickModal')?.classList.add('hidden');
  if(reset)resetQuickState();
}

function supabaseClient(){
  try{
    if(typeof sb!=='undefined'&&sb?.from)return sb;
  }catch(_){}
  return window.sb?.from?window.sb:null;
}

async function refreshAfterSave(){
  try{
    if(typeof loadWhatsappPrograms==='function')await loadWhatsappPrograms();
    else if(typeof window.loadWhatsappPrograms==='function')await window.loadWhatsappPrograms();
  }catch(error){
    console.warn('No se pudo actualizar la lista de WhatsApp programados.',error);
  }
  try{
    const record=currentContactData();
    if(record&&activeContext?.contactId&&String(record.id)===String(activeContext.contactId)&&typeof renderContactProfile==='function'){
      await renderContactProfile();
    }
  }catch(_){}
}

async function persistWithClient(date,values){
  const client=supabaseClient();
  if(!client)return false;
  const iso=date.toISOString();

  if(values.programId){
    const changes={
      customer_phone:values.phone,
      starts_at:iso,
      whatsapp_phone:values.phone,
      whatsapp_message:values.message,
      whatsapp_scheduled_at:iso,
      status:'pending'
    };
    if(values.name)changes.customer_name=values.name;
    if(values.contactId)changes.related_record_id=values.contactId;
    const result=await client.from('agenda_items').update(changes).eq('id',values.programId);
    if(result?.error)throw result.error;
  }else{
    const authResult=await client.auth?.getUser?.();
    if(authResult?.error)throw authResult.error;
    const row={
      title:'WhatsApp programado',
      description:null,
      customer_name:values.name||null,
      customer_phone:values.phone,
      related_record_id:values.contactId||null,
      starts_at:iso,
      assigned_to:authResult?.data?.user?.id||null,
      status:'pending',
      whatsapp_enabled:true,
      whatsapp_phone:values.phone,
      whatsapp_message:values.message,
      whatsapp_scheduled_at:iso
    };
    const result=await client.from('agenda_items').insert(row);
    if(result?.error)throw result.error;
  }

  await refreshAfterSave();
  return true;
}

async function persistWithCore(date,values){
  if($('waQuickPhone'))$('waQuickPhone').value=values.phone;
  if($('waQuickMessage'))$('waQuickMessage').value=values.message;
  if($('waQuickWhen'))$('waQuickWhen').value=localValue(date);
  if($('waQuickProgramId'))$('waQuickProgramId').value=values.programId||'';

  if(typeof window.saveQuickWhatsappSchedule==='function'){
    await window.saveQuickWhatsappSchedule(date);
    return true;
  }
  try{
    if(typeof saveQuickWhatsappSchedule==='function'){
      await saveQuickWhatsappSchedule(date);
      return true;
    }
  }catch(error){
    throw error;
  }
  return false;
}

async function persistSchedule(date,values){
  if(await persistWithClient(date,values))return;
  if(await persistWithCore(date,values))return;
  throw new Error('No se encontró la función real de programación.');
}

function openTemplatePicker(){
  const message=$('tpfS3msg');
  const phone=$('tpfS3phone');
  if(!message||!activeContext)return;
  if(typeof window.openWhatsAppTemplatePicker!=='function'){
    alert('El selector de plantillas todavía no está disponible.');
    return;
  }

  activeContext.phone=phone?.value?.trim()||activeContext.phone;
  window.openWhatsAppTemplatePicker({
    context:{
      name:activeContext.name,
      fullName:activeContext.name,
      phone:activeContext.phone,
      dni:activeContext.dni
    },
    returnFocus:message,
    onSelect:({template,text})=>{
      message.value=text;
      message.dispatchEvent(new Event('input',{bubbles:true}));
      const selected=$('tpfS3templateName');
      if(selected)selected.textContent=`Plantilla elegida: ${template?.name||'Plantilla'}`;
    },
    onManage:()=>{
      close();
      const nav=$('tpfWaTemplatesV3Nav')||[...document.querySelectorAll('.referenceNav .nav')]
        .find(item=>/plantillas whatsapp/i.test(item.textContent||''));
      nav?.click();
    }
  });
}

function open(prefill={}){
  if(!canScheduleWhatsapp()){
    showPermissionError();
    return null;
  }
  ensureStyles();
  const nextContext=contextFor(prefill);
  close({reset:false,hideQuick:false});
  activeContext=nextContext;

  const choices=quickChoices();
  $('waQuickScheduleBox')?.classList.add('hidden');
  $('waQuickModal')?.classList.add('hidden');

  const overlay=document.createElement('div');
  overlay.id='tpfSched3';
  overlay.innerHTML=`<div class="tpfS3" role="dialog" aria-modal="true" aria-labelledby="tpfS3title">
    <div class="tpfS3h"><div><h2 id="tpfS3title">Programar WhatsApp</h2><p id="tpfS3contact"></p></div><button type="button" class="tpfS3btn" data-close aria-label="Cerrar">×</button></div>
    <div class="tpfS3b">
      <label for="tpfS3phone">Teléfono</label><input id="tpfS3phone" inputmode="tel" autocomplete="tel">
      <div class="tpfS3messageHead"><label for="tpfS3msg">Mensaje</label><button id="tpfS3template" type="button" class="tpfS3template">▤ Usar plantilla</button></div>
      <textarea id="tpfS3msg"></textarea><div id="tpfS3templateName" class="tpfS3selected"></div>
      <label style="margin-top:14px">Enviar</label>
      <div class="tpfS3grid">${choices.map((choice,index)=>`<button type="button" class="tpfS3q ${index?'':'on'}" data-when="${localValue(choice[1])}"><b>${choice[0]}</b><small>${choice[1].toLocaleDateString('es-ES',{weekday:'short',day:'2-digit',month:'short'})} · 10:00</small></button>`).join('')}</div>
      <div class="tpfS3custom"><div><label for="tpfS3date">Fecha</label><input id="tpfS3date" type="date"></div><div><label for="tpfS3time">Hora</label><input id="tpfS3time" type="time" value="10:00"></div></div>
      <div class="tpfS3hint">Los cuatro accesos rápidos se programan por defecto a las 10:00.</div><div id="tpfS3error" class="tpfS3error" role="alert"></div>
    </div>
    <div class="tpfS3f"><button type="button" class="tpfS3btn" data-close>← Volver</button><button id="tpfS3save" type="button" class="tpfS3btn tpfS3primary">Programar envío</button></div>
  </div>`;
  document.body.appendChild(overlay);

  $('tpfS3phone').value=activeContext.phone;
  $('tpfS3msg').value=activeContext.message;
  $('tpfS3date').value=localValue(choices[0][1]).slice(0,10);
  $('tpfS3contact').textContent=activeContext.name?`Para ${activeContext.name}`:'';

  overlay.querySelectorAll('.tpfS3q').forEach(button=>{
    button.onclick=()=>{
      overlay.querySelectorAll('.tpfS3q').forEach(item=>item.classList.remove('on'));
      button.classList.add('on');
      $('tpfS3date').value=button.dataset.when.slice(0,10);
      $('tpfS3time').value='10:00';
    };
  });
  overlay.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>close());
  overlay.onclick=event=>{
    if(event.target===overlay)close();
  };
  $('tpfS3template').onclick=openTemplatePicker;
  $('tpfS3save').onclick=async()=>{
    const values={
      phone:$('tpfS3phone').value.trim(),
      message:$('tpfS3msg').value.trim(),
      name:activeContext?.name||'',
      programId:activeContext?.programId||'',
      contactId:activeContext?.contactId||null
    };
    const dateValue=$('tpfS3date').value;
    const timeValue=$('tpfS3time').value||'10:00';
    const errorBox=$('tpfS3error');
    if(!values.phone||!values.message||!dateValue){
      errorBox.textContent='Completa teléfono, mensaje y fecha.';
      return;
    }
    const date=new Date(`${dateValue}T${timeValue}`);
    if(Number.isNaN(date.getTime())){
      errorBox.textContent='La fecha y la hora no son válidas.';
      return;
    }
    if(date.getTime()<=Date.now()){
      errorBox.textContent='Elige una fecha y una hora futuras.';
      return;
    }
    if(!canScheduleWhatsapp()){
      errorBox.textContent='No tienes permiso para programar WhatsApp.';
      return;
    }

    const button=$('tpfS3save');
    button.disabled=true;
    button.textContent='Guardando...';
    errorBox.textContent='';
    try{
      await persistSchedule(date,values);
      close();
      try{
        if(typeof showToast==='function')showToast(values.programId?'WhatsApp reprogramado':'WhatsApp programado');
      }catch(_){}
    }catch(error){
      errorBox.textContent=error?.message||'No se pudo programar el WhatsApp.';
      button.disabled=false;
      button.textContent='Programar envío';
    }
  };

  escapeHandler=event=>{
    if(event.key==='Escape'&&!$('tpfDirectPickerModal'))close();
  };
  document.addEventListener('keydown',escapeHandler);
  $('tpfS3msg').focus();
  return overlay;
}

window.openWaScheduleV3=open;
window.closeWaScheduleV3=close;

function install(){
  ensureStyles();
  if(window.__tpfScheduleDirectDelegated)return;
  window.__tpfScheduleDirectDelegated=true;
  document.addEventListener('click',event=>{
    const trigger=event.target.closest?.('#waQuickDrop,#cpScheduleWhatsapp,#waScheduleBtn');
    if(!trigger)return;
    if(!canScheduleWhatsapp()){
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      showPermissionError();
      return;
    }
    if(trigger.id==='cpScheduleWhatsapp'){
      try{
        if(typeof contactCanUseWhatsapp==='function'&&!contactCanUseWhatsapp())return;
      }catch(_){}
    }
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if(trigger.id==='waQuickDrop')open(contextFromQuick());
    else if(trigger.id==='cpScheduleWhatsapp')open(contextFromContact());
    else open(contextFromChat());
  },true);
}

M.register('whatsapp-schedule-direct-v3',{
  install(){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
    else install();
  }
});
})();
