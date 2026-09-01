(function(){
  'use strict';
  const M=window.TPFModules;
  if(!M)return;

  // Native owners only: contact-profile/contacts-sales-core for contact+tasks,
  // sales owner for opportunities. This module changes layout/DOM ownership only.
  function ensureContactScroll(){
    if(document.getElementById('tpfContactThreeColumnScroll'))return;
    const s=document.createElement('style');
    s.id='tpfContactThreeColumnScroll';
    s.textContent=`
      #contactModal.contactProfileBack{overflow:hidden!important}
      #contactModal .contactProfile{height:100vh!important;min-height:100vh!important;overflow:hidden!important}
      #contactModal .cpColumns{height:calc(100vh - 62px)!important;min-height:0!important;overflow:hidden!important;align-items:stretch!important}
      #contactModal .cpLeft,#contactModal .cpCenter,#contactModal .cpRight{height:100%!important;max-height:100%!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;overscroll-behavior:contain}
      #contactModal .cpLeft{position:relative!important;top:auto!important;align-self:stretch!important}
      #contactModal .cpTaskPage:not(.hidden){position:absolute!important;inset:0!important;z-index:120!important;background:#f7f9fc!important;display:flex!important;flex-direction:column!important;overflow:hidden!important}
      #contactModal .cpTaskPageTop{position:relative!important;top:0!important;z-index:3!important;flex:0 0 auto!important;min-height:72px!important;display:grid!important;grid-template-columns:minmax(120px,1fr) minmax(260px,2fr) minmax(120px,1fr)!important;align-items:center!important;gap:14px!important;padding:12px 20px!important;background:#fff!important;border-bottom:1px solid #e3e7ed!important}
      #contactModal .cpTaskPageTop>div{text-align:center!important;min-width:0!important}
      #contactModal .cpTaskPageTop>div b,#contactModal .cpTaskPageTop>div small{display:block!important}
      #contactModal .cpTaskPageTop>button:first-child{justify-self:start!important;visibility:visible!important;opacity:1!important}
      #contactModal .cpTaskPageTop>button:last-child{justify-self:end!important;visibility:visible!important;opacity:1!important}
      #contactModal .cpTaskPageBody{flex:1 1 auto!important;min-height:0!important;overflow:auto!important;padding:24px!important}
      .tpfContactOppListBack{position:fixed;inset:0;z-index:99000;background:#0c1628a6;display:grid;place-items:center;padding:18px}
      .tpfContactOppList{width:min(720px,100%);max-height:90vh;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 25px 70px #0005}
      .tpfContactOppListHead{display:flex;align-items:center;justify-content:space-between;padding:17px 19px;border-bottom:1px solid #e4e8ef}
      .tpfContactOppListBody{padding:12px 18px;overflow:auto;max-height:70vh}.tpfContactOppNativeRow{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:13px 4px;border-bottom:1px solid #edf0f5}.tpfContactOppNativeRow small{display:block;color:#6b7280;margin-top:4px}
      #cpViewOpportunities{margin:10px 0 0;width:100%}
      @media(max-width:1100px){#contactModal.contactProfileBack{overflow:auto!important}#contactModal .contactProfile{height:auto!important;min-height:100vh!important;overflow:visible!important}#contactModal .cpColumns{height:auto!important;overflow:visible!important}#contactModal .cpLeft,#contactModal .cpCenter,#contactModal .cpRight{height:auto!important;max-height:none!important;overflow:visible!important}#contactModal .cpTaskPage:not(.hidden){position:fixed!important;inset:0!important;height:100vh!important}}
      @media(max-width:700px){#contactModal .cpTaskPageTop{grid-template-columns:auto 1fr auto!important;padding:10px!important;gap:8px!important}#contactModal .cpTaskPageTop>div small{display:none!important}#contactModal .cpTaskPageBody{padding:12px!important}}
    `;
    document.head.appendChild(s);
  }

  function ensureNativeTaskPageOwnership(){
    const createPage=document.getElementById('cpTaskPage');
    const detailPage=document.getElementById('cpTaskDetailPage');
    if(createPage&&detailPage&&detailPage.parentElement===createPage)createPage.insertAdjacentElement('afterend',detailPage);
    const newTask=document.getElementById('cpNewTask');
    if(newTask){newTask.textContent='＋ Tarea';newTask.title='Nueva tarea';}
  }

  function currentContactOpportunities(){
    try{
      const c=currentContact;if(!c)return[];
      const data=c.data||{};
      const phone=String(document.getElementById('contactPhone')?.value||data['TELÉFONO']||data.TELEFONO||'').replace(/\D/g,'').slice(-9);
      const name=String(document.getElementById('contactName')?.value||data['NOMBRE Y APELLIDOS']||data.NOMBRE||'').trim().toLowerCase();
      return (salesCache?.opportunities||[]).filter(o=>String(o.record_id||'')===String(c.id)||(phone&&String(o.phone||'').replace(/\D/g,'').slice(-9)===phone)||(name&&String(o.client_name||'').trim().toLowerCase()===name));
    }catch(_){return[]}
  }

  function openNativeOpportunity(id){
    document.querySelector('.tpfContactOppListBack')?.remove();
    if(typeof window.openOpportunityCard==='function')window.openOpportunityCard(id);
  }

  function showContactOpportunities(){
    const rows=currentContactOpportunities();
    document.querySelector('.tpfContactOppListBack')?.remove();
    const back=document.createElement('div');back.className='tpfContactOppListBack';
    const name=document.getElementById('contactName')?.value||'Contacto';
    back.innerHTML=`<div class="tpfContactOppList"><div class="tpfContactOppListHead"><div><h3 style="margin:0">Oportunidades</h3><small>${String(name).replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[m]))}</small></div><button class="secondary" data-close>← Volver</button></div><div class="tpfContactOppListBody"></div></div>`;
    const body=back.querySelector('.tpfContactOppListBody');
    if(!rows.length)body.innerHTML='<div class="small" style="padding:18px 0">Sin oportunidades.</div>';
    rows.forEach(o=>{
      const row=document.createElement('div');row.className='tpfContactOppNativeRow';
      const left=document.createElement('div');const title=document.createElement('b');title.textContent=o.title||'Oportunidad';const meta=document.createElement('small');meta.textContent=[o.status||'',o.expected_date?new Date(o.expected_date+'T12:00:00').toLocaleDateString('es-ES'):''].filter(Boolean).join(' · ');left.append(title,meta);
      const b=document.createElement('button');b.className='secondary';b.textContent='Ver / editar';b.onclick=()=>openNativeOpportunity(o.id);row.append(left,b);body.appendChild(row);
    });
    back.querySelector('[data-close]').onclick=()=>back.remove();back.onclick=e=>{if(e.target===back)back.remove()};document.body.appendChild(back);
  }

  function ensureOpportunityEntry(){
    const root=document.getElementById('cpOpportunities');if(!root)return;
    let b=document.getElementById('cpViewOpportunities');
    if(!b){b=document.createElement('button');b.id='cpViewOpportunities';b.type='button';b.className='secondary';b.textContent='Ver oportunidades';b.onclick=showContactOpportunities;root.insertAdjacentElement('afterend',b);}
    const rows=currentContactOpportunities();
    [...root.children].forEach((card,i)=>{
      const edit=[...card.querySelectorAll('button')].find(x=>/ver\s*\/\s*editar/i.test(x.textContent||''));
      if(edit&&rows[i])edit.onclick=e=>{e.preventDefault();e.stopPropagation();openNativeOpportunity(rows[i].id);};
    });
  }

  M.register('contact-opportunities',{install(){
    ensureContactScroll();ensureNativeTaskPageOwnership();ensureOpportunityEntry();
    const root=document.getElementById('cpOpportunities');if(root)new MutationObserver(()=>ensureOpportunityEntry()).observe(root,{childList:true,subtree:true});
  }});
})();
