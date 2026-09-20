/* Desktop presentation only: native chat controls keep their handlers. */
(function(){
'use strict';
const $=id=>document.getElementById(id),view=$('view-whatsapplive');if(!view||innerWidth<1051)return;
let activeId='',revision=0,queued=false,full=false;
const contact=()=>{try{return waLiveState?.contact||null}catch(_){return null}};
function button(id,text,fn){const b=document.createElement('button');b.type='button';b.id=id;b.className='secondary';b.textContent=text;b.onclick=fn;return b;}
function fold(section){if(!section||section.dataset.waFold)return;const head=section.querySelector('.waSideSectionHead'),title=head?.querySelector('h4');if(!head||!title)return;section.dataset.waFold='1';const content=document.createElement('div');content.className='waCleanFoldBody';content.hidden=true;content.id='waFold-'+(section.querySelector('[id]')?.id||Math.random().toString(36).slice(2));for(const n of [...section.children])if(n!==head)content.append(n);section.append(content);const toggle=button('',title.textContent,()=>{content.hidden=!content.hidden;toggle.setAttribute('aria-expanded',String(!content.hidden));});toggle.className='waCleanFoldToggle';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls',content.id);title.replaceWith(toggle);}
function panel(on){view.classList.toggle('waClientHidden',!on);const b=$('waClientToggle');if(b){b.textContent=on?'Ocultar cliente':'Mostrar cliente';b.setAttribute('aria-expanded',String(on));}}
function fullscreen(on){full=on;document.body.classList.toggle('tpfWaWorkspaceOnly',on);view.classList.toggle('waCleanFullscreen',on);$('waCleanExpand').textContent=on?'↙ Salir de pantalla completa':'⛶';$('waCleanExpand').setAttribute('aria-pressed',String(on));fit();}
function fit(){if(innerWidth<1051)return;const page=view.querySelector('.waLivePage');if(page&&view.getBoundingClientRect().height){const h=Math.max(360,innerHeight-page.getBoundingClientRect().top-8);page.style.setProperty('height',h+'px','important');}}
function disclosure(id,title){const d=document.createElement('details');d.id=id;d.className='waCleanDisclosure';const s=document.createElement('summary');s.textContent=title;d.append(s);const body=document.createElement('div');body.className='waCleanDisclosureBody';d.append(body);return d;}
async function profile(section){const c=contact();if(!c)return;await window.openContact(c.id);if(section==='relations')$('tpfContactEditToggle')?.click();else if(section==='offers'){const node=$('cpOffersSection');const group=node?.closest('.tpfSummaryGroup');const trigger=group?.querySelector('.tpfSummaryTrigger');if(trigger?.getAttribute('aria-expanded')==='false')trigger.click();node?.scrollIntoView({block:'center'});}}
function install(){
 if($('waClientToggle'))return;
 view.classList.add('waCleanWorkspace');
 const actions=view.querySelector('.waChatTopActions');actions.append(button('waClientToggle','Ocultar cliente',()=>panel(view.classList.contains('waClientHidden'))));$('waClientToggle').setAttribute('aria-expanded','true');$('waClientToggle').setAttribute('aria-controls','waContactPanel');view.querySelector('.waContactPane').id='waContactPanel';
 const more=document.createElement('details');more.className='waCleanMore';more.innerHTML='<summary aria-label="Más acciones de conversación">⋯</summary><div></div>';actions.append(more);for(const id of ['waPinChat','waTagChat','waMediaChat','waOpenContactTop','waCreateContactTop'])if($(id))more.lastChild.append($(id));
 const header=view.querySelector('.waLiveHeaderActions');header.append(button('waCleanExpand','⛶',()=>fullscreen(!full)));$('waCleanExpand').title='Pantalla completa';$('waCleanExpand').setAttribute('aria-label','Pantalla completa');$('waCleanExpand').setAttribute('aria-pressed','false');
 const tools=document.createElement('details');tools.id='waCleanTools';tools.className='waCleanMore';tools.innerHTML='<summary aria-label="Más herramientas de WhatsApp">⋯</summary><div></div>';header.append(tools);if($('waLiveRefresh'))tools.lastChild.append($('waLiveRefresh'));
 const tabs=view.querySelector('.waTabs');const overflow=document.createElement('details');overflow.className='waCleanMore waCleanFilters';overflow.innerHTML='<summary>Más filtros</summary><div></div>';tabs.append(overflow);for(const b of [...tabs.querySelectorAll('[data-wa-tab]')])if(!['all','automatic','unread','unanswered'].includes(b.dataset.waTab))overflow.lastChild.append(b);
 tabs.addEventListener('click',e=>{if(e.target.closest('[data-wa-tab]'))overflow.open=false;});
 const card=$('waContactCard'),rel=disclosure('waCleanRelations','Titulares y gestores');$('waSideIdentity').after(rel);rel.lastChild.append(button('waCleanManageRelations','Gestionar',()=>profile('relations')));const rows=document.createElement('div');rows.id='waCleanRelationRows';rel.lastChild.prepend(rows);
 const offers=disclosure('waCleanOffers','Ofertas y seguimiento');offers.lastChild.innerHTML='<div id="waCleanOfferRows"></div>';offers.lastChild.append(button('waCleanManageOffers','Gestionar ofertas',()=>profile('offers')));$('waSideTasks').closest('.waSideSection').after(offers);
 $('waSideName').tabIndex=0;$('waSideName').setAttribute('role','button');$('waSideName').title='Abrir ficha del cliente';$('waSideName').onclick=()=>$('waSideOpenContact').click();$('waSideName').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('waSideOpenContact').click();}};
 const review=button('waCleanReview','＋ Revisión',async()=>{const c=contact();if(!c)return;try{await window.TPFContactReview.openForContact(c);}catch(e){alert(e.message||'No se pudo abrir la revisión.');}});card.insertBefore(review,$('waSideOpps').closest('.waSideSection'));
 for(const section of card.querySelectorAll('.waSideSection'))if(!section.querySelector('#waSideTags')&&!section.classList.contains('casCard'))fold(section);
 $('waAddTagSide').textContent='Gestionar';$('waComposerText').placeholder='Escribe un mensaje…';
 document.addEventListener('click',e=>{for(const d of view.querySelectorAll('.waCleanMore[open]'))if(!d.contains(e.target)||e.target.closest('button'))d.open=false;const nav=e.target.closest('.nav');if(nav&&nav.dataset.view!=='whatsapplive'&&full)fullscreen(false);});
 new MutationObserver(schedule).observe(card,{childList:true,subtree:true});
 new MutationObserver(schedule).observe(header,{childList:true});
 window.addEventListener('tpf:sales-updated',()=>{activeId='';schedule();});window.addEventListener('resize',fit);window.addEventListener('tpf:contact-updated',()=>{activeId='';schedule();});
 document.addEventListener('click',e=>{if(e.target.closest('.nav[data-view="whatsapplive"],#waLiveChats'))setTimeout(refresh,150);});
 refresh();
}
function schedule(){if(queued)return;queued=true;setTimeout(()=>{queued=false;refresh();},120);}
function refresh(){
 const draft=$('tpfWaFinalReviewOpen')||view.querySelector('.waLiveHeaderActions>button[id*="Draft"]');if(draft&&!draft.closest('#waCleanTools'))$('waCleanTools')?.lastChild.append(draft);
 const c=contact(),id=String(c?.id||'');for(const n of [$('waCleanRelations'),$('waCleanOffers'),$('waCleanReview')])if(n)n.hidden=!id;
 const actions=$('waSideContactActions');if(actions&&$('waCleanReview')?.parentElement!==actions)actions.append($('waCleanReview'));
 const auto=$('waAutomationStatus');if(auto&&auto.previousElementSibling!==$('waCleanOffers'))$('waCleanOffers').after(auto);
 fit();if(!window.TPFContactRelations?.sidebarSnapshot||!window.TPFWhatsappOfferSummary){setTimeout(schedule,500);return;}if(id===activeId)return;activeId=id;const token=++revision;
 $('waCleanRelationRows').textContent=id?'Cargando relaciones…':'';$('waCleanOfferRows').textContent=id?'Cargando ofertas…':'';
 if(!id)return;
 window.TPFContactRelations.sidebarSnapshot(c).then(data=>{
 if(token!==revision)return;const root=$('waCleanRelationRows');root.replaceChildren();$('waCleanRelations').firstChild.textContent='Titulares y gestores · '+(data.holders.length+data.managers.length+(data.legacy?1:0));for(const [label,rows]of [['Titular',data.holders],['Gestor',data.managers]])for(const p of rows){const b=button('',p.name+' · '+label,()=>window.openContact(p.record_id));b.className='waCleanPerson';root.append(b);}if(!root.children.length)root.textContent='Sin personas asociadas.';if(data.legacy){const p=document.createElement('p');p.textContent=data.legacy+' · Titular anterior';root.append(p);}
 }).catch(()=>{if(token===revision)$('waCleanRelationRows').textContent='No se pudieron cargar las relaciones. Vuelve a abrir el chat para reintentarlo.';});
 window.TPFWhatsappOfferSummary(id).then(rows=>{if(token!==revision)return;const root=$('waCleanOfferRows');root.replaceChildren();$('waCleanOffers').firstChild.textContent='Ofertas y seguimiento · '+rows.length;for(const x of rows.slice(0,4)){const row=document.createElement('div');row.className='waCleanOfferRow';const title=document.createElement('b');title.textContent=x.title;const meta=document.createElement('small');meta.textContent=x.amount+' · '+x.status;row.append(title,meta);root.append(row);}if(!rows.length)root.textContent='Sin ofertas para este contacto.';}).catch(()=>{if(token===revision)$('waCleanOfferRows').textContent='No se pudieron cargar las ofertas.';});
}
document.addEventListener('click',e=>{if(e.target.closest?.('.nav[data-view="whatsapplive"]'))setTimeout(install,0);});
if(!view.classList.contains('hidden'))install();
})();
