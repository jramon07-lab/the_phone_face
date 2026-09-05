(function(){
'use strict';
const $=id=>document.getElementById(id);
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
let categories={};
function inferred(name){const n=norm(name);if(n.includes('vodafone'))return 'Vodafone';if(n.includes('orange'))return 'Orange';if(n.includes('masmovil'))return 'MásMóvil';if(n.includes('yoigo'))return 'Yoigo';return 'Otras';}
function install(rows=[]){
 const box=$('tpfCreateLabels');if(!box)return;
 let root=$('tpfCompactLabels');
 if(!root){
  const old=box.parentElement;root=document.createElement('div');root.id='tpfCompactLabels';root.className='full';
  root.innerHTML='<div class="tpfPickHead"><b>Etiquetas</b><span id="tpfPickedCount"></span></div><div id="tpfPickedLabels"></div><button type="button" id="tpfPickToggle" aria-expanded="false">＋ Añadir etiquetas</button><div id="tpfPickPanel" hidden><div class="tpfPickFilters"><input type="search" id="tpfPickSearch" placeholder="Buscar etiqueta…" aria-label="Buscar etiqueta"><select id="tpfPickCategory" aria-label="Categoría"></select></div><div id="tpfPickEmpty" hidden>No hay coincidencias.</div><button type="button" id="tpfPickDone">Listo</button></div>';
  old.replaceWith(root);$('tpfPickPanel').insertBefore(box,$('tpfPickEmpty'));
  $('tpfPickToggle').onclick=()=>{const open=$('tpfPickPanel').hidden;$('tpfPickPanel').hidden=!open;$('tpfPickToggle').setAttribute('aria-expanded',String(open));$('tpfPickToggle').textContent=open?'Cerrar selector':'＋ Añadir etiquetas';if(open)$('tpfPickSearch').focus();};
  $('tpfPickDone').onclick=()=>{if(!$('tpfPickPanel').hidden)$('tpfPickToggle').click();};
  $('tpfPickSearch').oninput=filter;$('tpfPickCategory').onchange=filter;
  box.addEventListener('change',sync);
  const style=document.createElement('style');style.textContent=`
  #tpfCompactLabels{font-size:13px;color:#172033;text-transform:none}
  .tpfPickHead{display:flex;gap:12px;align-items:center;margin-bottom:10px}.tpfPickHead span{color:#64748b;font-size:12px}
  #tpfPickedLabels{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:10px}
  #tpfPickedLabels button{display:flex;gap:8px;align-items:center;border:0;padding:5px 8px;border-radius:8px;background:#eef2ff;color:#243b73;max-width:100%;font-size:12px}
  #tpfPickedLabels .tpfLabelChip{white-space:normal}
  #tpfPickToggle,#tpfPickDone{border:1px solid #1766df;border-radius:8px;color:#1260ce;background:white;padding:9px 13px}
  #tpfPickPanel{margin-top:10px;padding:12px;border:1px solid #cad8ef;border-radius:10px;background:#fbfcff}
  #tpfCompactLabels [hidden]{display:none!important}
  .tpfPickFilters{display:grid;grid-template-columns:1fr 190px;gap:8px}
  #tpfCompactLabels .tpfPickFilters input,#tpfCompactLabels select{width:100%;min-width:0;margin:0;font-size:13px}
  #tpfCompactLabels #tpfCreateLabels{display:block;max-height:220px;overflow-y:auto;margin:10px 0}
  #tpfCompactLabels .tpfContactsLabelChoice{display:flex!important;border:0;border-radius:6px;background:white;margin:3px 0;padding:8px;cursor:pointer}
  #tpfCompactLabels .tpfContactsLabelChoice[hidden]{display:none!important}
  #tpfCompactLabels input[type=checkbox]{width:16px!important;height:16px;accent-color:#1766df;flex:0 0 auto}
  #tpfPickDone{display:block;margin-left:auto;background:#1267ed;color:white}
  @media(max-width:600px){.tpfPickFilters{grid-template-columns:1fr}}
  `;document.head.appendChild(style);
 }
 root._rows=rows;
 refreshCategories();sync();
 try{if(typeof sb!=='undefined')sb.from('app_settings').select('value').eq('key','crm_label_categories_v1').maybeSingle().then(r=>{if(r.data?.value){categories=r.data.value;refreshCategories();}}).catch(()=>{});}catch(_){}
}
function refreshCategories(){const root=$('tpfCompactLabels');if(!root)return;const rows=root._rows||[];const select=$('tpfPickCategory'),value=select.value;select.replaceChildren(new Option('Todas las categorías',''));const cats=[...new Set(rows.map(r=>categories[String(r.id||r.label_id)]||inferred(r.name||r.label_name)))].sort();cats.forEach(c=>select.add(new Option(c,c)));select.value=cats.includes(value)?value:'';filter();}
function filter(){const root=$('tpfCompactLabels');if(!root)return;const q=norm($('tpfPickSearch').value),cat=$('tpfPickCategory').value;let count=0;
 $('tpfCreateLabels').querySelectorAll('label').forEach(l=>{const input=l.querySelector('input');const r=(root._rows||[]).find(r=>String(r.id||r.label_id)===input?.value);const c=categories[input?.value]||inferred(r?.name||r?.label_name||l.textContent);l.hidden=!!((q&&!norm(l.textContent).includes(q))||(cat&&cat!==c));if(!l.hidden)count++;});$('tpfPickEmpty').hidden=count!==0;
}
function sync(){const out=$('tpfPickedLabels'),box=$('tpfCreateLabels');if(!out||!box)return;out.replaceChildren();const inputs=[...box.querySelectorAll('input:checked')];$('tpfPickedCount').textContent=inputs.length+' seleccionadas';
 inputs.forEach(input=>{const button=document.createElement('button');button.type='button';const chip=input.parentElement.querySelector('span');if(chip)button.appendChild(chip.cloneNode(true));else button.append(input.parentElement.textContent);button.append(' ×');button.setAttribute('aria-label','Quitar '+input.parentElement.textContent.trim());button.onclick=()=>{input.checked=false;input.dispatchEvent(new Event('change',{bubbles:true}));};out.appendChild(button);});filter();
}
function reset(){if(!$('tpfCompactLabels'))return;$('tpfPickSearch').value='';$('tpfPickCategory').value='';$('tpfPickPanel').hidden=true;$('tpfPickToggle').textContent='＋ Añadir etiquetas';$('tpfPickToggle').setAttribute('aria-expanded','false');sync();}
window.TPFContactLabelPicker={install,sync,reset};
})();