(function(){
  'use strict';
  const M=window.TPFModules;
  if(!M)return;

  const labels={todos:'Todos',notas:'Notas',oportunidades:'Oportunidades',tareas:'Tareas'};
  let current='todos';
  let queued=false;
  let waOrigin=null;

  function classify(row){
    const cls=String(row.className||'').toLowerCase();
    const txt=String(row.textContent||'').toLowerCase();
    if(cls.includes('cpevent-opportunity')||txt.includes('oportunidad'))return 'oportunidades';
    if(cls.includes('cpevent-task')||txt.includes('tarea'))return 'tareas';
    if(cls.includes('cpevent-note')||txt.includes('nota'))return 'notas';
    return 'otros';
  }
  function tabs(){return [...document.querySelectorAll('#contactModal .cpTabs > *')];}
  function ensureTabState(){
    tabs().forEach(el=>{
      const text=String(el.textContent||'').trim().toLowerCase();
      const key=text==='todos'?'todos':text==='notas'?'notas':text==='oportunidades'?'oportunidades':text==='tareas'?'tareas':'';
      if(!key)return;
      el.dataset.tpfActivityTab=key;el.setAttribute('role','button');el.setAttribute('tabindex','0');el.style.cursor='pointer';el.style.userSelect='none';
      const active=key===current;el.classList.toggle('tpfActivityTabActive',active);el.style.color=active?'#1d4ed8':'';el.style.fontWeight=active?'700':'';el.style.borderBottom=active?'3px solid #2563eb':'';el.style.paddingBottom=active?'12px':'';
    });
  }
  function applyFilter(){
    queued=false;const modal=document.getElementById('contactModal');if(!modal||modal.classList.contains('hidden'))return;ensureTabState();
    const timeline=document.getElementById('cpTimeline');if(!timeline)return;const rows=[...timeline.querySelectorAll('.cpEvent')];let shown=0;
    rows.forEach(row=>{const visible=current==='todos'||classify(row)===current;row.style.display=visible?'':'none';if(visible)shown++;});
    let empty=document.getElementById('tpfActivityFilterEmpty');if(!empty){empty=document.createElement('div');empty.id='tpfActivityFilterEmpty';empty.className='cpEmpty';timeline.appendChild(empty);}
    empty.textContent='No hay '+labels[current].toLowerCase()+' en el historial.';empty.style.display=shown?'none':'';
  }
  function queueFilter(){if(queued)return;queued=true;requestAnimationFrame(applyFilter);}
  function select(key){if(!labels[key])return;current=key;queueFilter();}
  function repairTaskDom(){
    const create=document.getElementById('cpTaskPage'),detail=document.getElementById('cpTaskDetailPage');
    if(create&&detail&&create.contains(detail)&&create.parentNode)create.parentNode.insertBefore(detail,create.nextSibling);
  }
  function rememberWaOrigin(){
    const selected=(typeof waLiveState!=='undefined'&&waLiveState?.selected)||null;
    waOrigin={chatId:String(selected?.id||''),kind:'whatsapp'};
  }
  function prepareWaContact(){
    if(typeof waLiveState==='undefined'||!waLiveState?.contact)return false;
    currentContact=waLiveState.contact;
    return true;
  }
  async function renderDirectSection(kind){
    if(!prepareWaContact())return;
    rememberWaOrigin();
    repairTaskDom();
    document.getElementById('cpTaskPage')?.classList.add('hidden');
    document.getElementById('cpTaskDetailPage')?.classList.add('hidden');
    document.getElementById('contactModal')?.classList.remove('hidden');
    if(typeof renderContactProfile==='function')await renderContactProfile();
    select(kind);
  }
  async function openDirectTask(id){
    if(!prepareWaContact())return;
    rememberWaOrigin();
    repairTaskDom();
    document.getElementById('contactModal')?.classList.remove('hidden');
    document.getElementById('cpTaskPage')?.classList.add('hidden');
    document.getElementById('cpTaskDetailPage')?.classList.add('hidden');
    await window.openContactTaskDetail?.(id);
  }
  function backToWhatsapp(e){
    if(!waOrigin)return false;
    e?.preventDefault?.();e?.stopPropagation?.();e?.stopImmediatePropagation?.();
    document.getElementById('cpTaskDetailPage')?.classList.add('hidden');
    document.getElementById('cpTaskPage')?.classList.add('hidden');
    document.getElementById('contactModal')?.classList.add('hidden');
    const chatId=waOrigin.chatId;waOrigin=null;
    try{document.querySelector('[data-view="whatsapplive"]')?.click();}catch(_){}
    if(chatId&&typeof window.selectWhatsAppChat==='function')setTimeout(()=>window.selectWhatsAppChat(chatId),0);
    return true;
  }

  M.register('contact-activity',{install(){
    repairTaskDom();
    document.addEventListener('click',e=>{
      const task=e.target?.closest?.('#waSideTasks .waSideItem');
      if(task){
        const m=String(task.getAttribute('onclick')||'').match(/openContactTaskDetail\(['\"]([^'\"]+)['\"]\)/);
        if(m){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openDirectTask(m[1]);return;}
      }
      const viewTasks=e.target?.closest?.('#waSideViewTasks');
      if(viewTasks){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();renderDirectSection('tareas');return;}
      const viewOpps=e.target?.closest?.('#waSideViewOpps');
      if(viewOpps){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();renderDirectSection('oportunidades');return;}
      const back=e.target?.closest?.('#contactClose,#cpTaskBack,#cpTaskDetailBack');
      if(back&&waOrigin){backToWhatsapp(e);return;}
      const tab=e.target?.closest?.('#contactModal .cpTabs [data-tpf-activity-tab], #contactModal .cpTabs > *');
      if(tab){const text=String(tab.dataset.tpfActivityTab||tab.textContent||'').trim().toLowerCase();const key=text==='todos'?'todos':text==='notas'?'notas':text==='oportunidades'?'oportunidades':text==='tareas'?'tareas':'';if(key){e.preventDefault();e.stopPropagation();select(key);return;}}
      if(e.target?.closest?.('[onclick*="openContact"], [data-contact-id]'))setTimeout(queueFilter,60);
    },true);
    document.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const tab=e.target?.closest?.('#contactModal .cpTabs [data-tpf-activity-tab]');if(!tab)return;e.preventDefault();select(tab.dataset.tpfActivityTab);});
    window.addEventListener('tpf:contact-open',()=>setTimeout(queueFilter,0));
    setTimeout(()=>{repairTaskDom();queueFilter();},300);
  }});
})();
