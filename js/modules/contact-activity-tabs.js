(function(){
  'use strict';
  if(window.__tpfContactActivityTabs)return;
  window.__tpfContactActivityTabs=true;

  const labels={todos:'Todos',notas:'Notas',oportunidades:'Oportunidades',tareas:'Tareas'};
  let current='todos';

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
    const ts=tabs();
    ts.forEach(el=>{
      const text=String(el.textContent||'').trim().toLowerCase();
      let key='';
      if(text==='todos')key='todos';
      else if(text==='notas')key='notas';
      else if(text==='oportunidades')key='oportunidades';
      else if(text==='tareas')key='tareas';
      if(!key)return;
      el.dataset.tpfActivityTab=key;
      el.setAttribute('role','button');
      el.setAttribute('tabindex','0');
      el.style.cursor='pointer';
      el.style.userSelect='none';
      const active=key===current;
      el.classList.toggle('tpfActivityTabActive',active);
      el.style.color=active?'#1d4ed8':'';
      el.style.fontWeight=active?'700':'';
      el.style.borderBottom=active?'3px solid #2563eb':'';
      el.style.paddingBottom=active?'12px':'';
    });
  }

  function applyFilter(){
    ensureTabState();
    const rows=[...document.querySelectorAll('#contactModal #cpTimeline .cpEvent')];
    let shown=0;
    rows.forEach(row=>{
      const type=classify(row);
      const visible=current==='todos'||type===current;
      row.style.display=visible?'':'none';
      if(visible)shown++;
    });
    let empty=document.getElementById('tpfActivityFilterEmpty');
    const timeline=document.getElementById('cpTimeline');
    if(!timeline)return;
    if(!empty){empty=document.createElement('div');empty.id='tpfActivityFilterEmpty';empty.className='cpEmpty';timeline.appendChild(empty);}
    empty.textContent='No hay '+labels[current].toLowerCase()+' en el historial.';
    empty.style.display=shown?'none':'';
  }

  function select(key){
    if(!labels[key])return;
    current=key;
    applyFilter();
  }

  document.addEventListener('click',e=>{
    const tab=e.target?.closest?.('#contactModal .cpTabs [data-tpf-activity-tab], #contactModal .cpTabs > *');
    if(!tab)return;
    const text=String(tab.dataset.tpfActivityTab||tab.textContent||'').trim().toLowerCase();
    const key=text==='todos'?'todos':text==='notas'?'notas':text==='oportunidades'?'oportunidades':text==='tareas'?'tareas':'';
    if(!key)return;
    e.preventDefault();e.stopPropagation();
    select(key);
  },true);

  document.addEventListener('keydown',e=>{
    if(e.key!=='Enter'&&e.key!==' ')return;
    const tab=e.target?.closest?.('#contactModal .cpTabs [data-tpf-activity-tab]');
    if(!tab)return;
    e.preventDefault();select(tab.dataset.tpfActivityTab);
  });

  const observer=new MutationObserver(()=>{
    const modal=document.getElementById('contactModal');
    if(!modal||modal.classList.contains('hidden'))return;
    requestAnimationFrame(applyFilter);
  });
  observer.observe(document.body,{childList:true,subtree:true});
  setTimeout(applyFilter,300);
})();
