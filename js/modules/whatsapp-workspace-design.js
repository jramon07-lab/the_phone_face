/* Desktop presentation only: native chat controls keep their handlers. */
(function(){
'use strict';
const $=id=>document.getElementById(id),view=$('view-whatsapplive');if(!view||innerWidth<1051)return;
let activeId='',revision=0,queued=false,full=false,sideTab='client',offerRows=[],shownId='';
const tabScroll=new Map();
const contact=()=>{try{return waLiveState?.contact||null}catch(_){return null}};
function button(id,text,fn){const b=document.createElement('button');b.type='button';b.id=id;b.className='secondary';b.textContent=text;b.onclick=fn;return b;}
function fold(section){if(!section||section.dataset.waFold)return;const head=section.querySelector('.waSideSectionHead'),title=head?.querySelector('h4');if(!head||!title)return;section.dataset.waFold='1';const content=document.createElement('div');content.className='waCleanFoldBody';content.hidden=true;content.id='waFold-'+(section.querySelector('[id]')?.id||Math.random().toString(36).slice(2));for(const n of [...section.children])if(n!==head)content.append(n);section.append(content);const toggle=button('',title.textContent,()=>{content.hidden=!content.hidden;toggle.setAttribute('aria-expanded',String(!content.hidden));});toggle.className='waCleanFoldToggle';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls',content.id);title.replaceWith(toggle);}
function panel(on){view.classList.toggle('waClientHidden',!on);const b=$('waClientToggle');if(b){b.textContent=on?'Ocultar cliente':'Mostrar cliente';b.setAttribute('aria-expanded',String(on));}}
function fullscreen(on){full=on;document.body.classList.toggle('tpfWaWorkspaceOnly',on);view.classList.toggle('waCleanFullscreen',on);$('waCleanExpand').textContent=on?'↙ Salir de pantalla completa':'⛶';$('waCleanExpand').setAttribute('aria-pressed',String(on));fit();}
function fit(){if(innerWidth<1051)return;const page=view.querySelector('.waLivePage');if(page&&view.getBoundingClientRect().height){const h=Math.max(360,innerHeight-page.getBoundingClientRect().top-8);if(page.style.height!==h+'px')page.style.setProperty('height',h+'px','important');}}
function disclosure(id,title){const d=document.createElement('details');d.id=id;d.className='waCleanDisclosure';const s=document.createElement('summary');s.textContent=title;d.append(s);const body=document.createElement('div');body.className='waCleanDisclosureBody';d.append(body);return d;}
async function profile(section){const c=contact();if(!c)return;await window.openContact(c.id);if(section==='relations')$('tpfContactEditToggle')?.click();else if(section==='offers'){const node=$('cpOffersSection');const group=node?.closest('.tpfSummaryGroup');const trigger=group?.querySelector('.tpfSummaryTrigger');if(trigger?.getAttribute('aria-expanded')==='false')trigger.click();node?.scrollIntoView({block:'center'});}}
// Move the original nodes, retaining listeners, editors and all contact data.
function selectSideTab(key){
 const scroller=view.querySelector('.waContactPane');if(scroller)tabScroll.set(shownId+':'+sideTab,scroller.scrollTop);
 sideTab=key;
 for(const b of view.querySelectorAll('[data-wa-side-tab]')){const on=b.dataset.waSideTab===key;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;}
 for(const pane of view.querySelectorAll('[data-wa-side-panel]'))pane.hidden=pane.dataset.waSidePanel!==key;
 if(scroller)scroller.scrollTop=tabScroll.get(shownId+':'+key)||0;
}
function organizeSide(){
 const card=$('waContactCard');if(!card)return;
 for(const host of [card,...card.querySelectorAll('[data-wa-side-panel]')])for(const node of [...host.childNodes])if(node.nodeType===3&&/^(?:null\s*)+$/.test(node.textContent.trim()))node.remove();
 if(!$('waSideTabs')){
  const tabs=document.createElement('div');tabs.id='waSideTabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Información del cliente');card.append(tabs);
  for(const [key,label] of [['client','Cliente'],['work','Gestiones'],['history','Historial']]){
   const b=button('waSideTab-'+key,label,()=>selectSideTab(key));b.dataset.waSideTab=key;b.setAttribute('role','tab');b.setAttribute('aria-controls','waSidePanel-'+key);tabs.append(b);
   const pane=document.createElement('div');pane.id='waSidePanel-'+key;pane.dataset.waSidePanel=key;pane.setAttribute('role','tabpanel');pane.setAttribute('aria-labelledby',b.id);card.append(pane);
  }
  tabs.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const keys=['client','work','history'];const i=keys.indexOf(sideTab),next=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3;selectSideTab(keys[next]);$('waSideTab-'+keys[next]).focus();});
  selectSideTab(sideTab);
 }
 const move=(node,key)=>{const host=$('waSidePanel-'+key);if(node&&node.parentElement!==host)host.append(node);};
 for(const node of [...card.children]){
  if(node.id==='waSideTabs'||node.dataset.waSidePanel||node.classList.contains('waContactHeader')||['waSideContactActions','waCleanReview'].includes(node.id))continue;
  const work=['waCleanOffers','waAutomationStatus'].includes(node.id)||node.querySelector('#waSideOpps,#waSideTasks');
  const history=['waSlaState','waPersistState'].includes(node.id)||node.querySelector('#waActivityTimeline');
  move(node,work?'work':history?'history':'client');
 }
 // Modules can insert these asynchronously next to an existing anchor.
 for(const id of ['waCleanOffers','waAutomationStatus'])move($(id),'work');
 for(const id of ['waSideOpps','waSideTasks'])move($(id)?.closest('.waSideSection'),'work');
 move($('waActivityTimeline')?.closest('.waSideSection'),'history');
 const offers=$('waCleanOffers'),work=$('waSidePanel-work');if(offers&&work.firstElementChild!==offers)work.prepend(offers);if(offers&&!offers.dataset.tabsOpened){offers.dataset.tabsOpened='1';offers.open=false;}
 const obs=$('waField-contactObservations');if(obs&&!obs.dataset.tabsOpened){obs.dataset.tabsOpened='1';obs.open=true;}
}
function workSummary(){
 const tab=$('waSideTab-work');if(!tab)return;
 const tasks=Number($('waSideTaskCount')?.textContent)||0;
 const pending=offerRows.filter(x=>['following','paused','accepted','queued','error'].includes(x.rawStatus));
 const label='Gestiones'+(pending.length+tasks?' · '+(pending.length+tasks):'');
 if(tab.textContent!==label)tab.textContent=label;
 tab.title=pending.length+' ofertas en curso y '+tasks+' tareas pendientes';
 const offers=$('waCleanOffers');if(offers&&offers.dataset.contactOpened!==shownId){offers.dataset.contactOpened=shownId;offers.open=pending.length>0;}
 const section=$('waSideTasks')?.closest('.waSideSection'),toggle=section?.querySelector('.waCleanFoldToggle');
 if(section&&section.dataset.contactOpened!==shownId+':'+tasks){section.dataset.contactOpened=shownId+':'+tasks;if(tasks&&toggle?.getAttribute('aria-expanded')==='false')toggle.click();}
}
function imagePreview(e){
 const source=e.target.closest?.('#waMessages .waMediaImage');if(!source||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
 e.preventDefault();e.stopPropagation();$('waImagePreview')?.close();
 const d=document.createElement('dialog');d.id='waImagePreview';d.setAttribute('aria-label','Vista previa de imagen');
 const close=button('','Cerrar',()=>d.close()),img=document.createElement('img');img.src=source.currentSrc||source.src;img.alt=source.alt||'Imagen recibida';
 const link=document.createElement('a');link.href=source.closest('a')?.href||img.src;link.target='_blank';link.rel='noopener';link.textContent='Abrir original';d.append(close,img,link);document.body.append(d);
 d.addEventListener('close',()=>{d.remove();source.closest('a')?.focus();});d.addEventListener('click',ev=>{if(ev.target===d)d.close();});d.showModal();close.focus();
}
function syncRail(){
 const on=!view.classList.contains('hidden')&&!$('app')?.classList.contains('hidden');document.body.classList.toggle('tpfWaCompactNav',on);
 if(on)for(const nav of document.querySelectorAll('.referenceNav .nav'))if(!nav.title)nav.title=nav.textContent.trim();
}
function install(){
 if($('waClientToggle'))return;
 view.classList.add('waCleanWorkspace');
 const actions=view.querySelector('.waChatTopActions');actions.append(button('waClientToggle','Ocultar cliente',()=>panel(view.classList.contains('waClientHidden'))));$('waClientToggle').setAttribute('aria-expanded','true');$('waClientToggle').setAttribute('aria-controls','waContactPanel');view.querySelector('.waContactPane').id='waContactPanel';
 actions.style.overflow='visible';actions.style.minWidth='0';
 const more=document.createElement('details');more.className='waCleanMore';more.style.flex='0 0 auto';more.innerHTML='<summary aria-label="Más acciones de conversación">⋯</summary><div></div>';actions.append(more);for(const id of ['waPinChat','waTagChat','waMediaChat','waOpenContactTop','waCreateContactTop'])if($(id))more.lastChild.append($(id));
 const header=view.querySelector('.waLiveHeaderActions');header.append(button('waCleanExpand','⛶',()=>fullscreen(!full)));$('waCleanExpand').title='Pantalla completa';$('waCleanExpand').setAttribute('aria-label','Pantalla completa');$('waCleanExpand').setAttribute('aria-pressed','false');
 const tools=document.createElement('details');tools.id='waCleanTools';tools.className='waCleanMore';tools.innerHTML='<summary aria-label="Más herramientas de WhatsApp">⋯</summary><div></div>';header.append(tools);if($('waLiveRefresh'))tools.lastChild.append($('waLiveRefresh'));
 const tabs=view.querySelector('.waTabs');const overflow=document.createElement('details');overflow.className='waCleanMore waCleanFilters';overflow.innerHTML='<summary aria-label="Más filtros">Más</summary><div></div>';tabs.append(overflow);for(const b of [...tabs.querySelectorAll('[data-wa-tab]')])if(!['all','unread','unanswered'].includes(b.dataset.waTab))overflow.lastChild.append(b);
 for(const key of ['all','unread','unanswered']){const b=tabs.querySelector('[data-wa-tab="'+key+'"]');if(b){if(key==='all')b.textContent='Todos';tabs.insertBefore(b,overflow);}}
 const search=$('waLiveSearch');search.placeholder='Nombre, apodo o teléfono';search.type='search';const status=document.createElement('div');status.id='waGlobalSearchStatus';status.hidden=true;status.setAttribute('role','status');tabs.after(status);
 const popup=overflow.lastChild;popup.setAttribute('popover','manual');overflow.addEventListener('toggle',()=>{if(overflow.open){const r=overflow.getBoundingClientRect();popup.style.left=Math.max(8,Math.min(r.left,innerWidth-240))+'px';popup.style.top=Math.min(r.bottom+6,innerHeight-280)+'px';popup.showPopover();}else popup.hidePopover();});
 tabs.addEventListener('click',e=>{if(e.target.closest('[data-wa-tab]'))overflow.open=false;});
 const card=$('waContactCard'),rel=disclosure('waCleanRelations','Titulares y gestores');$('waSideIdentity').after(rel);rel.lastChild.append(button('waCleanManageRelations','Gestionar',()=>profile('relations')));const rows=document.createElement('div');rows.id='waCleanRelationRows';rel.lastChild.prepend(rows);
 const offers=disclosure('waCleanOffers','Ofertas y seguimiento');offers.lastChild.innerHTML='<div id="waCleanOfferRows"></div>';offers.lastChild.append(button('waCleanManageOffers','Gestionar ofertas',()=>profile('offers')));$('waSideTasks').closest('.waSideSection').after(offers);
 $('waSideName').tabIndex=0;$('waSideName').setAttribute('role','button');$('waSideName').title='Abrir ficha del cliente';$('waSideName').onclick=()=>$('waSideOpenContact').click();$('waSideName').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('waSideOpenContact').click();}};
 const review=button('waCleanReview','＋ Revisión',async()=>{const c=contact();if(!c)return;try{await window.TPFContactReview.openForContact(c);}catch(e){alert(e.message||'No se pudo abrir la revisión.');}});card.insertBefore(review,$('waSideOpps').closest('.waSideSection'));
 for(const section of card.querySelectorAll('.waSideSection'))if(!section.querySelector('#waSideTags')&&!section.classList.contains('casCard'))fold(section);
 $('waAddTagSide').textContent='Gestionar';$('waComposerText').placeholder='Escribe un mensaje…';
 document.addEventListener('click',e=>{for(const d of view.querySelectorAll('.waCleanMore[open]'))if(!d.contains(e.target)||e.target.closest('button'))d.open=false;const nav=e.target.closest('.nav');if(nav&&nav.dataset.view!=='whatsapplive'&&full)fullscreen(false);});
 view.addEventListener('click',imagePreview,true);
 new MutationObserver(schedule).observe(card,{childList:true,subtree:true});
 new MutationObserver(schedule).observe(header,{childList:true});
 window.addEventListener('tpf:sales-updated',()=>{activeId='';schedule();});window.addEventListener('resize',fit);window.addEventListener('tpf:contact-updated',()=>{activeId='';schedule();});
 document.addEventListener('click',e=>{if(e.target.closest('.nav[data-view="whatsapplive"],#waLiveChats'))setTimeout(refresh,150);});
 refresh();
}
function schedule(){if(queued)return;queued=true;setTimeout(()=>{queued=false;refresh();},120);}
function refresh(){
 if(!view.isConnected||view.classList.contains('hidden')||!$('waClientToggle'))return;
 const draft=$('tpfWaFinalReviewOpen')||view.querySelector('.waLiveHeaderActions>button[id*="Draft"]');if(draft&&!draft.closest('#waCleanTools'))$('waCleanTools')?.lastChild.append(draft);
 const c=contact(),id=String(c?.id||'');for(const n of [$('waCleanRelations'),$('waCleanOffers'),$('waCleanReview')])if(n)n.hidden=!id;
 const actions=$('waSideContactActions'),review=$('waCleanReview');if(actions&&review&&review.parentElement!==actions)actions.append(review);
 const head=$('waContactCard')?.querySelector('.waContactHeader');if(actions&&head&&head.nextElementSibling!==actions)head.after(actions);
 const state=$('waContactState');if(state)state.dataset.compact=String(!!$('tpfWaAliasCard')&&state.textContent.trim()==='Contacto encontrado');
 const all=view.querySelector('[data-wa-tab="all"]');if(all&&all.textContent!=='Todos')all.textContent='Todos';
 const auto=$('waAutomationStatus'),offers=$('waCleanOffers');if(auto&&offers&&auto.previousElementSibling!==offers)offers.after(auto);
 organizeSide();workSummary();fit();if(!window.TPFContactRelations?.sidebarSnapshot||!window.TPFWhatsappOfferSummary){setTimeout(schedule,500);return;}if(id===activeId)return;activeId=id;const token=++revision;if(shownId!==id){shownId=id;offerRows=[];if(tabScroll.size>60)tabScroll.clear();view.querySelector('.waContactPane').scrollTop=0;}workSummary();
 $('waCleanRelationRows').textContent=id?'Cargando relaciones…':'';$('waCleanOfferRows').textContent=id?'Cargando ofertas…':'';
 if(!id)return;
 window.TPFContactRelations.sidebarSnapshot(c).then(data=>{
 if(token!==revision||String(contact()?.id||'')!==id)return;const root=$('waCleanRelationRows');root.replaceChildren();$('waCleanRelations').firstChild.textContent='Titulares y gestores · '+(data.holders.length+data.managers.length+(data.legacy?1:0));for(const [label,rows]of [['Titular',data.holders],['Gestor',data.managers]])for(const p of rows){const b=button('',p.name+' · '+label,()=>window.openContact(p.record_id));b.className='waCleanPerson';root.append(b);}if(!root.children.length)root.textContent='Sin personas asociadas.';if(data.legacy){const p=document.createElement('p');p.textContent=data.legacy+' · Titular anterior';root.append(p);}
 }).catch(()=>{if(token===revision)$('waCleanRelationRows').textContent='No se pudieron cargar las relaciones. Vuelve a abrir el chat para reintentarlo.';});
 window.TPFWhatsappOfferSummary(id).then(rows=>{if(token!==revision||String(contact()?.id||'')!==id)return;offerRows=rows;const root=$('waCleanOfferRows');root.replaceChildren();$('waCleanOffers').firstChild.textContent='Ofertas y seguimiento · '+rows.length;for(const x of rows.slice().sort((a,b)=>{const rank=x=>x.rawStatus==='error'?0:['accepted','paused'].includes(x.rawStatus)?1:x.rawStatus==='following'?2:3;return rank(a)-rank(b)})){const row=document.createElement('div');row.className='waCleanOfferRow';const title=document.createElement('b');title.textContent=x.title;const meta=document.createElement('small');meta.textContent=x.amount+' · '+x.status;row.append(title,meta);if(x.followupHtml)row.insertAdjacentHTML("beforeend",x.followupHtml);
root.append(row);}if(!rows.length)root.textContent='Sin ofertas para este contacto.';delete $('waCleanOffers').dataset.contactOpened;workSummary();}).catch(()=>{if(token===revision)$('waCleanOfferRows').textContent='No se pudieron cargar las ofertas.';});
}

function enter(){syncRail();if(view.classList.contains('hidden')||$('app')?.classList.contains('hidden'))return;install();schedule();}
// Navigation may stop click propagation; observe the actual view transition.
new MutationObserver(enter).observe(view,{attributes:true,attributeFilter:['class']});
enter();
})();
