(function(){
  'use strict';
  const M=window.TPFModules;
  if(!M) return;

  const CORE_FIELD_IDS=['contactFirstName','contactLastName','contactName','contactPhone','contactDni','contactEmail','contactNotes'];
  let editMode=false;
  let observer=null;

  function byId(id){return document.getElementById(id)}
  function modal(){return byId('contactModal')}
  function visible(el){return !!(el&&el.offsetParent!==null)}

  function findSaveButton(){
    const root=modal();
    if(!root)return null;
    return [...root.querySelectorAll('button')].find(b=>/guardar\s+cambios/i.test(String(b.textContent||'')))||null;
  }

  function customFieldRoot(){
    const root=modal();
    if(!root)return null;
    const nodes=[...root.querySelectorAll('section,div,aside')].filter(el=>{
      const own=[...el.childNodes].filter(n=>n.nodeType===3||n.nodeType===1).slice(0,4).map(n=>n.textContent||'').join(' ');
      return /campos\s+personalizados/i.test(own) && !/campos\s+personalizados\s+de\s+contactos/i.test(own);
    });
    return nodes.sort((a,b)=>a.querySelectorAll('input,textarea,select').length-b.querySelectorAll('input,textarea,select').length).find(x=>x.querySelector('input,textarea,select'))||null;
  }

  function editableFields(){
    const out=[];
    CORE_FIELD_IDS.forEach(id=>{const el=byId(id);if(el)out.push(el)});
    const custom=customFieldRoot();
    if(custom)custom.querySelectorAll('input,textarea,select').forEach(el=>{
      if(!el.closest('[role="dialog"]')||el.closest('[role="dialog"]')===modal())out.push(el);
    });
    return [...new Set(out)];
  }

  function ensureStyles(){
    if(byId('tpfContactProfileProtectionStyles'))return;
    const s=document.createElement('style');
    s.id='tpfContactProfileProtectionStyles';
    s.textContent=`
      #contactModal.tpf-contact-readonly input:disabled,
      #contactModal.tpf-contact-readonly textarea:disabled,
      #contactModal.tpf-contact-readonly select:disabled{opacity:1!important;color:#344054!important;background:#f7f9fc!important;cursor:default!important;-webkit-text-fill-color:#344054!important}
      #tpfContactEditToggle{margin-right:8px}
      #contactModal .tpfContactProtectedHint{font-size:11px;color:#667085;margin:4px 0 8px}
    `;
    document.head.appendChild(s);
  }

  function ensureToggle(){
    const save=findSaveButton();
    if(!save||byId('tpfContactEditToggle'))return;
    const b=document.createElement('button');
    b.id='tpfContactEditToggle';
    b.type='button';
    b.className='secondary';
    b.textContent='Editar datos';
    b.addEventListener('click',()=>setEditMode(!editMode));
    save.parentElement?.insertBefore(b,save);
  }

  function setEditMode(on){
    editMode=!!on;
    const root=modal();
    if(!root)return;
    ensureStyles();ensureToggle();
    root.classList.toggle('tpf-contact-readonly',!editMode);
    editableFields().forEach(el=>{
      el.disabled=!editMode;
      el.setAttribute('aria-disabled',String(!editMode));
    });
    const toggle=byId('tpfContactEditToggle');
    if(toggle)toggle.textContent=editMode?'Cancelar edición':'Editar datos';
    const save=findSaveButton();
    if(save){
      save.disabled=!editMode;
      save.style.display=editMode?'':'none';
    }
  }

  function enhanceCustomTypeSelector(){
    const dialogs=[...document.querySelectorAll('div,section')].filter(el=>visible(el)&&/campos\s+personalizados\s+de\s+contactos/i.test(el.textContent||''));
    for(const dlg of dialogs){
      const selects=[...dlg.querySelectorAll('select')];
      for(const sel of selects){
        const label=sel.closest('label')?.textContent||sel.parentElement?.textContent||'';
        if(!/tipo/i.test(label))continue;
        const textOpt=[...sel.options].find(o=>String(o.value).toLowerCase()==='text'||/^texto$/i.test(o.textContent||''));
        if(textOpt)textOpt.textContent='Texto / alfanumérico (letras y números)';
      }
    }
  }

  function normalizeCustomInputs(){
    const root=customFieldRoot();
    if(!root)return;
    root.querySelectorAll('input[type="text"],textarea').forEach(el=>{
      el.removeAttribute('pattern');
      el.removeAttribute('inputmode');
    });
  }

  function syncProtection(){
    const root=modal();
    if(!root||root.classList.contains('hidden'))return;
    ensureStyles();ensureToggle();normalizeCustomInputs();enhanceCustomTypeSelector();setEditMode(editMode);
  }

  function installObserver(){
    if(observer)return;
    observer=new MutationObserver(()=>{
      if(modal()&&!modal().classList.contains('hidden')){
        requestAnimationFrame(()=>{enhanceCustomTypeSelector();normalizeCustomInputs();if(!editMode)setEditMode(false);});
      }
    });
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  }

  M.register('contact-profile',{
    install(){
      M.wrapGlobals('contact-profile',[
        'renderContactProfile','openContact','openContactProfile',
        'openContactTaskDetail','deleteContactTask',
        'openContactProgrammedWhatsapp','deleteContactProgrammedWhatsapp'
      ]);
      installObserver();
      document.addEventListener('click',e=>{
        const save=e.target?.closest?.('button');
        if(save&&/guardar\s+cambios/i.test(String(save.textContent||''))&&save.closest('#contactModal')){
          setTimeout(()=>setEditMode(false),250);
        }
      },true);
      const originalOpen=window.openContact;
      if(typeof originalOpen==='function'){
        window.openContact=async function(){
          editMode=false;
          const result=await originalOpen.apply(this,arguments);
          setTimeout(syncProtection,0);
          setTimeout(syncProtection,180);
          return result;
        };
      }
      setTimeout(syncProtection,500);
    }
  });
})();
