(function(){
'use strict';
const modal=document.getElementById('contactModal');
if(!modal||window.__tpfDesktopSummaryAccordion)return;
window.__tpfDesktopSummaryAccordion=true;
const $=id=>document.getElementById(id);
function addStyle(){
 if($('tpfDesktopSummaryAccordionStyle'))return;
 const s=document.createElement('style');s.id='tpfDesktopSummaryAccordionStyle';s.textContent=`
 @media(min-width:1024px){
 #contactModal.tpfContactReference .cpRight[data-cp-ref-selected="resumen"] #cpRefPanel{display:block!important;padding:14px!important}
 #contactModal.tpfContactReference #tpfGoogleInlineCard{margin:0 0 12px!important}
 #contactModal.tpfContactReference:not(.tpf-contact-editing) .cpSeparateIdentity #contactName{display:none!important}
 #contactModal.tpfContactReference .cpRefEdit{display:none!important}
 #contactModal.tpfContactReference .tpfInlineEditData{float:right;margin:-3px 0 0!important;padding:5px 8px!important;border:1px solid #9eb1ca!important;border-radius:6px!important;background:#fff!important;color:#173d74!important;font-size:12px!important;font-weight:700!important}
 #contactModal.tpfContactReference .cpSeparateIdentity #cpProfileIdentityText{display:flex!important;flex-direction:column!important;align-items:flex-start!important;gap:3px!important}
 #contactModal.tpfContactReference .cpSeparateIdentity #cpProfileDisplayName{display:block!important;line-height:1.22!important}
 #contactModal.tpfContactReference .cpSeparateIdentity #cpProfileNickname{display:block!important;margin:0!important;line-height:1.25!important}
 #contactModal.tpfContactReference #contactLabelsList{display:flex!important;flex-wrap:wrap!important;gap:7px!important}
 #contactModal.tpfContactReference #contactLabelsList .contactLabelChip{display:inline-flex!important;align-items:center!important;gap:6px!important;padding:5px 9px!important;border-radius:999px!important;font-size:12px!important;font-weight:750!important;letter-spacing:.02em!important;line-height:1.1!important}
 #contactModal.tpfContactReference #contactLabelsList .contactLabelChip[data-tpf-label-tone="contra"]{background:#dff4e3!important;color:#2c6c46!important}
 #contactModal.tpfContactReference #contactLabelsList .contactLabelChip[data-tpf-label-tone="offer"]{background:#fff0df!important;color:#a46019!important}
 #contactModal.tpfContactReference #contactLabelsList .contactLabelChip[data-tpf-label-tone="sales"]{background:#fff4c7!important;color:#8d6714!important}
 #contactModal.tpfContactReference #contactLabelsList .contactLabelChip[data-tpf-label-tone="other"]{background:#eaf0fb!important;color:#2f5d9c!important}
 #contactModal.tpfContactReference #contactLabelsList .tpfLabelRemove{appearance:none!important;border:0!important;background:transparent!important;color:inherit!important;padding:0!important;margin:0!important;font:inherit!important;font-size:17px!important;font-weight:800!important;line-height:1!important;cursor:pointer!important}
 #contactModal.tpfContactReference .cpRight[data-cp-ref-selected="resumen"]>.cpSideSection,
 #contactModal.tpfContactReference .cpRight[data-cp-ref-selected="resumen"]>#cpOffersSection,
 #contactModal.tpfContactReference #cpRefPanel>.cpSideSection,
 #contactModal.tpfContactReference #cpRefPanel>#cpOffersSection{display:none!important}
 #contactModal.tpfContactReference .cpRight[data-cp-ref-selected="resumen"]>#tpfGoogleInlineCard{display:block!important}\n #contactModal.tpfContactReference .cpTop{display:flex!important;align-items:center!important;flex-wrap:nowrap!important;gap:7px!important}
 #contactModal.tpfContactReference .cpTop>.cpNav{order:1!important;margin:0!important}
 #contactModal.tpfContactReference .cpTop>.cpQuick{order:2!important;display:flex!important;flex:0 0 auto!important;flex-wrap:nowrap!important;align-items:center!important;width:auto!important;gap:6px!important;margin:0 0 0 auto!important}
 #contactModal.tpfContactReference .cpTop>.cpQuick button,#contactModal.tpfContactReference .cpTop>.cpQuick a{white-space:nowrap!important;flex:0 0 auto!important;padding:7px 9px!important;font-size:12px!important}
 #contactModal.tpfContactReference .cpTop>.cpQuick #cpDirectSale{order:10!important;margin:0!important}
 #contactModal.tpfContactReference .tpfSummaryAccordion{display:grid;gap:12px}
 #contactModal.tpfContactReference .tpfSummaryGroup{border:1px solid #e1e7f0;border-radius:8px;background:#fff;overflow:hidden}
 #contactModal.tpfContactReference .tpfSummaryTrigger{width:100%;display:grid;grid-template-columns:minmax(180px,auto) minmax(0,1fr) 24px;align-items:center;gap:12px;padding:13px 14px;background:#fff;border:0;color:#1d3557;text-align:left;cursor:pointer}
 #contactModal.tpfContactReference .tpfSummaryTitle{font-size:16px;font-weight:750}
 #contactModal.tpfContactReference .tpfSummaryMetric{justify-self:end;color:#60708a;font-size:12px;line-height:1.45;text-align:right}
 #contactModal.tpfContactReference .tpfSummaryChevron{justify-self:end;font-size:20px;line-height:1;color:#2f68bd;transition:transform .15s ease}
 #contactModal.tpfContactReference .tpfSummaryGroup[data-open="true"] .tpfSummaryChevron{transform:rotate(180deg)}
 #contactModal.tpfContactReference .tpfSummaryGroup[data-open="false"] .tpfSummaryBody{display:none!important}
 #contactModal.tpfContactReference .tpfSummaryBody{border-top:1px solid #e7edf5;padding:12px 14px}
 #contactModal.tpfContactReference .tpfSummaryBody [data-cp-ref-pane]{display:block!important;margin:0!important;border:0!important;padding:0!important;box-shadow:none!important}
 #contactModal.tpfContactReference .tpfSummaryBody>.tpfSummaryWork{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}
 }
 `;document.head.appendChild(s);
}
function directSection(predicate){
 return [...modal.querySelectorAll('.cpRight>.cpSideSection,#cpRefPanel>.cpSideSection,#cpOffersSection')].find(el=>predicate(el))||null;
}
function metric(key){
 if(key==='work'){
  const total=$('cpOppTotal')?.textContent||'0',open=$('cpOppOpen')?.textContent||'0',expired=$('cpOppExpired')?.textContent||'0';
  const taskCount=[...($('cpTasks')?.children||[])].filter(x=>!x.classList.contains('cpEmpty')).length;
  return 'Oportunidades: '+total+' total · '+open+' abiertas · '+expired+' vencidas | Tareas: '+taskCount+' pendientes';
 }
 if(key==='programs'){
  const n=[...($('cpWhatsappPrograms')?.children||[])].filter(x=>!x.classList.contains('cpEmpty')).length;
  return n+' WhatsApp programado'+(n===1?'':'s');
 }
 if(key==='automation'){
  const metrics=[...modal.querySelectorAll('#cpAutomationStatus .casMetrics span')].map(node=>String(node.textContent||'').trim()).filter(Boolean);
  return metrics.join(' · ')||'Sin automatizaciones';
 }
 const items=[...modal.querySelectorAll('#cpOfferInstances .cpOfferCard,#cpOfferInstances .cpOfferItem')];
 const statuses=items.map(item=>String(item.dataset.offerStatus||item.querySelector('.cpOfferStatus')?.className||'').toLowerCase());
 const active=statuses.filter(status=>status.includes('queued')||status.includes('following')).length;
 const paused=statuses.filter(status=>status.includes('paused')).length;
 const processed=statuses.filter(status=>status.includes('accepted')||status.includes('processed')||status.includes('won')).length;
 return items.length+' oferta'+(items.length===1?'':'s')+' · '+active+' activas · '+paused+' pausadas · '+processed+' tramitadas';
}
function group(root,key,title,nodes){
 let block=root.querySelector('[data-summary-key="'+key+'"]');
 if(!block){
  block=document.createElement('section');block.className='tpfSummaryGroup';block.dataset.summaryKey=key;block.dataset.open='false';
  block.innerHTML='<button type="button" class="tpfSummaryTrigger" aria-expanded="false"><span class="tpfSummaryTitle"></span><small class="tpfSummaryMetric"></small><span class="tpfSummaryChevron" aria-hidden="true">⌄</span></button><div class="tpfSummaryBody"></div>';
  block.querySelector('.tpfSummaryTitle').textContent=title;
  block.querySelector('.tpfSummaryTrigger').onclick=()=>{const open=block.dataset.open!=='true';block.dataset.open=String(open);block.querySelector('button').setAttribute('aria-expanded',String(open));if(open&&key==='offers')window.dispatchEvent(new CustomEvent('tpf:summary-offers-open'));};
  root.appendChild(block);
 }
 const body=block.querySelector('.tpfSummaryBody');
 if(key==='work'){
  let wrap=body.querySelector('.tpfSummaryWork');if(!wrap){wrap=document.createElement('div');wrap.className='tpfSummaryWork';body.appendChild(wrap)}
  nodes.filter(Boolean).forEach(n=>{if(n.parentElement!==wrap)wrap.appendChild(n)});
 }else nodes.filter(Boolean).forEach(n=>{if(n.parentElement!==body)body.appendChild(n)});
 const metricNode=block.querySelector('.tpfSummaryMetric'),metricText=metric(key);
 if(metricNode&&metricNode.textContent!==metricText)metricNode.textContent=metricText;
}
function ensure(){
 if(window.innerWidth<1024||modal.classList.contains('hidden'))return;
 const panel=$('cpRefPanel');if(!panel)return;
 modal.querySelectorAll('.cpRefCall').forEach(node=>node.remove());
 const expiry=[...modal.querySelectorAll('.cpRefExpiry')];expiry.slice(1).forEach(node=>node.remove());
 const labels=[...modal.querySelectorAll('#contactLabelsList .contactLabelChip')];
 labels.forEach(chip=>{
   const label=(chip.dataset.tpfLabelText||chip.textContent||'').replace(/×/g,'').trim();
   chip.dataset.tpfLabelText=label;
   const normalized=label.toUpperCase();
   chip.dataset.tpfLabelTone=normalized.includes('CONTRAOFERTA')?'contra':normalized.startsWith('OFERTA')?'offer':normalized.startsWith('VENTA')?'sales':'other';
   if(!chip.querySelector('.tpfLabelRemove')){
     const remove=document.createElement('button');
     remove.type='button';remove.className='tpfLabelRemove';remove.textContent='×';
     remove.setAttribute('aria-label','Quitar etiqueta '+label);
     remove.title='Quitar etiqueta';
     remove.onclick=()=>{const edit=$('tpfContactEditToggle');if(edit)edit.click();setTimeout(()=>{$('contactManageLabels')?.click();},0);};
     chip.appendChild(remove);
   }
 });
 const phone=$('contactPhone'),dataCard=phone?.closest('.cpSideSection,.cpDataCard,.cpFieldGroup')||phone?.parentElement?.parentElement;
 if(dataCard&&!dataCard.querySelector('.tpfInlineEditData')){
   const b=document.createElement('button');b.type='button';b.className='tpfInlineEditData';b.textContent='Editar datos';
   b.onclick=()=>$('tpfContactEditToggle')?.click();
   const title=[...dataCard.querySelectorAll('h2,h3,strong')].find(x=>/Datos del contacto/i.test(x.textContent||''));
   if(title)title.appendChild(b);else dataCard.prepend(b);
 }
 const top=modal.querySelector('.cpTop'),quick=modal.querySelector('.cpQuick');
 if(top&&quick&&quick.parentElement!==top)top.appendChild(quick);
 const verification=$('tpfGoogleInlineCard'),right=modal.querySelector('.cpRight');
 if(verification&&right){delete verification.dataset.cpRefPane;if(right.firstChild!==verification)right.prepend(verification);}
 addStyle();
 let root=$('tpfSummaryAccordion');if(!root){root=document.createElement('div');root.id='tpfSummaryAccordion';root.className='tpfSummaryAccordion';panel.prepend(root)}
 const opp=directSection(el=>el.querySelector('#cpOpportunities'));
 const tasks=directSection(el=>el.querySelector('#cpTasks'));
 const programs=directSection(el=>el.querySelector('#cpWhatsappPrograms'));
 const offers=$('cpOffersSection'),automation=$('cpAutomationStatus');
 group(root,'work','Oportunidades y tareas pendientes',[opp,tasks]);
 group(root,'programs','WhatsApp programados',[programs]);
 // Cada bloque conserva su propio desplegable y todos empiezan cerrados.
 group(root,'automation','Automatizaciones',[automation]);
 group(root,'offers','Ofertas y seguimiento',[offers]);
}
new MutationObserver(()=>requestAnimationFrame(ensure)).observe(modal,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
window.addEventListener('tpf:contact-open',()=>setTimeout(()=>{const root=$('tpfSummaryAccordion');root?.querySelectorAll('.tpfSummaryGroup').forEach(block=>{block.dataset.open='false';block.querySelector('.tpfSummaryTrigger')?.setAttribute('aria-expanded','false');});ensure();},100));
window.addEventListener('tpf:offers-rendered',()=>setTimeout(ensure,0));
window.addEventListener('resize',ensure);setTimeout(ensure,200);
})();
