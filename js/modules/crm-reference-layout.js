/* Presentation adapters only. Adopt existing nodes; never clone form controls or call a data API. */
(function(){
'use strict';
if(!document.body.classList.contains('tpfUnified'))return;
const $=id=>document.getElementById(id);
const paths={dashboard:'M3 10 12 3l9 7v11H3Z M9 21v-8h6v8',alerts:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',search:'M21 21l-6-6 M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',sales:'M4 20V12 M10 20V4 M16 20V8 M22 20V2',database:'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3 M13 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M18 3a4 4 0 0 1 0 8',agenda:'M3 5h18v16H3Z M7 2v6 M17 2v6 M3 11h18',whatsapplive:'M5 3h4l2 5-3 2a12 12 0 0 0 6 6l2-3 5 2v4c0 4-9 2-14-3S1 3 5 3Z',email:'M3 5h18v14H3Z M3 6l9 7 9-7',labels:'M3 3h9l9 9-9 9-9-9Z M7 7h.01',settings:'M9 3h6l1 4 4 2v6l-4 2-1 4H9l-1-4-4-2V9l4-2Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',automations:'M12 3v7 M4 14v7 M20 14v7 M4 14h16 M12 10v4',whatsapp:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M12 6v6l4 2',import:'M12 16V3 M7 8l5-5 5 5 M3 15v6h18v-6',trash:'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',system:'M3 12h4l3-8 4 16 3-8h4'};
function icons(){document.querySelectorAll('.referenceNav .nav[data-view]').forEach(node=>{const slot=node.querySelector('b');if(!slot||slot.querySelector('svg'))return;const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.7');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[node.dataset.view]||'M6 2h8l5 5v15H6Z M14 2v6h5 M9 12h7 M9 16h7');svg.append(path);slot.replaceChildren(svg);});}
const nav=document.querySelector('.referenceNav');if(nav){icons();new MutationObserver(icons).observe(nav,{childList:true,subtree:true});}
function opportunity(){
 const card=document.querySelector('#oppDetailModal .opportunityModalCard');if(!card||card.querySelector('.crmOpportunityLayout'))return;
 const layout=document.createElement('div');layout.className='crmOpportunityLayout';
 const main=document.createElement('div');main.className='crmOpportunityMain';
 const aside=document.createElement('aside');aside.className='crmOpportunityAside';aside.setAttribute('aria-label','Resumen de la oportunidad');
 const summary=document.createElement('section');summary.className='crmOpportunitySummary';
 summary.innerHTML='<h3>Resumen de la oportunidad</h3><dl><dt>Cliente</dt><dd data-crm-summary="client"></dd><dt>Teléfono</dt><dd data-crm-summary="phone"></dd><dt>Importe</dt><dd data-crm-summary="amount"></dd><dt>Fecha prevista</dt><dd data-crm-summary="date"></dd><dt>Estado</dt><dd data-crm-summary="stage"></dd></dl>';
 aside.append(summary);layout.append(main,aside);
 const sections=[...card.querySelectorAll(':scope > .opportunitySection')];if(!sections.length)return;
 sections[0].before(layout);sections.forEach(n=>main.append(n));
 const meta=$('oppMetaInfo');if(meta)aside.append(meta);
 function update(){const values={client:$('oppModalClient')?.value||'Sin contacto',phone:$('oppModalPhone')?.value||'Sin teléfono',amount:($('oppModalAmount')?.value!==''?Number($('oppModalAmount')?.value):0).toLocaleString('es-ES',{style:'currency',currency:'EUR'}),date:$('oppModalDate')?.value?$('oppModalDate').value.split('-').reverse().join('/'):'Sin fecha',stage:$('oppModalStage')?.selectedOptions?.[0]?.textContent||'Sin estado'};for(const [key,value]of Object.entries(values)){summary.querySelector('[data-crm-summary="'+key+'"]').textContent=value;}}
 card.addEventListener('input',update);card.addEventListener('change',update);
 new MutationObserver(update).observe($('oppDetailModal'),{attributes:true,attributeFilter:['class']});update();
}
opportunity();
const settings=$('view-settings');
if(settings){
 const layout=document.createElement('div');layout.className='crmSettingsLayout';
 const nav=document.createElement('nav');nav.className='crmSettingsNav';nav.setAttribute('aria-label','Secciones de configuración');
 const content=document.createElement('div');content.className='crmSettingsContent';layout.append(nav,content);
 const cards=[...settings.children].filter(n=>n.classList.contains('card'));if(cards.length>1){cards[0].after(layout);cards.slice(1).forEach(n=>content.append(n));}
 let scheduled=false;
 function refresh(){scheduled=false;if(!layout.isConnected)return;[...settings.children].filter(n=>n!==cards[0]&&n.classList.contains('card')).forEach(n=>content.append(n));const sections=[...content.children].filter(n=>n.matches('.card'));const signature=sections.map(n=>n.querySelector('h2,h3')?.textContent||'').join('|');if(nav.dataset.signature===signature)return;nav.dataset.signature=signature;nav.replaceChildren();sections.forEach((section,i)=>{const title=section.querySelector('h2,h3');if(!title)return;if(!section.id)section.id='crm-settings-section-'+i;const a=document.createElement('a');a.href='#'+section.id;a.textContent=title.textContent;a.addEventListener('click',e=>{e.preventDefault();section.scrollIntoView({behavior:'auto',block:'start'});});nav.append(a);});}
 new MutationObserver(()=>{if(!scheduled){scheduled=true;requestAnimationFrame(refresh);}}).observe(settings,{childList:true,subtree:true});refresh();
}
})();
