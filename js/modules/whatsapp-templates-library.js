(function(){
'use strict';
const M=window.TPFModules;if(!M)return;
let previousView='view-dashboard';

function visibleView(){
  return [...document.querySelectorAll('.referenceWorkspace main > section')].find(x=>!x.classList.contains('hidden'))?.id||'view-dashboard';
}
function ensureStyles(){
  if(document.getElementById('tpfWaTemplateLibraryStyles'))return;
  const s=document.createElement('style');s.id='tpfWaTemplateLibraryStyles';s.textContent=`
  #view-wa-templates-library{padding:20px;min-height:calc(100dvh - 64px)}
  .tpfTplPageHead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
  .tpfTplPageHead h2{margin:0}.tpfTplPageHead p{margin:4px 0 0;color:#667085;font-size:12px}
  #tpfTplPageMount .waTemplateCard{position:static!important;transform:none!important;width:100%!important;max-width:none!important;max-height:none!important;box-shadow:none!important;border:1px solid #e4e7ec!important;border-radius:14px!important;margin:0!important}
  #tpfTplPageMount .waTemplateHead{display:none!important}
  .tpfTplSearchWrap{margin:0 0 14px}.tpfTplSearch{width:100%;padding:11px 13px;border:1px solid #d0d5dd;border-radius:10px;background:#fff;font-size:14px}
  .tpfTplNoResults{padding:18px 4px;color:#667085;font-size:13px}
  `;document.head.appendChild(s);
}
function ensurePage(){
  let v=document.getElementById('view-wa-templates-library');
  if(v)return v;
  const main=document.querySelector('.referenceWorkspace main');if(!main)return null;
  v=document.createElement('section');v.id='view-wa-templates-library';v.className='hidden';v.innerHTML=`<div class="tpfTplPageHead"><div><h2>Plantillas de WhatsApp</h2><p>Busca, crea, edita y reutiliza tus plantillas desde un único módulo.</p></div><button id="tpfTplPageBack" class="secondary">← Volver</button></div><div id="tpfTplPageMount"></div>`;
  main.appendChild(v);
  document.getElementById('tpfTplPageBack').onclick=closeLibrary;
  return v;
}
function templateCard(){return document.querySelector('#waTemplateModal .waTemplateCard')||document.querySelector('#tpfTplPageMount .waTemplateCard')}
function ensureSearch(card){
  if(!card)return;
  let wrap=card.querySelector('.tpfTplSearchWrap');
  if(!wrap){
    wrap=document.createElement('div');wrap.className='tpfTplSearchWrap';wrap.innerHTML='<input class="tpfTplSearch" type="search" placeholder="Buscar plantilla por nombre o texto..." autocomplete="off">';
    const list=card.querySelector('#waTemplateList');if(list)list.parentNode.insertBefore(wrap,list);
    wrap.querySelector('input').addEventListener('input',filterTemplates);
  }
}
function filterTemplates(e){
  const input=e?.target||document.querySelector('.tpfTplSearch');
  const q=String(input?.value||'').trim().toLowerCase();
  const list=document.getElementById('waTemplateList');if(!list)return;
  let shown=0;
  [...list.children].forEach(row=>{
    const txt=String(row.textContent||'').toLowerCase();
    const ok=!q||txt.includes(q);row.style.display=ok?'':'none';if(ok)shown++;
  });
  let empty=list.parentNode.querySelector('.tpfTplNoResults');
  if(!empty){empty=document.createElement('div');empty.className='tpfTplNoResults';empty.textContent='No hay plantillas que coincidan con la búsqueda.';list.insertAdjacentElement('afterend',empty)}
  empty.style.display=q&&shown===0?'block':'none';
}
async function syncTemplates(){
  try{if(typeof window.waSyncTemplatesFromSupabase==='function')await window.waSyncTemplatesFromSupabase()}catch(e){console.warn('Plantillas WhatsApp',e)}
  try{if(typeof window.waRenderTemplates==='function')window.waRenderTemplates()}catch(e){console.warn('Plantillas WhatsApp render',e)}
}
function hideAppViews(){document.querySelectorAll('.referenceWorkspace main > section').forEach(s=>s.classList.add('hidden'))}
function restoreCardToModal(){
  const modal=document.getElementById('waTemplateModal'),card=templateCard();
  if(modal&&card&&card.parentElement!==modal)modal.appendChild(card);
  ensureSearch(card);
}
async function openLibrary(){
  ensureStyles();const page=ensurePage();if(!page)return;
  const current=visibleView();if(current!=='view-wa-templates-library')previousView=current;
  await syncTemplates();
  const card=templateCard(),mount=document.getElementById('tpfTplPageMount');if(card&&mount)mount.appendChild(card);
  ensureSearch(card);const input=card?.querySelector('.tpfTplSearch');if(input){input.value='';filterTemplates({target:input})}
  document.getElementById('waTemplateModal')?.classList.add('hidden');
  hideAppViews();page.classList.remove('hidden');
  document.querySelectorAll('.referenceNav .nav').forEach(n=>n.classList.remove('active'));
  document.getElementById('tpfWaTemplatesNav')?.classList.add('active');
}
function closeLibrary(){
  restoreCardToModal();
  document.getElementById('view-wa-templates-library')?.classList.add('hidden');
  const target=document.getElementById(previousView)||document.getElementById('view-dashboard');target?.classList.remove('hidden');
  document.querySelectorAll('.referenceNav .nav').forEach(n=>n.classList.toggle('active',n.dataset.view===String((target?.id||'').replace(/^view-/,''))));
}
function bind(){
  ensureStyles();ensurePage();restoreCardToModal();
  const nav=document.getElementById('tpfWaTemplatesNav');
  if(nav&&!nav.dataset.tpfLibraryBound){nav.dataset.tpfLibraryBound='1';nav.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();openLibrary()},{capture:true})}
  const chatBtn=document.getElementById('waTemplateBtn');
  if(chatBtn&&!chatBtn.dataset.tpfSearchBound){chatBtn.dataset.tpfSearchBound='1';chatBtn.addEventListener('click',()=>{restoreCardToModal();setTimeout(()=>{ensureSearch(templateCard());const i=templateCard()?.querySelector('.tpfTplSearch');if(i){i.value='';filterTemplates({target:i})}},0)},{capture:true})}
  const oldOpen=window.waOpenTemplates;
  if(typeof oldOpen==='function'&&!oldOpen.__tpfTemplateSearch){const wrapped=function(){restoreCardToModal();const r=oldOpen.apply(this,arguments);setTimeout(()=>ensureSearch(templateCard()),0);return r};wrapped.__tpfTemplateSearch=true;window.waOpenTemplates=wrapped}
}
M.register('whatsapp-templates-library',{install(){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();setTimeout(bind,300)}});
})();