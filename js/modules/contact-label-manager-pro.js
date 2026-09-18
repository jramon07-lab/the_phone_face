(function(){
'use strict';
const M=window.TPFModules;if(!M)return;
const $=id=>document.getElementById(id);
const SETTINGS_KEY='crm_label_categories_v1';
const state={contactId:'',contactName:'',labels:[],selected:new Set(),categories:{},query:'',category:'Todas',opening:false};
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const contact=()=>{try{return currentContact||null}catch(_){return null}};
function contactName(row){const data=row?.data||{};return String(data['NOMBRE Y APELLIDOS']||[data.NOMBRE,data.APELLIDOS].filter(Boolean).join(' ')||data.CLIENTE||data.NOMBRE||'este contacto').trim();}
function inferred(name){const n=norm(name);if(n.includes('vodafone'))return'Vodafone';if(n.includes('orange'))return'Orange';if(n.includes('masmovil'))return'MásMóvil';if(n.includes('yoigo'))return'Yoigo';return'Otras';}
function categoryFor(label){return state.categories[String(label.id)]||inferred(label.name);}
function ensureStyle(){
 if($('tpfContactLabelsProStyle'))return;
 const style=document.createElement('style');style.id='tpfContactLabelsProStyle';style.textContent=`
 #tpfContactLabelsPro{position:fixed;inset:0;z-index:100250;background:rgba(16,24,40,.58);display:grid;place-items:center;padding:18px}
 #tpfContactLabelsPro.hidden{display:none!important}
 #tpfContactLabelsPro .tlpCard{width:min(820px,100%);max-height:min(780px,94dvh);overflow:auto;background:#f8fafc;border-radius:18px;box-shadow:0 28px 85px #0005}
 #tpfContactLabelsPro .tlpHead{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:20px 22px 16px;background:#fff;border-bottom:1px solid #e5eaf0}
 #tpfContactLabelsPro h3{margin:0;color:#182230;font-size:22px}#tpfContactLabelsPro p{margin:5px 0 0;color:#667085;font-size:12px}
 #tpfContactLabelsPro .tlpClose{border:1px solid #d7dee8;border-radius:9px;background:#fff;color:#334155;padding:8px 10px;font-weight:700}
 #tpfContactLabelsPro .tlpBody{padding:18px 22px}
 #tpfContactLabelsPro .tlpToolbar{display:grid;grid-template-columns:minmax(0,1fr) 180px;gap:10px;margin-bottom:12px}
 #tpfContactLabelsPro .tlpToolbar input,#tpfContactLabelsPro .tlpToolbar select,#tpfContactLabelsPro .tlpNew input,#tpfContactLabelsPro .tlpNew input{width:100%;box-sizing:border-box;height:41px;margin:0}
 #tpfContactLabelsPro .tlpCats{display:flex;flex-wrap:wrap;gap:7px;margin:0 0 14px}
 #tpfContactLabelsPro .tlpCats button{border:1px solid #d8e1ed;border-radius:999px;background:#fff;color:#43536a;padding:7px 10px;font-size:12px;font-weight:750}
 #tpfContactLabelsPro .tlpCats button.on{border-color:#175cd3;background:#175cd3;color:#fff}
 #tpfContactLabelsPro .tlpGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
 #tpfContactLabelsPro .tlpTag{display:flex;align-items:center;gap:10px;border:1px solid #dce4ee;background:#fff;border-radius:11px;padding:11px;text-align:left;cursor:pointer;min-height:45px}
 #tpfContactLabelsPro .tlpTag::before{content:'';width:10px;height:10px;flex:0 0 10px;border-radius:50%;background:#7c92b4}
 #tpfContactLabelsPro .tlpTag[data-cat="Vodafone"]::before{background:#e53b54}#tpfContactLabelsPro .tlpTag[data-cat="Yoigo"]::before{background:#6c3bd1}#tpfContactLabelsPro .tlpTag[data-cat="MásMóvil"]::before{background:#ff9f1c}#tpfContactLabelsPro .tlpTag[data-cat="Orange"]::before{background:#ff7100}
 #tpfContactLabelsPro .tlpTag[aria-pressed="true"]{border-color:#175cd3;background:#eff6ff;box-shadow:inset 0 0 0 1px #175cd3}
 #tpfContactLabelsPro .tlpTag b{min-width:0;overflow-wrap:anywhere;font-size:13px;color:#27364b}#tpfContactLabelsPro .tlpTag small{margin-left:auto;color:#175cd3;font-size:16px;font-weight:850}
 #tpfContactLabelsPro .tlpNew{display:grid;grid-template-columns:minmax(0,1fr) 170px auto;gap:9px;align-items:center;margin:16px 0 0;padding:13px;border:1px dashed #b7c5d8;border-radius:12px;background:#fff}
 #tpfContactLabelsPro .tlpNew button,#tpfContactLabelsPro .tlpSave{border:0;border-radius:9px;background:#175cd3;color:#fff;padding:10px 13px;font-weight:800;white-space:nowrap}
 #tpfContactLabelsPro .tlpFoot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 22px;background:#fff;border-top:1px solid #e5eaf0}
 #tpfContactLabelsPro .tlpCount{font-size:12px;color:#667085}#tpfContactLabelsPro .tlpEmpty{grid-column:1/-1;border:1px dashed #c9d4e2;border-radius:10px;padding:26px;text-align:center;color:#667085}
 @media(max-width:640px){#tpfContactLabelsPro{padding:8px}#tpfContactLabelsPro .tlpBody,#tpfContactLabelsPro .tlpHead,#tpfContactLabelsPro .tlpFoot{padding-left:14px;padding-right:14px}#tpfContactLabelsPro .tlpToolbar,#tpfContactLabelsPro .tlpNew{grid-template-columns:1fr}#tpfContactLabelsPro .tlpGrid{grid-template-columns:1fr}}
 `;document.head.appendChild(style);
}
function ensure(){
 ensureStyle();let root=$('tpfContactLabelsPro');if(root)return root;
 root=document.createElement('div');root.id='tpfContactLabelsPro';root.className='hidden';
 root.innerHTML='<section class="tlpCard" role="dialog" aria-modal="true" aria-labelledby="tlpTitle"><header class="tlpHead"><div><h3 id="tlpTitle">Etiquetas del contacto</h3><p id="tlpSub">Selecciona las etiquetas que quieres aplicar.</p></div><button class="tlpClose" type="button">← Volver</button></header><div class="tlpBody"><div class="tlpToolbar"><input id="tlpSearch" type="search" placeholder="Buscar etiqueta…" aria-label="Buscar etiqueta"><select id="tlpCategory" aria-label="Filtrar categoría"></select></div><div id="tlpCats" class="tlpCats"></div><div id="tlpGrid" class="tlpGrid"></div><div class="tlpNew"><input id="tlpNewName" placeholder="Crear nueva etiqueta"><input id="tlpNewCategory" list="tlpCategoryOptions" placeholder="Categoría"><datalist id="tlpCategoryOptions"></datalist><button id="tlpNewSave" type="button">Crear</button></div></div><footer class="tlpFoot"><span id="tlpCount" class="tlpCount"></span><div><button id="tlpCancel" type="button" class="tlpClose">Cancelar</button> <button id="tlpSave" type="button" class="tlpSave">Guardar etiquetas</button></div></footer></section>';
 document.body.appendChild(root);
 const close=()=>root.classList.add('hidden');
 root.querySelector('.tlpClose').onclick=close;$('tlpCancel').onclick=close;
 root.addEventListener('click',e=>{if(e.target===root)close();});
 $('tlpSearch').oninput=e=>{state.query=e.target.value;render();};
 $('tlpCategory').onchange=e=>{state.category=e.target.value;render();};
 $('tlpNewSave').onclick=create;$('tlpSave').onclick=save;
 return root;
}
function categories(){return [...new Set(state.labels.map(categoryFor))].sort((a,b)=>a.localeCompare(b,'es'));}
function render(){
 const root=ensure(),cats=categories(),q=norm(state.query);if(state.category!=='Todas'&&!cats.includes(state.category))state.category='Todas';
 $('tlpSub').textContent=state.contactId?('Etiquetas para '+(state.contactName||$('contactName')?.value||'este contacto')):'Selecciona las etiquetas.';
 $('tlpCategory').innerHTML='<option value="Todas">Todas las categorías</option>'+cats.map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join('');$('tlpCategory').value=state.category;
 $('tlpCats').innerHTML=['Todas',...cats].map(c=>'<button type="button" class="'+(state.category===c?'on':'')+'" data-tlp-cat="'+esc(c)+'">'+esc(c)+'</button>').join('');
 $('tlpCats').querySelectorAll('[data-tlp-cat]').forEach(button=>button.onclick=()=>{state.category=button.dataset.tlpCat;render();});
 const rows=state.labels.filter(label=>(!q||norm(label.name).includes(q))&&(state.category==='Todas'||categoryFor(label)===state.category));
 $('tlpGrid').innerHTML=rows.map(label=>{const id=String(label.id),selected=state.selected.has(id);return '<button type="button" class="tlpTag" data-tlp-id="'+esc(id)+'" data-cat="'+esc(categoryFor(label))+'" aria-pressed="'+selected+'"><b>'+esc(label.name)+'</b><small>'+ (selected?'✓':'＋')+'</small></button>';}).join('')||'<div class="tlpEmpty">No hay etiquetas que coincidan con el filtro.</div>';
 $('tlpGrid').querySelectorAll('[data-tlp-id]').forEach(button=>button.onclick=()=>{const id=button.dataset.tlpId;state.selected.has(id)?state.selected.delete(id):state.selected.add(id);render();});
 $('tlpCount').textContent=state.selected.size+' etiqueta'+(state.selected.size===1?'':'s')+' seleccionada'+(state.selected.size===1?'':'s');
 $('tlpNewCategory').value=$('tlpNewCategory').value||((state.category!=='Todas'&&state.category)||'');
 $('tlpCategoryOptions').innerHTML=['Vodafone','Orange','MásMóvil','Yoigo','Otras',...cats].filter((x,i,a)=>a.indexOf(x)===i).map(c=>'<option value="'+esc(c)+'"></option>').join('');
}
async function load(rowOverride){
 const row=rowOverride||contact();if(!row?.id)throw new Error('Abre primero una ficha de contacto.');
 state.contactId=String(row.id);state.contactName=contactName(row);state.query='';state.category='Todas';
 const [labels,assigned,settings]=await Promise.all([
  sb.rpc('crm_list_labels'),sb.rpc('crm_get_contact_labels',{p_contact_id:row.id}),sb.from('app_settings').select('value').eq('key',SETTINGS_KEY).maybeSingle()
 ]);
 if(labels.error)throw labels.error;if(assigned.error)throw assigned.error;
 state.labels=Array.isArray(labels.data)?labels.data:[];state.selected=new Set((assigned.data||[]).map(x=>String(x.id)));state.categories=(settings.data?.value&&typeof settings.data.value==='object'&&!Array.isArray(settings.data.value))?settings.data.value:{};
}
async function open(rowOverride){
 if(state.opening)return;state.opening=true;
 try{await load(rowOverride);const root=ensure();$('contactLabelsModal')?.classList.add('hidden');render();root.classList.remove('hidden');setTimeout(()=>$('tlpSearch')?.focus(),0);}catch(error){alert(error?.message||'No se pudieron cargar las etiquetas.');}finally{state.opening=false;}
}
async function openForContact(id){
 const contactId=String(id||'').trim();if(!contactId)throw new Error('No se ha encontrado el contacto.');
 const result=await sb.from('records').select('id,data').eq('id',contactId).maybeSingle();if(result.error)throw result.error;if(!result.data)throw new Error('El contacto ya no existe.');
 return open(result.data);
}
async function create(){
 const name=$('tlpNewName').value.trim(),category=$('tlpNewCategory').value.trim()||'Otras';if(!name)return $('tlpNewName').focus();
 const button=$('tlpNewSave');button.disabled=true;
 try{
  const r=await sb.rpc('crm_create_label',{p_name:name});if(r.error)throw r.error;
  const list=await sb.rpc('crm_list_labels');if(list.error)throw list.error;
  const created=(list.data||[]).find(x=>norm(x.name)===norm(name));if(created){state.categories[String(created.id)]=category;const saveSettings=await sb.from('app_settings').upsert({key:SETTINGS_KEY,value:state.categories},{onConflict:'key'});if(saveSettings.error)throw saveSettings.error;state.selected.add(String(created.id));}
  state.labels=Array.isArray(list.data)?list.data:[];$('tlpNewName').value='';render();
 }catch(error){alert(error?.message||'No se pudo crear la etiqueta.');}finally{button.disabled=false;}
}
async function save(){
 if(!state.contactId)return alert('No se ha encontrado el contacto.');
 const button=$('tlpSave');button.disabled=true;
 try{
  const r=await sb.rpc('crm_set_contact_labels',{p_contact_id:state.contactId,p_label_ids:[...state.selected]});if(r.error)throw r.error;
  if(String(contact()?.id||'')===state.contactId)await window.crmRefreshCurrentContactLabels?.();try{window.renderWhatsAppChats?.();}catch(_){}
  window.dispatchEvent(new CustomEvent('tpf:contact-labels-saved',{detail:{id:state.contactId,labelIds:[...state.selected]}}));
  ensure().classList.add('hidden');
 }catch(error){alert(error?.message||'No se pudieron guardar las etiquetas.');}finally{button.disabled=false;}
}
function bind(){
 ensure();
 window.TPFContactLabelManager={open,openFor:openForContact};
 document.addEventListener('click',event=>{
  const trigger=event.target?.closest?.('#contactManageLabels,#waAddTagSide,#waTagChat');
  if(!trigger)return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();open();
 },true);
}
M.register('contact-label-manager-pro',{install(){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();}});
})();
