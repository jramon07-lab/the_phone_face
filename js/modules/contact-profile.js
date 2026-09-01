(function(){
  'use strict';
  const M=window.TPFModules;
  if(!M)return;

  const CORE_FIELD_IDS=['contactFirstName','contactLastName','contactName','contactPhone','contactDni','contactEmail','contactNotes','contactObservations'];
  let editMode=false;
  let currentRecordId=null;
  let syncQueued=false;
  let contactObserver=null;
  let labelsObserver=null;
  let templateTargetQuick=false;
  let internalSendBusy=false;
  let createEditState=null;

  const byId=id=>document.getElementById(id);
  const modal=()=>byId('contactModal');
  const saveButton=()=>byId('contactSave');
  const customFieldRoot=()=>byId('contactCustomFields')||null;

  function ensureStyles(){
    if(byId('tpfContactProfileProtectionStyles'))return;
    const s=document.createElement('style');s.id='tpfContactProfileProtectionStyles';s.textContent=`
      body:has(#contactModal:not(.hidden)) .referenceSidebar{pointer-events:none!important}
      #contactModal:not(.hidden){z-index:50000!important;pointer-events:auto!important}
      #contactLabelsModal:not(.hidden),#waQuickModal:not(.hidden),#waTemplateModal:not(.hidden){z-index:60000!important;pointer-events:auto!important}
      #contactModal.tpf-contact-readonly input[readonly],#contactModal.tpf-contact-readonly textarea[readonly]{opacity:1!important;color:#344054!important;background:#f7f9fc!important;cursor:default!important;-webkit-text-fill-color:#344054!important}
      #contactModal.tpf-contact-readonly select:disabled{opacity:1!important;color:#344054!important;background:#f7f9fc!important;cursor:default!important;-webkit-text-fill-color:#344054!important}
      .tpfContactEditBar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 12px}.tpfContactEditBar h3{margin:0!important}.tpfContactEditActions{display:flex;gap:8px;align-items:center}.tpfContactEditBar button{min-width:120px;position:relative;z-index:3;pointer-events:auto!important;cursor:pointer!important}
      #tpfContactSaveLocal{display:none}.tpf-contact-editing #tpfContactSaveLocal{display:inline-flex!important}
      #contactObservations{width:100%;min-height:88px;resize:vertical}
      #contactCustomFields{width:100%!important}.contactCustomFieldsBox{width:100%!important;box-sizing:border-box!important}
      #contactCustomFields label:has(.tpf-bank-field),#contactCustomFields .tpf-bank-field{width:100%!important;max-width:none!important;box-sizing:border-box!important}
      #contactCustomFields .tpf-bank-field{min-width:24ch!important;font-variant-numeric:tabular-nums;padding-left:12px!important;padding-right:12px!important}
      #contactLabelsSearch{width:100%;margin:8px 0 12px;box-sizing:border-box}
      #contactLabelsChoices .tpfLabelSearchHidden{display:none!important}
      #contactModal .tpfContactProtectedHint{font-size:11px;color:#667085;margin:-4px 0 10px}
      #tpfContactWhatsappMain{width:100%;margin-top:10px;display:flex;align-items:center;justify-content:center;gap:7px;position:relative;z-index:2}
      #tpfQuickTemplateBtn{margin:8px 0 0;width:100%}
    `;document.head.appendChild(s);
  }

  function editableFields(){
    const out=[];CORE_FIELD_IDS.forEach(id=>{const el=byId(id);if(el)out.push(el)});
    customFieldRoot()?.querySelectorAll('input,textarea,select').forEach(el=>out.push(el));
    return [...new Set(out)];
  }

  function applyFieldProtection(el,on){
    if(!el)return;
    const tag=String(el.tagName||'').toUpperCase();
    if(tag==='SELECT'){
      el.disabled=!on;
      el.setAttribute('aria-disabled',String(!on));
    }else{
      el.disabled=false;
      el.readOnly=!on;
      el.setAttribute('aria-readonly',String(!on));
    }
  }

  function setEditMode(on){
    editMode=!!on;
    const root=modal();if(!root)return;
    root.classList.toggle('tpf-contact-readonly',!editMode);
    root.classList.toggle('tpf-contact-editing',editMode);
    editableFields().forEach(el=>applyFieldProtection(el,editMode));
    const toggle=byId('tpfContactEditToggle');
    if(toggle){
      const text=editMode?'Cancelar edición':'Editar datos';
      if(toggle.textContent!==text)toggle.textContent=text;
      toggle.setAttribute('aria-pressed',String(editMode));
    }
    const hint=byId('tpfContactProtectedHint');
    if(hint){const text=editMode?'Edición activada. Guarda los cambios cuando termines.':'Datos protegidos. Pulsa “Editar datos” para modificarlos.';if(hint.textContent!==text)hint.textContent=text;}
    const real=saveButton();if(real){real.disabled=!editMode;real.style.display='none';}
    const local=byId('tpfContactSaveLocal');if(local){local.disabled=!editMode;local.style.display=editMode?'inline-flex':'none';}
  }

  function recordField(d,...names){for(const n of names){if(d?.[n]!==undefined&&d?.[n]!==null)return String(d[n]);}return '';}
  function setCreateValue(id,value){const el=byId(id);if(el)el.value=value==null?'':String(value);}
  async function waitForCreateModal(){for(let i=0;i<80;i++){const back=byId('tpfContactsCreateBack');if(back&&!back.classList.contains('hidden'))return back;await new Promise(r=>setTimeout(r,25));}return null;}
  function restoreCreateModal(close=true){
    const s=createEditState;if(!s)return;
    const save=byId('tpfContactsCreateSave'),closeBtn=byId('tpfContactsCreateClose'),cancel=byId('tpfContactsCreateCancel');
    if(save){save.onclick=s.saveHandler;save.textContent=s.saveText;save.disabled=false;}
    if(closeBtn)closeBtn.onclick=s.closeHandler;
    if(cancel)cancel.onclick=s.cancelHandler;
    if(s.title)s.title.textContent=s.titleText;
    if(s.subtitle)s.subtitle.textContent=s.subtitleText;
    if(close)byId('tpfContactsCreateBack')?.classList.add('hidden');
    createEditState=null;
  }
  async function returnFromCreateEdit(){restoreCreateModal(true);}
  async function saveCreateModalEdit(){
    const s=createEditState;if(!s)return;
    const btn=byId('tpfContactsCreateSave'),msg=byId('tpfContactsCreateMsg');
    const first=byId('tpfCreateFirst')?.value.trim()||'',last=byId('tpfCreateLast')?.value.trim()||'';
    if(!first&&!last){if(msg)msg.textContent='Escribe el nombre o los apellidos.';return;}
    const phone=byId('tpfCreatePhone')?.value.trim()||'',email=byId('tpfCreateEmail')?.value.trim()||'',dni=byId('tpfCreateDni')?.value.trim()||'',bank=byId('tpfCreateBank')?.value.trim()||'',notes=byId('tpfCreateNotes')?.value||'',obs=byId('tpfCreateObs')?.value||'';
    if(btn)btn.disabled=true;if(msg)msg.textContent='Guardando…';
    try{
      const q=await sb.from('records').select('data').eq('id',s.id).maybeSingle();if(q.error)throw q.error;
      const d={...(q.data?.data||{})};
      d.NOMBRE=first;d.APELLIDOS=last;d['NOMBRE Y APELLIDOS']=[first,last].filter(Boolean).join(' ').trim();d['TELÉFONO']=phone;d['DNI / NIF']=dni;d.DNI=dni;d.EMAIL=email;d.BANCO=bank;d.NOTAS=notes;d.OBSERVACIONES=obs;
      const u=await sb.from('records').update({data:d}).eq('id',s.id);if(u.error)throw u.error;
      const ids=[...byId('tpfCreateLabels')?.querySelectorAll('input:checked')||[]].map(x=>x.value);
      const lr=await sb.rpc('crm_set_contact_labels',{p_contact_id:String(s.id),p_label_ids:ids});if(lr.error)throw lr.error;
      const id=s.id;
      if(msg)msg.textContent='Contacto guardado correctamente';
      restoreCreateModal(true);
      try{await window.tpfReloadContacts?.();}catch(_){}
      if(typeof window.openContact==='function')await window.openContact(id);
    }catch(err){if(msg)msg.textContent=err?.message||'No se pudo guardar el contacto.';if(btn)btn.disabled=false;}
  }
  async function openCreateModalEdit(){
    if(createEditState)return;
    let c=null;try{c=(typeof currentContact!=='undefined'&&currentContact)||null;}catch(_){}
    const id=c?.id||currentRecordId;if(!id)return;
    const add=byId('tpfContactsAdd');if(!add)return;
    add.click();
    const back=await waitForCreateModal();if(!back)return;
    const save=byId('tpfContactsCreateSave'),closeBtn=byId('tpfContactsCreateClose'),cancel=byId('tpfContactsCreateCancel');
    const title=back.querySelector('.tpfContactsModalHead h3'),subtitle=back.querySelector('.tpfContactsModalHead .small');
    createEditState={id,saveHandler:save?.onclick||null,closeHandler:closeBtn?.onclick||null,cancelHandler:cancel?.onclick||null,saveText:save?.textContent||'Crear contacto',title,titleText:title?.textContent||'Agregar contacto',subtitle,subtitleText:subtitle?.textContent||''};
    const d=c?.data||{};
    setCreateValue('tpfCreateFirst',byId('contactFirstName')?.value||recordField(d,'NOMBRE','Nombre'));
    setCreateValue('tpfCreateLast',byId('contactLastName')?.value||recordField(d,'APELLIDOS','Apellidos'));
    setCreateValue('tpfCreatePhone',byId('contactPhone')?.value||recordField(d,'TELÉFONO','TELEFONO','PHONE','MOVIL'));
    setCreateValue('tpfCreateEmail',byId('contactEmail')?.value||recordField(d,'EMAIL','CORREO','CORREO ELECTRÓNICO'));
    setCreateValue('tpfCreateDni',byId('contactDni')?.value||recordField(d,'DNI / NIF','DNI','NIF'));
    setCreateValue('tpfCreateBank',recordField(d,'BANCO','Banco'));
    setCreateValue('tpfCreateNotes',byId('contactNotes')?.value||recordField(d,'NOTAS','NOTES'));
    setCreateValue('tpfCreateObs',byId('contactObservations')?.value||recordField(d,'OBSERVACIONES','OBSERVACION'));
    try{
      const r=await sb.rpc('crm_get_contact_labels',{p_contact_id:String(id)});if(r.error)throw r.error;
      const ids=new Set((r.data||[]).map(x=>String(x.id??x.label_id??x.value??'')));
      byId('tpfCreateLabels')?.querySelectorAll('input').forEach(x=>x.checked=ids.has(String(x.value)));
    }catch(_){}
    if(title)title.textContent='Editar contacto';
    if(subtitle)subtitle.textContent='Modifica los datos del contacto.';
    if(save){save.textContent='Guardar cambios';save.onclick=e=>{e?.preventDefault?.();e?.stopPropagation?.();saveCreateModalEdit();};}
    if(closeBtn)closeBtn.onclick=e=>{e?.preventDefault?.();e?.stopPropagation?.();returnFromCreateEdit();};
    if(cancel)cancel.onclick=e=>{e?.preventDefault?.();e?.stopPropagation?.();returnFromCreateEdit();};
  }

  function bindNativeEditControls(){
    const toggle=byId('tpfContactEditToggle');
    if(toggle)toggle.dataset.tpfNativeEdit='1';
    const local=byId('tpfContactSaveLocal');
    if(local && local.dataset.tpfNativeSave!=='1'){
      local.dataset.tpfNativeSave='1';
      local.onclick=e=>{e.preventDefault();e.stopPropagation();const real=saveButton();if(real&&!real.disabled)real.click();};
    }
  }

  function ensureEditButton(){
    const data=byId('contactPhone')?.closest('.cpData');if(!data)return;
    let bar=byId('tpfContactEditBar');
    if(!bar){
      const h=data.querySelector('h3');bar=document.createElement('div');bar.id='tpfContactEditBar';bar.className='tpfContactEditBar';
      const title=document.createElement('h3');title.textContent='Datos';
      const actions=document.createElement('div');actions.className='tpfContactEditActions';
      const b=document.createElement('button');b.id='tpfContactEditToggle';b.type='button';b.className='secondary';b.textContent='Editar datos';
      const saveLocal=document.createElement('button');saveLocal.id='tpfContactSaveLocal';saveLocal.type='button';saveLocal.className='primary';saveLocal.textContent='Guardar cambios';
      actions.append(b,saveLocal);bar.append(title,actions);if(h)h.replaceWith(bar);else data.prepend(bar);
      const hint=document.createElement('div');hint.id='tpfContactProtectedHint';hint.className='tpfContactProtectedHint';hint.textContent='Datos protegidos. Pulsa “Editar datos” para modificarlos.';bar.insertAdjacentElement('afterend',hint);
    }
    bindNativeEditControls();
  }

  function ensureObservations(){
    if(byId('contactObservations'))return;
    const notes=byId('contactNotes');if(!notes)return;
    const label=document.createElement('label');label.htmlFor='contactObservations';label.textContent='Observaciones';
    const ta=document.createElement('textarea');ta.id='contactObservations';ta.placeholder='Observaciones del contacto';
    notes.insertAdjacentElement('afterend',ta);ta.insertAdjacentElement('beforebegin',label);
  }

  function normalizeCustomFields(){
    const root=customFieldRoot();if(!root)return;
    [...root.querySelectorAll('label')].forEach(label=>{
      const name=String(label.textContent||'').trim().toUpperCase();
      const field=label.querySelector('input,textarea,select')||((label.nextElementSibling?.matches?.('input,textarea,select'))?label.nextElementSibling:null);
      if(!field)return;
      if(name.includes('BANCO')){
        if(field.tagName==='INPUT')field.type='text';
        field.classList.add('tpf-bank-field');field.removeAttribute('inputmode');field.removeAttribute('pattern');field.removeAttribute('step');field.setAttribute('size','24');
        field.placeholder=field.placeholder||'Ej.: ES00 0000 0000 0000 0000';
      }
    });
  }

  function ensureLabelSearch(){
    const lm=byId('contactLabelsModal'),choices=byId('contactLabelsChoices');if(!lm||!choices)return;
    let input=byId('contactLabelsSearch');if(!input){input=document.createElement('input');input.id='contactLabelsSearch';input.type='search';input.placeholder='Buscar etiqueta…';input.autocomplete='off';choices.insertAdjacentElement('beforebegin',input);input.addEventListener('input',filterContactLabels);}filterContactLabels();
  }
  function filterContactLabels(){
    const choices=byId('contactLabelsChoices'),input=byId('contactLabelsSearch');if(!choices||!input)return;
    const q=input.value.trim().toLowerCase();[...choices.children].forEach(row=>row.classList.toggle('tpfLabelSearchHidden',!!q&&!String(row.textContent||'').toLowerCase().includes(q)));
  }

  function allowWhatsappForContact(){
    window.contactCanUseWhatsapp=function(){
      let source='';
      try{source=String((typeof currentContact!=='undefined'&&currentContact?.source_sheet)||'').trim().toUpperCase();}catch(_){}
      if(!source)source=String(byId('contactMeta')?.textContent||'').trim().toUpperCase();
      return source==='DATA'||source==='CONTACTOS'||source.includes('BASE DE DATOS');
    };
  }

  function openContactWhatsappMenu(){
    const phone=byId('contactPhone')?.value?.trim()||'';if(!phone){alert('Este contacto no tiene teléfono');return;}
    if(typeof window.openWaQuick==='function')window.openWaQuick({phone,name:byId('contactName')?.value?.trim()||''});
    else if(typeof openWaQuick==='function')openWaQuick({phone,name:byId('contactName')?.value?.trim()||''});
    else byId('contactWhatsapp')?.click();
    setTimeout(()=>{ensureQuickTemplateButton();},20);
  }

  function ensureWhatsappMainButton(){
    const quick=modal()?.querySelector('.cpQuick');if(!quick||byId('tpfContactWhatsappMain'))return;
    const b=document.createElement('button');b.id='tpfContactWhatsappMain';b.type='button';b.textContent='WhatsApp · Enviar / Plantilla / Programar';quick.insertAdjacentElement('afterend',b);
  }

  function ensureQuickTemplateButton(){
    const msg=byId('waQuickMessage');if(!msg||byId('tpfQuickTemplateBtn'))return;
    const b=document.createElement('button');b.id='tpfQuickTemplateBtn';b.type='button';b.className='secondary';b.textContent='Usar plantilla de WhatsApp';
    b.onclick=async e=>{e.preventDefault();e.stopPropagation();templateTargetQuick=true;try{if(typeof waSyncTemplatesFromSupabase==='function')await waSyncTemplatesFromSupabase();if(typeof waRenderTemplates==='function')waRenderTemplates();byId('waTemplateModal')?.classList.remove('hidden');}catch(err){templateTargetQuick=false;console.warn('Plantillas WhatsApp',err);}};
    msg.insertAdjacentElement('afterend',b);
  }

  function wrapTemplateUse(){
    const fn=window.waUseTemplate;if(typeof fn!=='function'||fn.__tpfQuickAware)return;
    const wrapped=function(i){
      if(templateTargetQuick){templateTargetQuick=false;try{const list=typeof waLoadTemplates==='function'?waLoadTemplates():[];const t=list?.[i];if(t&&byId('waQuickMessage'))byId('waQuickMessage').value=t.text||'';byId('waTemplateModal')?.classList.add('hidden');byId('waQuickMessage')?.focus();return;}catch(_){}}
      return fn.apply(this,arguments);
    };wrapped.__tpfQuickAware=true;window.waUseTemplate=wrapped;
  }

  async function sendQuickWhatsappInsideCrm(){
    if(internalSendBusy)return;
    const phone=String(byId('waQuickPhone')?.value||'').replace(/\D/g,'');
    const message=String(byId('waQuickMessage')?.value||'').trim();
    const msg=byId('waQuickMsg'),btn=byId('waQuickSend');
    if(!phone){if(msg)msg.textContent='Introduce un teléfono.';return;}
    if(!message){if(msg)msg.textContent='Escribe un mensaje.';return;}
    const chatId=(phone.length===9?'34'+phone:phone)+'@c.us';
    internalSendBusy=true;if(btn)btn.disabled=true;if(msg)msg.textContent='Enviando por WhatsApp…';
    try{
      const r=await fetch('/api/green?action=send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chatId,message})});
      const d=await r.json().catch(()=>null);if(!r.ok||d?.ok===false)throw new Error(d?.error||d?.message||('HTTP '+r.status));
      if(msg)msg.textContent='WhatsApp enviado desde el CRM';
      setTimeout(()=>byId('waQuickModal')?.classList.add('hidden'),500);
      try{if(typeof loadWhatsappPrograms==='function')loadWhatsappPrograms();}catch(_){}
    }catch(e){if(msg)msg.textContent=e?.message||'No se pudo enviar el WhatsApp.';}
    finally{internalSendBusy=false;if(btn)btn.disabled=false;}
  }

  async function loadObservation(id){
    const ta=byId('contactObservations');if(!ta||!id)return;ta.value='';
    try{const {data}=await sb.from('records').select('data').eq('id',id).maybeSingle();if(String(currentRecordId)!==String(id))return;ta.value=String(data?.data?.OBSERVACIONES??'');}catch(_){}setEditMode(editMode);
  }

  async function saveNotesAndObservations(){
    if(!currentRecordId)return;const notes=byId('contactNotes')?.value??'',obs=byId('contactObservations')?.value??'';
    try{const {data,error}=await sb.from('records').select('data').eq('id',currentRecordId).maybeSingle();if(error)throw error;const d={...(data?.data||{})};d.NOTAS=notes;d.OBSERVACIONES=obs;const r=await sb.from('records').update({data:d}).eq('id',currentRecordId);if(r.error)throw r.error;}catch(e){console.warn('Ficha contacto: observaciones',e);}
  }

  function bindSave(){
    const b=saveButton();if(!b||b.dataset.tpfProfileSaveWrapped==='1')return;const old=b.onclick;b.dataset.tpfProfileSaveWrapped='1';
    b.onclick=async function(ev){if(typeof old==='function')await old.call(this,ev);await saveNotesAndObservations();setEditMode(false);};
  }

  function queueSync(){if(syncQueued)return;syncQueued=true;requestAnimationFrame(()=>{syncQueued=false;syncUi();});}
  function syncUi(){
    const root=modal();if(!root||root.classList.contains('hidden'))return;
    ensureStyles();ensureEditButton();ensureObservations();bindSave();normalizeCustomFields();ensureLabelSearch();ensureWhatsappMainButton();ensureQuickTemplateButton();wrapTemplateUse();setEditMode(editMode);
  }

  function installObservers(){
    const lm=byId('contactLabelsModal');if(lm&&!labelsObserver){labelsObserver=new MutationObserver(()=>requestAnimationFrame(ensureLabelSearch));labelsObserver.observe(lm,{childList:true,subtree:true});}
  }

  M.register('contact-profile',{
    install(){
      M.wrapGlobals('contact-profile',['renderContactProfile','openContact','openContactProfile','openContactTaskDetail','deleteContactTask','openContactProgrammedWhatsapp','deleteContactProgrammedWhatsapp']);
      ensureStyles();ensureEditButton();installObservers();wrapTemplateUse();allowWhatsappForContact();
      const originalOpen=window.openContact;
      if(typeof originalOpen==='function')window.openContact=async function(id){
        currentRecordId=id;editMode=false;const p=originalOpen.apply(this,arguments);setTimeout(queueSync,0);setTimeout(queueSync,60);const result=await p;queueSync();loadObservation(id);try{window.applyWhatsappVisibilityForContact?.();}catch(_){}return result;
      };

      document.addEventListener('click',e=>{
        const edit=e.target?.closest?.('#tpfContactEditToggle');
        if(edit){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openCreateModalEdit();return;}
        const saveLocal=e.target?.closest?.('#tpfContactSaveLocal');
        if(saveLocal){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();const real=saveButton();if(real&&!real.disabled)real.click();return;}
        const waMain=e.target?.closest?.('#tpfContactWhatsappMain');
        if(waMain){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openContactWhatsappMenu();return;}
        const quickSend=e.target?.closest?.('#waQuickSend');
        if(quickSend && String(quickSend.dataset.mode||'send')==='send'){
          e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();sendQuickWhatsappInsideCrm();return;
        }
      },true);

      document.addEventListener('click',e=>{
        if(e.target?.closest?.('#contactCustomFieldsManage'))setTimeout(()=>normalizeCustomFields(),30);
        if(e.target?.closest?.('[id*="contactLabels"],#contactLabelsModal'))setTimeout(ensureLabelSearch,20);
        if(e.target?.closest?.('#waQuickModal'))setTimeout(()=>{ensureQuickTemplateButton();wrapTemplateUse();},20);
      },false);
      setTimeout(()=>{installObservers();queueSync();wrapTemplateUse();},350);
    }
  });
})();
