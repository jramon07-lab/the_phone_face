/* Customer workspace: reuse native data/actions; no background polling or business-state writes. */
(function(){
'use strict';
const $=id=>document.getElementById(id),modal=$('contactModal');if(!modal)return;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const current=()=>{try{return currentContact}catch(_){return null}};
const desktop=()=>modal.classList.contains('tpfContactReference');
let scheduled=false,oppFilter='active',oppQuery='',historyQuery='',historyType='all',dialog=null,selectedOpp='';
const observe=(node,fn,options={childList:true})=>{if(node)new MutationObserver(fn).observe(node,options)};
function queue(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;refresh()})}
function button(label,fn){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;return b}
function closeDialog(){dialog?.close()}
function showDialog(title){
 closeDialog();const trigger=document.activeElement,d=document.createElement('dialog');d.className='cpProDialog';
 d.setAttribute('aria-label',title);d.innerHTML='<header><h2>'+esc(title)+'</h2><button type="button" aria-label="Cerrar">×</button></header><div class="cpProDialogBody"></div>';
 d.querySelector('header button').onclick=()=>d.close();d.onclick=e=>{if(e.target===d)d.close()};
 d.addEventListener('close',()=>{d.remove();if(dialog===d)dialog=null;if(trigger?.isConnected)trigger.focus()},{once:true});
 document.body.append(d);d.showModal();dialog=d;return d;
}
function showFilePanel(title){
 if(!desktop())return showDialog(title);
 closeDialog();
 const pane=$('cpDocumentsPending'),d=document.createElement('section');
 d.className='cpProFilePanel';d.setAttribute('aria-label',title);
 d.innerHTML='<header><h2>'+esc(title)+'</h2><button type="button" aria-label="Cerrar vista previa">×</button></header><div class="cpProDialogBody"></div>';
 d.close=()=>{d.remove();pane?.classList.remove('cpProWithPreview');if(dialog===d)dialog=null};
 d.querySelector('header button').onclick=d.close;
 pane?.append(d);pane?.classList.add('cpProWithPreview');dialog=d;return d;
}
window.TPFContactWorkspace={showDialog,showFilePanel};
})();
