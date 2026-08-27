(function(){
  'use strict';
  if(window.__tpfSeparateContactEditorInstalled)return;
  window.__tpfSeparateContactEditorInstalled=true;

  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let editingId=null;
  let originalData=null;

  function ensureStyles(){
    if($('tpfContactEditorStyles'))return;
    const s=document.createElement('style');
    s.id='tpfContactEditorStyles';
    s.textContent=`
      #tpfContactEditorBack{position:fixed;inset:0;z-index:70000;background:rgba(20,27,38,.46);display:flex;align-items:center;justify-content:center;padding:18px;box-sizing:border-box}
      #tpfContactEditorBack.hidden{display:none!important}
      .tpfContactEditor{width:min(760px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 24px 80px rgba(0,0,0,.28);padding:0}
      .tpfContactEditorHead{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:20px 22px;border-bottom:1px solid #e9edf3;background:#fff}
      .tpfContactEditorHead h2{margin:0;font-size:22px}.tpfContactEditorBody{padding:22px}
      .tpfEditSectionTitle{font-size:13px;font-weight:800;color:#667085;text-transform:uppercase;letter-spacing:.04em;margin:0 0 12px}
      .tpfEditGrid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.tpfEditGrid .full{grid-column:1/-1}
      .tpfEditField{display:flex;flex-direction:column;gap:6px}.tpfEditField label{font-size:13px;font-weight:700;color:#344054}
      .tpfEditField input,.tpfEditField textarea{width:100%;box-sizing:border-box;border:1px solid #d0d5dd;border-radius:10px;padding:11px 12px;font:inherit;background:#fff}.tpfEditField textarea{min-height:100px;resize:vertical}
      .tpfContactEditorActions{position:sticky;bottom:0;display:flex;justify-content:flex-end;gap:10px;padding:16px 22px;border-top:1px solid #e9edf3;background:#fff}
      #tpfContactEditorMsg{min-height:20px;margin-top:10px;font-size:13px;color:#667085}
      @media(max-width:640px){#tpfContactEditorBack{padding:0;align-items:stretch}.tpfContactEditor{max-height:none;height:100%;border-radius:0}.tpfEditGrid{grid-template-columns:1fr}.tpfEditGrid .full{grid-column:auto}.tpfContactEditorHead{padding:16px}.tpfContactEditorBody{padding:16px}.tpfContactEditorActions{padding:14px 16px}}
    `;
    document.head.appendChild(s);
  }

  function ensureEditor(){
    if($('tpfContactEditorBack'))return;
    const back=document.createElement('div');
    back.id='tpfContactEditorBack';back.className='hidden';
    back.innerHTML=`<div class="tpfContactEditor" role="dialog" aria-modal="true" aria-labelledby="tpfContactEditorTitle">
      <div class="tpfContactEditorHead"><h2 id="tpfContactEditorTitle">Editar contacto</h2><button id="tpfContactEditorTopClose" type="button" class="secondary">← Volver</button></div>
      <div class="tpfContactEditorBody">
        <div class="tpfEditSectionTitle">Información básica</div>
        <div class="tpfEditGrid">
          <div class="tpfEditField"><label>Nombre</label><input id="tpfEditFirstName"></div>
          <div class="tpfEditField"><label>Apellidos</label><input id="tpfEditLastName"></div>
          <div class="tpfEditField"><label>Teléfono</label><input id="tpfEditPhone" inputmode="tel"></div>
          <div class="tpfEditField"><label>DNI / NIF</label><input id="tpfEditDni"></div>
          <div class="tpfEditField full"><label>Correo electrónico</label><input id="tpfEditEmail" type="email"></div>
          <div class="tpfEditField full"><label>Notas</label><textarea id="tpfEditNotes"></textarea></div>
          <div class="tpfEditField full"><label>Observaciones</label><textarea id="tpfEditObservations"></textarea></div>
        </div>
        <div id="tpfContactEditorMsg"></div>
      </div>
      <div class="tpfContactEditorActions"><button id="tpfContactEditorCancel" type="button" class="secondary">Cancelar</button><button id="tpfContactEditorSave" type="button" class="primary">Guardar datos</button></div>
    </div>`;
    document.body.appendChild(back);
    const close=()=>{back.classList.add('hidden');editingId=null;originalData=null;};
    $('tpfContactEditorTopClose').onclick=close;$('tpfContactEditorCancel').onclick=close;
    back.addEventListener('click',e=>{if(e.target===back)close();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!back.classList.contains('hidden'))close();});
    $('tpfContactEditorSave').onclick=save;
  }

  function field(d,...names){for(const n of names){if(d&&d[n]!==undefined&&d[n]!==null)return d[n]}return ''}
  function splitName(full){const p=String(full||'').trim().replace(/\s+/g,' ').split(' ').filter(Boolean);if(!p.length)return['',''];if(p.length===1)return[p[0],''];return[p.shift(),p.join(' ')];}
  function setVal(id,v){const el=$(id);if(el)el.value=String(v??'');}

  async function open(id){
    ensureStyles();ensureEditor();
    if(!id){try{id=currentContact?.id}catch(_){} }
    if(!id){$('tpfContactEditorMsg').textContent='No se ha podido identificar el contacto.';return;}
    const {data,error}=await sb.from('records').select('id,source_sheet,source_row,data').eq('id',id).maybeSingle();
    if(error||!data){alert(error?.message||'No se encontró el contacto.');return;}
    editingId=data.id;originalData={...(data.data||{})};
    const full=field(originalData,'NOMBRE Y APELLIDOS','CLIENTE','CLIENTE FINAL');
    const [fallbackFirst,fallbackLast]=splitName(full);
    setVal('tpfEditFirstName',field(originalData,'NOMBRE')||fallbackFirst);
    setVal('tpfEditLastName',field(originalData,'APELLIDOS','APELLIDO')||fallbackLast);
    setVal('tpfEditPhone',field(originalData,'TELÉFONO','TELEFONO','PHONE','MOVIL'));
    setVal('tpfEditDni',field(originalData,'DNI / NIF','DNI','NIF'));
    setVal('tpfEditEmail',field(originalData,'EMAIL','Email','email'));
    setVal('tpfEditNotes',field(originalData,'NOTAS','NOTES'));
    setVal('tpfEditObservations',field(originalData,'OBSERVACIONES'));
    $('tpfContactEditorMsg').textContent='';
    $('tpfContactEditorBack').classList.remove('hidden');
    setTimeout(()=>$('tpfEditFirstName')?.focus(),30);
  }

  function assignPreservingAliases(d,names,value,preferred){
    let touched=false;for(const n of names){if(Object.prototype.hasOwnProperty.call(d,n)){d[n]=value;touched=true;}}
    if(!touched)d[preferred]=value;
  }

  async function save(){
    if(!editingId||!originalData)return;
    const btn=$('tpfContactEditorSave'),msg=$('tpfContactEditorMsg');
    btn.disabled=true;btn.textContent='Guardando…';msg.textContent='';
    try{
      const d={...originalData};
      const first=$('tpfEditFirstName').value.trim();
      const last=$('tpfEditLastName').value.trim();
      const full=[first,last].filter(Boolean).join(' ').trim();
      assignPreservingAliases(d,['NOMBRE'],'NOMBRE',first);
      assignPreservingAliases(d,['APELLIDOS','APELLIDO'],'APELLIDOS',last);
      if(Object.prototype.hasOwnProperty.call(d,'NOMBRE Y APELLIDOS'))d['NOMBRE Y APELLIDOS']=full;
      else if(Object.prototype.hasOwnProperty.call(d,'CLIENTE'))d.CLIENTE=full;
      else d['NOMBRE Y APELLIDOS']=full;
      assignPreservingAliases(d,['TELÉFONO','TELEFONO','PHONE','MOVIL'],$('tpfEditPhone').value.trim(),'TELÉFONO');
      assignPreservingAliases(d,['DNI / NIF','DNI','NIF'],$('tpfEditDni').value.trim(),'DNI / NIF');
      assignPreservingAliases(d,['EMAIL','Email','email'],$('tpfEditEmail').value.trim(),'EMAIL');
      assignPreservingAliases(d,['NOTAS','NOTES'],$('tpfEditNotes').value,'NOTAS');
      assignPreservingAliases(d,['OBSERVACIONES'],$('tpfEditObservations').value,'OBSERVACIONES');
      const {error}=await sb.from('records').update({data:d}).eq('id',editingId);
      if(error)throw error;
      originalData=d;msg.textContent='Datos guardados correctamente.';
      const id=editingId;
      setTimeout(async()=>{
        $('tpfContactEditorBack').classList.add('hidden');
        try{if(typeof window.openContact==='function')await window.openContact(id);}catch(_){ }
      },250);
    }catch(e){msg.textContent=e?.message||'No se pudieron guardar los datos.';}
    finally{btn.disabled=false;btn.textContent='Guardar datos';}
  }

  window.tpfOpenContactEditor=open;
})();