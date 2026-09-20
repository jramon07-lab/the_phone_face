/* Presentation adapters only. Adopt existing nodes; never clone form controls or call a data API. */
(function(){
'use strict';
if(!document.body.classList.contains('tpfUnified'))return;
const $=id=>document.getElementById(id);
const paths={dashboard:'M3 10 12 3l9 7v11H3Z M9 21v-8h6v8',alerts:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',search:'M21 21l-6-6 M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',sales:'M4 20V12 M10 20V4 M16 20V8 M22 20V2',database:'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3 M13 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M18 3a4 4 0 0 1 0 8',agenda:'M3 5h18v16H3Z M7 2v6 M17 2v6 M3 11h18',whatsapplive:'M5 3h4l2 5-3 2a12 12 0 0 0 6 6l2-3 5 2v4c0 4-9 2-14-3S1 3 5 3Z',email:'M3 5h18v14H3Z M3 6l9 7 9-7',labels:'M3 3h9l9 9-9 9-9-9Z M7 7h.01',settings:'M9 3h6l1 4 4 2v6l-4 2-1 4H9l-1-4-4-2V9l4-2Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',automations:'M12 3v7 M4 14v7 M20 14v7 M4 14h16 M12 10v4',whatsapp:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M12 6v6l4 2',import:'M12 16V3 M7 8l5-5 5 5 M3 15v6h18v-6',trash:'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',system:'M3 12h4l3-8 4 16 3-8h4'};
function icons(){document.querySelectorAll('.referenceNav .nav[data-view]').forEach(node=>{const slot=node.querySelector('b');if(!slot||slot.querySelector('svg'))return;const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.7');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[node.dataset.view]||'M6 2h8l5 5v15H6Z M14 2v6h5 M9 12h7 M9 16h7');svg.append(path);slot.replaceChildren(svg);});}
const nav=document.querySelector('.referenceNav');if(nav){icons();new MutationObserver(icons).observe(nav,{childList:true,subtree:true});}
function opportunity(){
 const modal=$('oppDetailModal'),card=modal?.querySelector('.opportunityModalCard');if(!card||card.querySelector('.crmOpportunityLayout'))return;
 const layout=document.createElement('div');layout.className='crmOpportunityLayout';
 const main=document.createElement('div');main.className='crmOpportunityMain';
 const aside=document.createElement('aside');aside.className='crmOpportunityAside';aside.setAttribute('aria-label','Resumen de la oportunidad');
 const summary=document.createElement('section');summary.className='crmOpportunitySummary';
 summary.innerHTML='<h3>Resumen de la oportunidad</h3><div class="crmSummaryAmount" data-crm-summary="amount"></div><span class="crmSummaryStage" data-crm-summary="stage"></span><dl><dt>Titular del contrato</dt><dd data-crm-summary="holder"></dd><dt>DNI / NIF</dt><dd data-crm-summary="dni"></dd><dt>Gestionado por</dt><dd data-crm-summary="manager"></dd><dt>WhatsApp dirigido a</dt><dd data-crm-summary="recipient"></dd><dt>Teléfono WhatsApp</dt><dd data-crm-summary="phone"></dd><dt>Fecha prevista</dt><dd data-crm-summary="date"></dd></dl><div class="crmSummaryNotes"><h4>Notas internas</h4><p data-crm-summary="notes"></p><button type="button" class="secondary" data-crm-expand hidden aria-expanded="false">Ver completas</button></div><p class="crmSummaryPending" data-crm-pending hidden>Pendiente de guardar</p>';
 aside.append(summary);layout.append(main,aside);
 const sections=[...card.querySelectorAll(':scope > .opportunitySection')];if(!sections.length)return;
 sections[0].before(layout);sections.forEach(n=>main.append(n));
 const notes=$('oppModalNotes'),notesLabel=notes.closest('label'),notesSection=document.createElement('section');notesSection.className='opportunitySection crmOpportunityNotes';
 const notesTitle=document.createElement('h3');notesTitle.className='opportunitySectionTitle';notesTitle.textContent='Notas internas';notesSection.append(notesTitle,notesLabel);main.insertBefore(notesSection,sections[1]||null);
 const searchLabel=$('oppModalDni').closest('label'),picker=document.createElement('details');picker.className='crmOpportunityContactPicker full';picker.innerHTML='<summary>Buscar otro contacto vinculado</summary>';searchLabel.before(picker);picker.append(searchLabel);
 $('oppModalClient').closest('label').firstChild.textContent='Contacto vinculado';
 notesLabel.firstChild.textContent='Tus anotaciones sobre esta oportunidad';notes.placeholder='Escribe aquí lo que necesitas recordar…';notes.rows=4;
 const activity=document.createElement('details');activity.className='crmOpportunityActivity';
 activity.innerHTML='<summary>Actividad y origen</summary><div class="crmOpportunityActivityBody"><p data-crm-origin hidden></p></div>';
 main.append(activity);const meta=$('oppMetaInfo');if(meta)activity.querySelector('div').append(meta);
 const header=card.querySelector('.opportunityModalHeader'),badges=document.createElement('div');badges.className='crmOpportunityHeaderMetrics';badges.innerHTML='<strong data-crm-header="amount"></strong><span data-crm-header="stage"></span>';header.querySelector('div').append(badges);
 const footer=card.querySelector('.opportunityActions'),more=document.createElement('details');more.className='crmOpportunityMore';more.innerHTML='<summary>Más opciones</summary><div></div>';more.querySelector('div').append($('oppModalDelete'));footer.prepend(more);
 $('oppModalClose').hidden=true;
 const status=document.createElement('span');status.className='crmOpportunitySaveState';status.setAttribute('role','status');footer.insertBefore(status,$('oppModalSave'));
 const fields=['oppModalTitle','oppModalClient','oppModalPhone','oppModalAmount','oppModalDate','oppModalStage','oppModalNotes'];
 const fingerprint=()=>JSON.stringify(fields.map(id=>$(id)?.value||''));let baseline='',wasOpen=false,openedId='';
 const setText=(node,value)=>{if(node&&node.textContent!==String(value))node.textContent=String(value);};
 const tones={'próximo':'future','este mes':'current','seguimiento':'followup','pendiente de tramitar':'pending','tramitado':'processed','ganado':'won','perdido':'lost'};
 const expand=summary.querySelector('[data-crm-expand]'),notePreview=summary.querySelector('[data-crm-summary="notes"]');
 expand.onclick=()=>{const expanded=expand.getAttribute('aria-expanded')!=='true';expand.setAttribute('aria-expanded',String(expanded));notePreview.classList.toggle('expanded',expanded);expand.textContent=expanded?'Ver menos':'Ver completas';};
 function update(){
  if(modal.classList.contains('hidden'))return;
  const info=window.TPFContactRelations?.opportunityPreview()||{},amountInput=$('oppModalAmount')?.value,amount=amountInput!==''&&Number.isFinite(Number(amountInput))?Number(amountInput).toLocaleString('es-ES',{style:'currency',currency:'EUR'}):'Sin importe';
  const stage=$('oppModalStage')?.selectedOptions?.[0]?.textContent||'Sin estado';
  const values={holder:info.loading?'Comprobando…':info.holder||$('oppModalClient')?.value||'Sin titular',dni:info.loading?'—':info.dni||'Sin indicar',manager:info.loading?'Comprobando…':info.manager||'El propio titular',recipient:info.loading?'Comprobando…':info.recipient||'Sin indicar',phone:info.loading?'—':window.TPFContactParty?.displayPhone(info.phone)||info.phone||'Sin teléfono',amount,date:$('oppModalDate')?.value?$('oppModalDate').value.split('-').reverse().join('/'):'Sin fecha',stage,notes:notes.value||'Aún no hay notas internas.'};
  for(const [key,value]of Object.entries(values))setText(summary.querySelector('[data-crm-summary="'+key+'"]'),value);
  const recipientNode=summary.querySelector('[data-crm-summary="recipient"]'),sameRecipient=values.recipient===values.manager||values.recipient===values.holder;recipientNode.hidden=sameRecipient;recipientNode.previousElementSibling.hidden=sameRecipient;
  setText(header.querySelector('[data-crm-header="amount"]'),amount);setText(header.querySelector('[data-crm-header="stage"]'),stage);
  const tone=tones[stage.trim().toLowerCase()]||'neutral';summary.querySelector('[data-crm-summary="stage"]').dataset.tone=tone;header.querySelector('[data-crm-header="stage"]').dataset.tone=tone;
  const pending=fingerprint()!==baseline||!!info.pending;summary.querySelector('[data-crm-pending]').hidden=!pending;
  setText(status,info.error?'No se pudieron comprobar los titulares':info.loading?'Comprobando titulares…':pending?'Cambios sin guardar':$('oppModalId').value?'Sin cambios pendientes':'Nueva oportunidad');
  status.classList.toggle('pending',pending);expand.hidden=notes.value.length<180&&notes.value.split('\n').length<4;
  const origin=window.TPFOpportunityNotes?.split(notes.dataset.originalNotes||'').origin||'';const originNode=activity.querySelector('[data-crm-origin]');originNode.hidden=!origin;setText(originNode,origin?'Origen: '+origin:'');
  more.hidden=!$('oppModalId').value;
 }
 function opened(){const open=!modal.classList.contains('hidden');if(open&&(!wasOpen||openedId!==$('oppModalId').value)){openedId=$('oppModalId').value;baseline=fingerprint();activity.open=false;more.open=false;picker.open=!$('oppModalOpenContact').dataset.recordId;expand.setAttribute('aria-expanded','false');notePreview.classList.remove('expanded');expand.textContent='Ver completas';layout.scrollTop=0;}wasOpen=open;update();}
 card.addEventListener('input',update);card.addEventListener('change',update);window.addEventListener('tpf:opportunity-party-preview',update);
 new MutationObserver(opened).observe(modal,{attributes:true,attributeFilter:['class']});opened();
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
