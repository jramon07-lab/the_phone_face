(function(){
'use strict';
const M=window.TPFModules;if(!M)return;

function el(id){return document.getElementById(id)}
function escHtml(s){return typeof window.esc==='function'?window.esc(s):String(s??'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[m]))}
function templates(){try{return typeof window.waLoadTemplates==='function'?(window.waLoadTemplates()||[]):[]}catch(_){return []}}
function saveTemplates(list){if(typeof window.waSaveTemplates==='function')window.waSaveTemplates(list)}

function ensureStyles(){
 if(el('tpfWhatsappTemplatesStyles'))return;
 const s=document.createElement('style');
 s.id='tpfWhatsappTemplatesStyles';
 s.textContent=`
 #view-wa-templates{padding:0 0 28px}
 .tpfTplPageHead{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin:0 0 18px}
 .tpfTplPageHead h2{margin:0 0 4px;font-size:28px}.tpfTplPageHead p{margin:0;color:#667085}
 .tpfTplGrid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(300px,.8fr);gap:18px;align-items:start}
 .tpfTplCard{background:#fff;border:1px solid #e6e9ef;border-radius:16px;padding:18px;box-shadow:0 6px 24px rgba(16,24,40,.04)}
 .tpfTplSearch{width:100%;margin:0 0 14px;padding:12px 14px;border:1px solid #d0d5dd;border-radius:10px;font-size:14px}
 .tpfTplList{display:flex;flex-direction:column;gap:10px}.tpfTplEmpty{padding:20px 8px;color:#667085;text-align:center}
 .tpfTplRow{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;border:1px solid #eaecf0;border-radius:12px;padding:14px}
 .tpfTplRowMain{min-width:0;flex:1}.tpfTplRowMain b{display:block;margin-bottom:4px}.tpfTplRowMain div{color:#475467;white-space:pre-wrap;word-break:break-word}
 .tpfTplActions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.tpfTplActions button{white-space:nowrap}
 .tpfTplNew label{display:block;font-size:12px;font-weight:700;margin:12px 0 6px}.tpfTplNew input,.tpfTplNew textarea{width:100%}
 #waTemplateSearch{width:100%;margin:0 0 12px;padding:10px 12px;border:1px solid #d0d5dd;border-radius:9px}
 @media(max-width:900px){.tpfTplGrid{grid-template-columns:1fr}.tpfTplRow{flex-direction:column}.tpfTplActions{justify-content:flex-start}}
 `;
 document.head.appendChild(s);
}

function filterModalList(){
 const q=String(el('waTemplateSearch')?.value||'').trim().toLowerCase();
 document.querySelectorAll('#waTemplateList .waTemplateItem').forEach(row=>{
   row.style.display=!q||String(row.textContent||'').toLowerCase().includes(q)?'':'none';
 });
}

function ensureModalSearch(){
 const list=el('waTemplateList');if(!list||el('waTemplateSearch'))return;
 const input=document.createElement('input');
 input.id='waTemplateSearch';input.type='search';input.placeholder='🔎 Buscar plantilla por nombre o texto…';
 input.addEventListener('input',filterModalList);
 list.parentNode.insertBefore(input,list);
}

function renderStandalone(){
 const box=el('tpfWaTemplatesList');if(!box)return;
 const q=String(el('tpfWaTemplatesSearch')?.value||'').trim().toLowerCase();
 const list=templates();
 const visible=list.map((t,i)=>({t,i})).filter(({t})=>!q||(`${t?.name||''} ${t?.text||''}`).toLowerCase().includes(q));
 box.innerHTML=visible.map(({t,i})=>`<div class="tpfTplRow"><div class="tpfTplRowMain"><b>${escHtml(t?.name||'Plantilla')}</b><div>${escHtml(t?.text||'')}</div></div><div class="tpfTplActions"><button class="secondary" data-tpl-use="${i}">Usar</button><button class="secondary" data-tpl-edit="${i}">Editar</button><button class="secondary" data-tpl-delete="${i}" style="color:#b42318">Eliminar</button></div></div>`).join('')||'<div class="tpfTplEmpty">No hay plantillas que coincidan.</div>';
 box.querySelectorAll('[data-tpl-use]').forEach(b=>b.onclick=()=>useTemplate(Number(b.dataset.tplUse)));
 box.querySelectorAll('[data-tpl-edit]').forEach(b=>b.onclick=()=>editTemplate(Number(b.dataset.tplEdit)));
 box.querySelectorAll('[data-tpl-delete]').forEach(b=>b.onclick=()=>deleteTemplate(Number(b.dataset.tplDelete)));
}

function syncAll(){
 try{window.waRenderTemplates?.()}catch(_){}
 renderStandalone();
 setTimeout(filterModalList,0);
}

function useTemplate(i){
 const t=templates()[i];if(!t)return;
 const composer=el('waComposerText');if(composer)composer.value=t.text||'';
 const nav=[...document.querySelectorAll('.nav')].find(n=>n.dataset.view==='whatsapplive');
 if(nav)nav.click();
 setTimeout(()=>{const c=el('waComposerText');c?.focus();},120);
}
function editTemplate(i){
 const list=templates(),t=list[i];if(!t)return;
 const name=prompt('Nombre de la plantilla',t.name||'');if(name===null)return;
 const text=prompt('Texto del mensaje',t.text||'');if(text===null)return;
 list[i]={...t,name:name.trim()||'Plantilla',text};saveTemplates(list);syncAll();
}
function deleteTemplate(i){
 const list=templates(),t=list[i];if(!t)return;
 if(!confirm(`¿Eliminar la plantilla "${t.name||'Plantilla'}"?`))return;
 list.splice(i,1);saveTemplates(list);syncAll();
}
function createTemplate(){
 const name=String(el('tpfWaTemplateName')?.value||'').trim();
 const text=String(el('tpfWaTemplateText')?.value||'').trim();
 if(!name||!text){el('tpfWaTemplateMsg').textContent='Escribe nombre y mensaje.';return}
 const list=templates();list.push({name,text});saveTemplates(list);
 el('tpfWaTemplateName').value='';el('tpfWaTemplateText').value='';el('tpfWaTemplateMsg').textContent='Plantilla guardada.';syncAll();
}

function showStandalone(){
 document.querySelectorAll('.referenceWorkspace main > section').forEach(s=>s.classList.add('hidden'));
 el('view-wa-templates')?.classList.remove('hidden');
 document.querySelectorAll('.referenceNav .nav').forEach(n=>n.classList.remove('active'));
 const nav=document.querySelector('[data-view="wa-templates"]');nav?.classList.add('active');
 el('waTemplateModal')?.classList.add('hidden');
 renderStandalone();
}

function ensureStandalone(){
 if(el('view-wa-templates'))return;
 const main=document.querySelector('.referenceWorkspace main');if(!main)return;
 const section=document.createElement('section');section.id='view-wa-templates';section.className='hidden';
 section.innerHTML=`
 <div class="tpfTplPageHead"><div><h2>Plantillas WhatsApp</h2><p>Gestiona y busca tus respuestas rápidas desde una pantalla propia.</p></div></div>
 <div class="tpfTplGrid">
   <div class="tpfTplCard"><input id="tpfWaTemplatesSearch" class="tpfTplSearch" type="search" placeholder="🔎 Buscar plantilla por nombre o texto…"><div id="tpfWaTemplatesList" class="tpfTplList"></div></div>
   <div class="tpfTplCard tpfTplNew"><h3 style="margin-top:0">Nueva plantilla</h3><label>Nombre</label><input id="tpfWaTemplateName" placeholder="Nombre de la plantilla"><label>Texto del mensaje</label><textarea id="tpfWaTemplateText" rows="7" placeholder="Texto del mensaje"></textarea><div style="margin-top:12px"><button id="tpfWaTemplateSave" class="primary">Guardar plantilla</button></div><div id="tpfWaTemplateMsg" class="small" style="margin-top:8px"></div></div>
 </div>`;
 main.appendChild(section);
 el('tpfWaTemplatesSearch').addEventListener('input',renderStandalone);
 el('tpfWaTemplateSave').onclick=createTemplate;
}

function ensureNav(){
 const navRoot=document.querySelector('.referenceNav');if(!navRoot)return;
 let nav=[...navRoot.querySelectorAll('.nav')].find(n=>String(n.textContent||'').trim().toLowerCase().includes('plantillas whatsapp'));
 if(!nav){
   nav=document.createElement('div');nav.className='nav secondaryNav';nav.innerHTML='<b>▤</b><span>Plantillas WhatsApp</span>';
   const before=[...navRoot.querySelectorAll('.nav')].find(n=>n.dataset.view==='whatsapp');
   navRoot.insertBefore(nav,before||null);
 }
 nav.dataset.view='wa-templates';
 nav.onclick=e=>{e.preventDefault();e.stopPropagation();showStandalone()};
}

function enhanceModalRenderer(){
 ensureModalSearch();
 const base=window.waRenderTemplates;
 if(typeof base==='function'&&!base.__tpfSearchEnhanced){
   const enhanced=function(){const r=base.apply(this,arguments);ensureModalSearch();filterModalList();renderStandalone();return r};
   enhanced.__tpfSearchEnhanced=true;window.waRenderTemplates=enhanced;
 }
 const btn=el('waTemplateBtn');
 if(btn&&!btn.dataset.tpfTplSearchBound){
   btn.dataset.tpfTplSearchBound='1';
   btn.addEventListener('click',()=>setTimeout(()=>{ensureModalSearch();filterModalList()},0));
 }
}

M.register('whatsapp-templates',{install(){
 ensureStyles();ensureStandalone();ensureNav();enhanceModalRenderer();renderStandalone();
}});
})();
