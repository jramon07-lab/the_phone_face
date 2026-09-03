(function(){
'use strict';

const M=window.TPFModules;
if(!M)return;

const FAVOURITES_KEY='tpf_wa_tpl_favs_v3';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>\"]/g,char=>({
  '&':'&amp;',
  '<':'&lt;',
  '>':'&gt;',
  '\"':'&quot;'
}[char]));

let pickerState=null;
let escapeHandler=null;

function templates(){
  try{
    return typeof window.waLoadTemplates==='function'
      ? (window.waLoadTemplates()||[])
      : [];
  }catch(_){
    return [];
  }
}

function favouriteKeys(){
  try{
    return new Set(JSON.parse(localStorage.getItem(FAVOURITES_KEY)||'[]'));
  }catch(_){
    return new Set();
  }
}

function saveFavouriteKeys(keys){
  localStorage.setItem(FAVOURITES_KEY,JSON.stringify([...keys]));
}

function templateKey(template,index){
  return String(template?.id||template?.name||index);
}

function isFavourite(template,index,stored=favouriteKeys()){
  return Boolean(template?.favorite||template?.favourite||template?.pinned||stored.has(templateKey(template,index)));
}

function category(template){
  return String(template?.category||'').trim()||'Sin categoría';
}

function searchText(value){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
}

function digits(value){
  return String(value||'').replace(/\D/g,'');
}

function currentWhatsappContact(){
  let selected=null;
  try{
    if(typeof waLiveState!=='undefined')selected=waLiveState?.selected||null;
  }catch(_){}

  const fullName=String(
    selected?.name||
    $('waChatName')?.textContent||
    $('contactName')?.value||
    ''
  ).trim();
  const phone=digits(
    selected?.id||
    $('waQuickPhone')?.value||
    $('contactPhone')?.value||
    ''
  );

  return{
    name:fullName,
    fullName,
    firstName:fullName.split(/\s+/)[0]||'',
    phone,
    dni:String($('contactDni')?.value||'').trim()
  };
}

function normaliseContext(given){
  const fallback=currentWhatsappContact();
  const source=given&&typeof given==='object'?given:{};
  const fullName=String(
    source.fullName||source.name||fallback.fullName||fallback.name||''
  ).trim();

  return{
    name:fullName,
    fullName,
    firstName:String(source.firstName||'').trim()||fullName.split(/\s+/)[0]||'',
    phone:digits(source.phone||fallback.phone),
    dni:String(source.dni||fallback.dni||'').trim()
  };
}

function resolveVariables(text,givenContext){
  const context=normaliseContext(givenContext);
  let resolved=String(text||'')
    .replace(/\{\{contacto\.nombre_completo\}\}/gi,context.fullName)
    .replace(/\{\{contacto\.nombre\}\}/gi,context.firstName)
    .replace(/\{\{contacto\.telefono\}\}/gi,context.phone)
    .replace(/\{\{contacto\.(?:dni|dni \/ nif|nif)\}\}/gi,context.dni)
    .replace(/\{nombre_completo\}/gi,context.fullName)
    .replace(/\{nombre\}/gi,context.firstName)
    .replace(/\{telefono\}/gi,context.phone)
    .replace(/\{dni\}/gi,context.dni);

  if(!givenContext&&typeof window.tpfResolveWhatsAppTemplateVariables==='function'){
    try{resolved=window.tpfResolveWhatsAppTemplateVariables(resolved)}catch(_){}
  }
  return resolved;
}

window.tpfResolveWhatsAppTemplateForContext=resolveVariables;

function ensureStyles(){
  if($('tpfDirectPickerCss'))return;
  const style=document.createElement('style');
  style.id='tpfDirectPickerCss';
  style.textContent=`
    #tpfDirectPickerModal{position:fixed;inset:0;z-index:210000;background:#10182870;display:grid;place-items:center;padding:18px}
    .tpfDirectPickerCard{width:min(860px,94vw);max-height:92dvh;display:flex;flex-direction:column;background:#fff;border-radius:18px;box-shadow:0 24px 70px #0004;overflow:hidden}
    .tpfDirectPickerHead{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 22px 14px;border-bottom:1px solid #eaecf0}
    .tpfDirectPickerHead h2{margin:0;font-size:22px}.tpfDirectPickerHead p{margin:3px 0 0;color:#667085;font-size:13px}
    .tpfDirectClose{width:42px;height:42px;flex:0 0 auto;border:1px solid #d0d5dd;border-radius:10px;background:#fff;font-size:22px;cursor:pointer}
    #tpfDirectTools{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;padding:14px 22px 8px}
    #tpfDirectTools input,#tpfDirectTools button{height:44px;border:1px solid #d0d5dd;border-radius:10px;background:#fff;padding:0 13px;font:inherit}
    #tpfDirectTools button{font-weight:700;cursor:pointer}
    #tpfDirectCats{display:flex;gap:8px;overflow:auto;padding:2px 22px 11px;scrollbar-width:thin}
    .tpfDCat{border:1px solid #e1e5eb;background:#fff;border-radius:999px;padding:7px 11px;white-space:nowrap;font-weight:700;font-size:12px;cursor:pointer}
    .tpfDCat.on{background:#172033;color:#fff;border-color:#172033}
    #tpfDirectList{padding:8px 22px 22px;display:flex;flex-direction:column;gap:9px;overflow:auto}
    .tpfDRow{border:1px solid #e4e7ec;border-radius:12px;padding:14px 16px;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:13px;background:#fff}
    .tpfDFav{border:0;background:transparent;padding:4px;font-size:22px;line-height:1;color:#667085;cursor:pointer}.tpfDFav.on{color:#e3a008}
    .tpfDMain{min-width:0}.tpfDMain b{display:block;font-size:15px}.tpfDBadge{display:inline-flex;margin-top:5px;border-radius:999px;background:#f2f4f7;color:#475467;padding:4px 8px;font-size:11px;font-weight:700}
    .tpfDText{color:#667085;margin-top:7px;white-space:pre-wrap;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
    .tpfDUse{background:#172033;color:#fff;border:0;border-radius:9px;padding:9px 18px;font-weight:700;cursor:pointer}
    .tpfDEmpty{padding:32px;text-align:center;color:#667085;border:1px dashed #d0d5dd;border-radius:12px}
    @media(max-width:650px){
      #tpfDirectPickerModal{padding:10px}.tpfDirectPickerCard{width:calc(100vw - 20px);max-height:94dvh}
      .tpfDirectPickerHead{padding:15px 14px 12px}#tpfDirectTools{grid-template-columns:1fr;padding:12px 14px 7px}
      #tpfDirectCats{padding:2px 14px 9px}#tpfDirectList{padding:7px 14px 14px}.tpfDRow{grid-template-columns:auto minmax(0,1fr)}
      .tpfDUse{grid-column:1/-1;width:100%}
    }
  `;
  document.head.appendChild(style);
}

function closePicker(reason='close'){
  const state=pickerState;
  pickerState=null;
  $('tpfDirectPickerModal')?.remove();
  if(escapeHandler){
    document.removeEventListener('keydown',escapeHandler);
    escapeHandler=null;
  }
  if(reason!=='select'){
    try{state?.onClose?.(reason)}catch(_){}
  }
  if(reason==='close'||reason==='backdrop'||reason==='escape'){
    queueMicrotask(()=>state?.returnFocus?.focus?.());
  }
}

function toggleFavourite(index){
  const all=templates();
  const template=all[index];
  if(!template)return;
  const keys=favouriteKeys();
  const key=templateKey(template,index);
  keys.has(key)?keys.delete(key):keys.add(key);
  saveFavouriteKeys(keys);
  renderPicker();
}

function chooseTemplate(index){
  const state=pickerState;
  const template=templates()[index];
  if(!state||!template)return;
  const text=resolveVariables(template.text||'',state.context);
  closePicker('select');
  try{
    state.onSelect?.({template,index,text,context:state.context});
  }finally{
    queueMicrotask(()=>state.returnFocus?.focus?.());
  }
}

function renderPicker(){
  if(!pickerState)return;
  const all=templates();
  const favouriteSet=favouriteKeys();
  const categories=[...new Set(all.map(category))];
  const normalisedQuery=searchText(pickerState.query);
  const rows=all.map((template,index)=>({template,index})).filter(({template,index})=>{
    const text=searchText(`${template?.name||''} ${template?.text||''} ${category(template)}`);
    const inSearch=!normalisedQuery||text.includes(normalisedQuery);
    const inFilter=pickerState.filter==='all'||
      pickerState.filter===category(template)||
      (pickerState.filter==='fav'&&isFavourite(template,index,favouriteSet));
    return inSearch&&inFilter;
  });

  const cats=$('tpfDirectCats');
  const list=$('tpfDirectList');
  if(!cats||!list)return;

  cats.innerHTML=`
    <button class="tpfDCat ${pickerState.filter==='all'?'on':''}" data-filter="all">Todas</button>
    ${categories.map(item=>`<button class="tpfDCat ${pickerState.filter===item?'on':''}" data-filter="${esc(item)}">${esc(item)}</button>`).join('')}
    <button class="tpfDCat ${pickerState.filter==='fav'?'on':''}" data-filter="fav">★ Favoritas</button>
  `;
  cats.querySelectorAll('[data-filter]').forEach(button=>{
    button.onclick=()=>{
      pickerState.filter=button.dataset.filter;
      renderPicker();
    };
  });

  list.innerHTML=rows.map(({template,index})=>{
    const favourite=isFavourite(template,index,favouriteSet);
    return `<article class="tpfDRow">
      <button type="button" class="tpfDFav ${favourite?'on':''}" data-favourite="${index}" aria-label="${favourite?'Quitar de favoritas':'Añadir a favoritas'}">${favourite?'★':'☆'}</button>
      <div class="tpfDMain"><b>${esc(template?.name||'Plantilla')}</b><span class="tpfDBadge">${esc(category(template))}</span><div class="tpfDText">${esc(template?.text||'')}</div></div>
      <button type="button" class="tpfDUse" data-use="${index}">Usar</button>
    </article>`;
  }).join('')||'<div class="tpfDEmpty">No hay plantillas que coincidan con estos filtros.</div>';

  list.querySelectorAll('[data-favourite]').forEach(button=>{
    button.onclick=()=>toggleFavourite(Number(button.dataset.favourite));
  });
  list.querySelectorAll('[data-use]').forEach(button=>{
    button.onclick=()=>chooseTemplate(Number(button.dataset.use));
  });
}

async function syncTemplates(){
  try{
    if(typeof window.waSyncTemplatesFromSupabase==='function'){
      await window.waSyncTemplatesFromSupabase();
      if(pickerState)renderPicker();
    }
  }catch(error){
    console.warn('No se pudieron actualizar las plantillas de WhatsApp.',error);
  }
}

function manageTemplates(){
  const state=pickerState;
  closePicker('manage');
  if(typeof state?.onManage==='function'){
    state.onManage();
    return;
  }
  const nav=$('tpfWaTemplatesV3Nav')||[...document.querySelectorAll('.referenceNav .nav')]
    .find(item=>/plantillas whatsapp/i.test(item.textContent||''));
  nav?.click();
}

function openPicker(options={}){
  ensureStyles();
  closePicker('replace');
  pickerState={
    filter:'all',
    query:'',
    context:normaliseContext(options.context),
    onSelect:typeof options.onSelect==='function'?options.onSelect:null,
    onClose:typeof options.onClose==='function'?options.onClose:null,
    onManage:typeof options.onManage==='function'?options.onManage:null,
    returnFocus:options.returnFocus||null
  };

  const modal=document.createElement('div');
  modal.id='tpfDirectPickerModal';
  modal.innerHTML=`<div class="tpfDirectPickerCard" role="dialog" aria-modal="true" aria-labelledby="tpfDirectPickerTitle">
    <div class="tpfDirectPickerHead"><div><h2 id="tpfDirectPickerTitle">Elegir plantilla</h2><p>Busca, filtra y completa automáticamente los datos del contacto.</p></div><button type="button" class="tpfDirectClose" data-picker-close aria-label="Cerrar">×</button></div>
    <div id="tpfDirectTools"><input id="tpfDirectSearch" type="search" placeholder="Buscar por nombre, categoría o contenido…" autocomplete="off"><button id="tpfDirectManage" type="button">Gestionar plantillas</button></div>
    <div id="tpfDirectCats" aria-label="Categorías de plantillas"></div>
    <div id="tpfDirectList"></div>
  </div>`;
  document.body.appendChild(modal);

  $('tpfDirectSearch').oninput=event=>{
    if(!pickerState)return;
    pickerState.query=event.target.value.trim();
    renderPicker();
  };
  $('tpfDirectManage').onclick=manageTemplates;
  modal.querySelector('[data-picker-close]').onclick=()=>closePicker('close');
  modal.onclick=event=>{
    if(event.target===modal)closePicker('backdrop');
  };
  escapeHandler=event=>{
    if(event.key==='Escape')closePicker('escape');
  };
  document.addEventListener('keydown',escapeHandler);

  renderPicker();
  $('tpfDirectSearch').focus();
  void syncTemplates();
  return modal;
}

window.openWhatsAppTemplatePicker=openPicker;
window.closeWhatsAppTemplatePicker=closePicker;

function install(){
  ensureStyles();
  const button=$('waTemplateBtn');
  if(!button||button.dataset.tpfDirectPicker==='1')return;
  button.dataset.tpfDirectPicker='1';
  button.addEventListener('click',event=>{
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const composer=$('waComposerText');
    openPicker({
      context:currentWhatsappContact(),
      returnFocus:composer,
      onSelect:({text})=>{
        if(!composer)return;
        composer.value=text;
        composer.dispatchEvent(new Event('input',{bubbles:true}));
      }
    });
  },true);
}

M.register('whatsapp-template-picker-direct',{
  install(){
    if(document.readyState==='loading'){
      document.addEventListener('DOMContentLoaded',()=>setTimeout(install,1200),{once:true});
    }else{
      setTimeout(install,1200);
    }
  }
});
})();
