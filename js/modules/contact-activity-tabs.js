(function(){
  'use strict';
  if(window.__tpfContactActivityTabs)return;
  window.__tpfContactActivityTabs=true;

  const labels={todos:'Todos',notas:'Notas',oportunidades:'Oportunidades',tareas:'Tareas'};
  let current='todos';
  let queued=false;

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
    queued=false;
    const modal=document.getElementById('contactModal');
    if(!modal||modal.classList.contains('hidden'))return;
    ensureTabState();
    const timeline=document.getElementById('cpTimeline');
    if(!timeline)return;
    const rows=[...timeline.querySelectorAll('.cpEvent')];
    let shown=0;
    rows.forEach(row=>{
      const visible=current==='todos'||classify(row)===current;
      row.style.display=visible?'':'none';
      if(visible)shown++;
    });
    let empty=document.getElementById('tpfActivityFilterEmpty');
    if(!empty){
      empty=document.createElement('div');
      empty.id='tpfActivityFilterEmpty';
      empty.className='cpEmpty';
      timeline.appendChild(empty);
    }
    empty.textContent='No hay '+labels[current].toLowerCase()+' en el historial.';
    empty.style.display=shown?'none':'';
  }

  function queueFilter(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(applyFilter);
  }

  function select(key){
    if(!labels[key])return;
    current=key;
    queueFilter();
  }

  document.addEventListener('click',e=>{
    const tab=e.target?.closest?.('#contactModal .cpTabs [data-tpf-activity-tab], #contactModal .cpTabs > *');
    if(tab){
      const text=String(tab.dataset.tpfActivityTab||tab.textContent||'').trim().toLowerCase();
      const key=text==='todos'?'todos':text==='notas'?'notas':text==='oportunidades'?'oportunidades':text==='tareas'?'tareas':'';
      if(key){e.preventDefault();e.stopPropagation();select(key);return;}
    }
    if(e.target?.closest?.('[onclick*="openContact"], [data-contact-id]'))setTimeout(queueFilter,60);
  },true);

  document.addEventListener('keydown',e=>{
    if(e.key!=='Enter'&&e.key!==' ')return;
    const tab=e.target?.closest?.('#contactModal .cpTabs [data-tpf-activity-tab]');
    if(!tab)return;
    e.preventDefault();select(tab.dataset.tpfActivityTab);
  });

  window.addEventListener('tpf:contact-open',()=>setTimeout(queueFilter,0));
  setTimeout(queueFilter,300);
})();
