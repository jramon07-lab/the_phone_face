(function(){
  'use strict';
  const M=window.TPFModules;
  if(!M) return;
  function installSalesSafeUi(){
    if(document.getElementById('tpfSalesSafeUi'))return;
    const s=document.createElement('style');s.id='tpfSalesSafeUi';s.textContent=`
#view-sales #salesScrollLeft,#view-sales #salesScrollRight{display:none!important}
#view-sales .salesBoardViewport{padding-left:8px!important;padding-right:8px!important}
#view-sales .salesNavWrap{display:block!important}
#view-sales #salesScroll{width:100%!important;max-width:100%!important}
#view-sales #salesBoard.board{grid-auto-columns:245px!important;gap:10px!important;min-width:max-content!important;width:max-content!important}
#view-sales #salesBoard>.stage{width:245px!important;min-width:245px!important;max-width:245px!important}
#view-sales .opp{min-height:0!important;max-height:none!important;overflow:visible!important}
.tpfOppMenu{position:fixed;z-index:26000;width:220px;padding:6px;background:#fff;border:1px solid #dfe5ec;border-radius:10px;box-shadow:0 14px 38px rgba(20,35,55,.20)}
.tpfOppMenu button{display:block;width:100%;border:0;background:#fff;text-align:left;padding:9px 10px;border-radius:7px;color:#26364a;font-size:12px;font-weight:650}
.tpfOppMenu button:hover{background:#f3f6fa}.tpfOppMenu .tpfDanger{color:#b42318;border-top:1px solid #edf0f4;border-radius:0;margin-top:4px;padding-top:10px}
`;document.head.appendChild(s);
  }
  function closeOppMenu(){document.querySelectorAll('.tpfOppMenu').forEach(x=>x.remove())}
  function getOpp(id){try{return (salesCache?.opportunities||[]).find(x=>String(x.id)===String(id))||null}catch(_){return null}}
  function openDirectWhatsapp(opp){
    const phone=String(opp?.phone||'').trim();
    if(!phone){alert('Esta oportunidad no tiene teléfono.');return}
    if(typeof openWaQuick==='function'){
      openWaQuick({phone,name:String(opp?.client_name||'').trim(),message:''});
      return;
    }
    if(document.getElementById('waQuickPhone'))document.getElementById('waQuickPhone').value=phone;
    document.getElementById('waQuickModal')?.classList.remove('hidden');
  }
  function openOppActions(ev,id){
    ev.preventDefault();ev.stopPropagation();closeOppMenu();
    const opp=getOpp(id);
    const m=document.createElement('div');m.className='tpfOppMenu';
    const add=(label,fn,cls='')=>{const b=document.createElement('button');b.textContent=label;b.className=cls;b.onclick=e=>{e.stopPropagation();closeOppMenu();fn()};m.appendChild(b)};
    add('Abrir ficha',()=>window.openOpportunityCard?.(id));
    add('Editar oportunidad',()=>window.openOpportunityCard?.(id));
    add('Mover a otra columna',()=>{const card=document.querySelector(`.opp[data-opp-id="${CSS.escape(String(id))}"]`);const sel=card?.querySelector('.oppFooter select');if(sel){sel.focus();sel.click()}});
    add('Crear tarea / recordatorio',()=>{try{window.createAgendaFromRecord?.(JSON.stringify({id:'',name:opp?.client_name||'',phone:opp?.phone||''}))}catch(_){document.querySelector('.nav[data-view="agenda"]')?.click()}});
    add('Abrir WhatsApp',()=>openDirectWhatsapp(opp));
    add('Programar WhatsApp',()=>{const phone=String(opp?.phone||'');if(document.getElementById('waQuickPhone'))document.getElementById('waQuickPhone').value=phone;document.getElementById('waScheduleBtn')?.click()});
    add('Eliminar oportunidad',()=>window.deleteOpp?.(id),'tpfDanger');
    document.body.appendChild(m);
    const r=ev.currentTarget.getBoundingClientRect(),w=220;
    m.style.left=Math.max(8,Math.min(innerWidth-w-8,r.right-w))+'px';
    m.style.top=Math.max(8,Math.min(innerHeight-m.offsetHeight-8,r.bottom+4))+'px';
  }
  function bindOppMenus(){
    document.querySelectorAll('#salesBoard .oppMenu').forEach(b=>{
      if(b.dataset.tpfActions==='1')return;
      const card=b.closest('.opp'),id=card?.dataset?.oppId;if(!id)return;
      b.dataset.tpfActions='1';b.onclick=e=>openOppActions(e,id);b.title='Acciones de la oportunidad';
    });
  }
  M.register('contacts-sales',{
    install(){
      installSalesSafeUi();bindOppMenus();
      document.addEventListener('click',e=>{if(!e.target.closest('.tpfOppMenu,.oppMenu'))closeOppMenu()});
      const board=document.getElementById('salesBoard');if(board)new MutationObserver(bindOppMenus).observe(board,{childList:true,subtree:true});
      M.wrapGlobals('contacts-sales',['loadSales','renderSales','renderSalesList','openOpportunityFull','openOpportunityCard','deleteOpp','moveSelectedSalesOpportunities','deleteSelectedSalesOpportunities','loadDatabase','renderDatabase','saveContact','deleteContact']);
    }
  });
})();
