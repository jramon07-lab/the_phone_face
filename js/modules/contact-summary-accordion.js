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
 #contactModal.tpfContactReference .cpLeft>.cpRefEdit{display:inline-flex!important;align-items:center;justify-content:center;margin:0 0 12px!important;padding:9px 12px!important;border:1px solid #9eb1ca!important;border-radius:8px!important;background:#fff!important;color:#173d74!important;font-weight:700!important}
 #contactModal.tpfContactReference .cpRight[data-cp-ref-selected="resumen"]>.cpSideSection,
 #contactModal.tpfContactReference .cpRight[data-cp-ref-selected="resumen"]>#cpOffersSection,
 #contactModal.tpfContactReference #cpRefPanel>.cpSideSection,
 #contactModal.tpfContactReference #cpRefPanel>#cpOffersSection{display:none!important}
 #contactModal.tpfContactReference .cpRight[data-cp-ref-selected="resumen"]>#tpfGoogleInlineCard{display:block!important}\n #contactModal.tpfContactReference .tpfSummaryAccordion{display:grid;gap:12px}
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
 const items=[...modal.querySelectorAll('#cpOfferInstances .cpOfferCard,#cpOfferInstances .cpOfferItem')];
 return items.length+' oferta'+(items.length===1?'':'s')+' · 0 activas · 0 pausadas · 0 tramitadas';
}
function group(root,key,title,nodes){
 let block=root.querySelector('[data-summary-key="'+key+'"]');
 if(!block){
  block=document.createElement('section');block.className='tpfSummaryGroup';block.dataset.summaryKey=key;block.dataset.open='false';
  block.innerHTML='<button type="button" class="tpfSummaryTrigger" aria-expanded="false"><span class="tpfSummaryTitle"></span><small class="tpfSummaryMetric"></small><span class="tpfSummaryChevron" aria-hidden="true">⌄</span></button><div class="tpfSummaryBody"></div>';
  block.querySelector('.tpfSummaryTitle').textContent=title;
  block.querySelector('.tpfSummaryTrigger').onclick=()=>{const open=block.dataset.open!=='true';block.dataset.open=String(open);block.querySelector('button').setAttribute('aria-expanded',String(open));};
  root.appendChild(block);
 }
 const body=block.querySelector('.tpfSummaryBody');
 if(key==='work'){
  let wrap=body.querySelector('.tpfSummaryWork');if(!wrap){wrap=document.createElement('div');wrap.className='tpfSummaryWork';body.appendChild(wrap)}
  nodes.filter(Boolean).forEach(n=>{if(n.parentElement!==wrap)wrap.appendChild(n)});
 }else nodes.filter(Boolean).forEach(n=>{if(n.parentElement!==body)body.appendChild(n)});
 block.querySelector('.tpfSummaryMetric').textContent=metric(key);
}
function ensure(){
 if(window.innerWidth<1024||modal.classList.contains('hidden'))return;
 const panel=$('cpRefPanel');if(!panel)return;
 const header=modal.querySelector('.cpTop'),left=modal.querySelector('.cpLeft');
 const call=modal.querySelector('.cpRefCall'),edit=modal.querySelector('.cpRefEdit');
 if(header&&call&&call.parentElement!==header)header.prepend(call);
 if(left&&edit&&edit.parentElement!==left)left.insertBefore(edit,left.firstElementChild||null);
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
 group(root,'offers','Ofertas y seguimiento',[offers,automation]);
}
new MutationObserver(()=>requestAnimationFrame(ensure)).observe(modal,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
window.addEventListener('tpf:contact-open',()=>setTimeout(ensure,100));
window.addEventListener('resize',ensure);setTimeout(ensure,200);
})();