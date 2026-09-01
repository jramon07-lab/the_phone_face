(function(){
'use strict';
const M=window.TPFModules;if(!M)return;
const $=id=>document.getElementById(id);
function field(data,names){const d=data&&typeof data==='object'?data:{};for(const wanted of names){const k=Object.keys(d).find(x=>String(x).trim().toLowerCase()===String(wanted).trim().toLowerCase());if(k!=null&&String(d[k]??'').trim())return String(d[k]??'').trim()}return''}
function context(){let rec=null,selected=null;try{if(typeof waLiveState!=='undefined'){rec=waLiveState?.contact||null;selected=waLiveState?.selected||null}}catch(_){}const d=rec?.data||{};const completo=field(d,['NOMBRE Y APELLIDOS','CLIENTE','CLIENTE FINAL'])||String(selected?.name||'').trim();const nombre=field(d,['NOMBRE'])||String(completo||'').trim().split(/\s+/)[0]||'';const dni=field(d,['DNI / NIF','DNI','NIF','CIF','DOCUMENTO','DOCUMENTO IDENTIDAD']);const telefono=field(d,['TELÉFONO','TELEFONO','TEL','MÓVIL','MOVIL','PHONE'])||String(selected?.id||'').replace(/@.*$/,'').replace(/\D/g,'');return{nombre,completo,dni,telefono}}
function resolve(text){const c=context();return String(text||'')
 .replace(/\{\{contacto\.nombre_completo\}\}/gi,c.completo)
 .replace(/\{\{contacto\.nombre\}\}/gi,c.nombre)
 .replace(/\{\{contacto\.telefono\}\}/gi,c.telefono)
 .replace(/\{\{contacto\.(?:dni|dni \/ nif|nif)\}\}/gi,c.dni)
 .replace(/\{nombre_completo\}/gi,c.completo)
 .replace(/\{nombre\}/gi,c.nombre)
 .replace(/\{dni\}/gi,c.dni)
 .replace(/\{telefono\}/gi,c.telefono)}
function wrap(){if(typeof window.waUseTemplate!=='function'||window.__tpfFirstNameTemplateWrapped)return;const base=window.waUseTemplate;window.waUseTemplate=function(i){base(i);try{const list=typeof window.waLoadTemplates==='function'?(window.waLoadTemplates()||[]):[];const t=list[i],c=$('waComposerText');if(t&&c)c.value=resolve(t.text||'')}catch(_){}};window.__tpfFirstNameTemplateWrapped=true;window.tpfResolveWhatsAppTemplateVariables=resolve}
function decorate(){const view=$('view-wa-templates-v3');if(!view||view.classList.contains('hidden'))return;const vars=view.querySelector('.tv3Vars');if(vars){const first=vars.querySelector('[data-tv3-var="{nombre}"]');if(first)first.textContent='Nombre';if(!vars.querySelector('[data-tv3-var="{nombre_completo}"]')){const b=document.createElement('button');b.type='button';b.className='tv3Var';b.dataset.tv3Var='{nombre_completo}';b.textContent='Nombre y apellidos';b.onclick=()=>{const t=$('tv3Text');if(!t)return;const a=Number.isFinite(t.selectionStart)?t.selectionStart:t.value.length,z=Number.isFinite(t.selectionEnd)?t.selectionEnd:a;t.setRangeText('{nombre_completo}',a,z,'end');t.focus()};if(first)first.insertAdjacentElement('afterend',b);else vars.prepend(b)}const hint=view.querySelector('.tv3VarHint');if(hint)hint.textContent='“Nombre” usa solo el nombre. “Nombre y apellidos” inserta el nombre completo.'}}
function interceptLibraryUse(e){const b=e.target.closest?.('#view-wa-templates-v3 [data-use]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();const i=Number(b.dataset.use);const list=typeof window.waLoadTemplates==='function'?(window.waLoadTemplates()||[]):[],t=list[i];if(!t)return;const c=$('waComposerText');if(c)c.value=resolve(t.text||'');[...document.querySelectorAll('.nav')].find(x=>x.dataset.view==='whatsapplive')?.click();setTimeout(()=>$('waComposerText')?.focus(),100)}
function install(){wrap();document.addEventListener('click',interceptLibraryUse,true);setInterval(()=>{wrap();decorate()},700)}
M.register('whatsapp-template-first-name',{install});
})();