/* Visual-only recording privacy. No data writes, requests, or message sends. */
(function(){
 'use strict';
 const root=document.documentElement,params=new URLSearchParams(location.search);
 const focus=new Set([params.get('videoContact'),...(params.get('videoOpportunity')||'').split(',')].filter(Boolean));
 const names=new Set();let layer=null,dialogLayer=null,queued=false;
 root.dataset.videoPrivatePending='1';
 const css=document.createElement('style');css.id='tpf-video-private-css';css.textContent=`
 [data-video-private-other]{visibility:hidden!important;pointer-events:none!important}
 .videoPrivateLayer{position:fixed!important;inset:0!important;pointer-events:none!important;z-index:2147483646!important;overflow:hidden!important;background:transparent!important;border:0!important;padding:0!important;margin:0!important}
 .videoPrivateMask{position:absolute;background:#e3e8ef!important;border:1px solid #d6dde6!important;border-radius:3px;pointer-events:none;box-sizing:border-box}
 .videoPrivateMask.large{background:#f4f7fa!important}
 .videoPrivateMirror{position:absolute;box-sizing:border-box;border:1px solid #d6dde6;border-radius:6px;overflow:hidden;white-space:pre-wrap;overflow-wrap:anywhere}
 .videoPrivateBadge{position:absolute;bottom:8px;left:10px;background:#172b45;color:white;padding:5px 9px;border-radius:6px;font:11px/1.3 Arial,sans-serif;box-shadow:0 1px 4px #0002}
 #view-whatsapp .waAvatar,#contactModal .cpAvatar,.tdAvatar,.tdFocusAvatar{visibility:hidden!important}
 `;document.head.appendChild(css);
 function remember(name){
  name=String(name||'').trim();if(name.length<3||/^(?:cliente|contacto|whatsapp|oferta|ofertas|seguimiento)$/i.test(name))return;names.add(name);
  for(const part of name.split(/\s+/)){if(part.length>=4&&!/^(cliente|contacto|phone|house|store|face|whatsapp|oferta|ofertas|seguimiento)$/i.test(part))names.add(part);}
 }
 function collectNames(){
  for(const e of document.querySelectorAll('#sideWho,#who,#contactName,#contactFirstName,#contactLastName,#waChatName,#waChatNickname,#waSideName,#waSideNickname,.tdClientButton b,.waChatRowTop b'))remember(e.value||e.textContent);
  document.querySelectorAll('[aria-label^="Abrir contacto:"]').forEach(e=>remember(e.getAttribute('aria-label').slice(15)));
  try{if(typeof salesCache!=='undefined')for(const o of salesCache.opportunities||[]){remember(o.client_name);for(const k of ['holder_name','manager_name','recipient_name'])remember(o.contract_party?.[k]);}}catch(_){}
  try{if(typeof currentContact!=='undefined'&&currentContact){const d=currentContact.data||{};for(const k of ['NOMBRE Y APELLIDOS','NOMBRE','APELLIDOS','APODO'])remember(d[k]);}}catch(_){}
  try{if(typeof waLiveState!=='undefined')for(const c of waLiveState.chats||[])remember(c.name);}catch(_){}
 }
 function setOther(e,hide){if(hide&&!e.hasAttribute('data-video-private-other'))e.setAttribute('data-video-private-other','');else if(!hide&&e.hasAttribute('data-video-private-other'))e.removeAttribute('data-video-private-other');}
 function filterUnrelated(){
  for(const row of document.querySelectorAll('#dashAlerts tr,.salesListRow,.cpOpp,.waSideOpp,#waSideOpps .waSideItem,.tpfInstallation tbody tr')){
   if(row.tagName==='TR'&&!row.querySelector('td'))continue;
   const ids=Array.from(row.querySelectorAll('[data-id],[data-opportunity-id],[data-of-manage],[data-of-opportunity],[data-install-manage]')).flatMap(e=>[e.dataset.id,e.dataset.opportunityId,e.dataset.ofManage,e.dataset.ofOpportunity,e.dataset.installManage]);
   ids.push(...(row.getAttribute('onclick')||'').match(/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/gi)||[]);
   const belongs=!focus.size||ids.some(id=>focus.has(id));
   setOther(row,!belongs||!/m[aá]sm[oó]vil/i.test(row.textContent));
  }
  const searchedPhone=String(document.getElementById('waLiveSearch')?.value||'').replace(/\D/g,'');
  for(const row of document.querySelectorAll('.waChatRow'))setOther(row,!row.classList.contains('active')&&!(searchedPhone.length>=9&&(row.dataset.waChatId||'').replace(/\D/g,'').includes(searchedPhone)));
  for(const msg of document.querySelectorAll('#waMessages .waMsg')){
   const bubble=msg.querySelector('.waBubble');
   const text=(bubble?Array.from(bubble.childNodes).filter(n=>n.nodeType===3).map(n=>n.nodeValue).join(''):msg.textContent).trim();
   setOther(msg,!/m[aá]sm[oó]vil|^(?:✓\s*)?(?:me interesa|no me interesa|es por el precio|instalado)\b|cu[aá]l es el motivo principal|hemos anotado tu instalaci[oó]n|devoluci[oó]n del router de yoigo/i.test(text));
  }
 }
 function rects(scope){
  const found=[];const add=(r,large=false)=>{const x=Math.max(0,r.x-2),y=Math.max(0,r.y-2),right=Math.min(innerWidth,r.right+2),bottom=Math.min(innerHeight,r.bottom+2);if(right>x&&bottom>y)found.push({x,y,w:right-x,h:bottom-y,large});};
  const cover=e=>{if(!e||!scope.contains(e)||e.closest('.videoPrivateLayer')||e.closest('[data-video-private-other]'))return;const r=e.getBoundingClientRect();if(r.width&&r.height)add(r,r.height>60);};
  const privateSelectors='#sideWho,#who,#contactName,#contactFirstName,#contactLastName,#contactPhone,#contactDni,#contactEmail,#contactIban,#contactBank,#contactNotes,#contactObs,#cpNotes,#cpObservations,#waChatName,#waChatNickname,#waChatPhone,#waSideName,#waSideNickname,#waSidePhone,#waSideDni,#waSidePhoneDetail,#tdFocusContent,#tdPendingTasks,#tdScheduledSends,#dashPriorityFollowups,#dashActivity,.waChatRowTop b,.waChatPreview,.ofClientIdentity h2,.ofIdentityGrid strong,.ofRecipientSection p,.ofProcessingCustomer,.tpfInstallationRecipient,.waAvatar,.cpAvatar';
  scope.querySelectorAll(privateSelectors).forEach(cover);
  scope.querySelectorAll('img').forEach(cover);
  for(const select of scope.querySelectorAll('select'))if(/contact|recipient|manager|titular|owner|responsable/i.test(select.id+' '+select.name+' '+select.getAttribute('aria-label')))cover(select);
  for(const input of scope.querySelectorAll('input,textarea')){
   if(!input.value||['date','time','datetime-local','checkbox','radio','number'].includes(input.type))continue;
   // Message editors remain visible only if they contain the public offer text without identifiers.
   const text=input.value;
   if(/\b(?:[6-9]\d{8}|\d{8}[A-Z])\b|@|\bES\d{2}/i.test(text)||Array.from(names).some(n=>text.includes(n))){
    if(input.tagName==='TEXTAREA'&&/m[aá]sm[oó]vil|instalaci[oó]n|devoluci[oó]n del router/i.test(text)){
     let safe=text;for(const name of Array.from(names).sort((a,b)=>b.length-a.length)){const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');safe=safe.replace(new RegExp('(?<![\\p{L}\\p{N}])'+escaped+'(?![\\p{L}\\p{N}])','giu'),'•••');}
     for(const re of [/\b(?:\+34\s?)?[6-9]\d(?:[\s.-]?\d){7}\b/g,/\b(?:\d{8}[A-Z]|[XYZ]\d{7}[A-Z])\b/gi,/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g,/\bES\d{2}(?:\s?\d){20}\b/gi])safe=safe.replace(re,'•••');
     const r=input.getBoundingClientRect(),s=getComputedStyle(input);if(r.width&&r.height&&r.bottom>0&&r.top<innerHeight)found.push({x:r.x,y:r.y,w:r.width,h:r.height,editor:safe,font:s.font,color:s.color,padding:s.padding,background:s.backgroundColor,scroll:input.scrollTop});
    }else cover(input);
   }
  }
  for(const label of scope.querySelectorAll('label'))if(/descuento|regalo|abono/i.test(label.childNodes[0]?.textContent||''))cover(label);
  const walker=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT);let node;
  const sensitive=[/\b(?:\+34\s?)?[6-9]\d(?:[\s.-]?\d){7}\b/g,/\b(?:\d{8}[A-Z]|[XYZ]\d{7}[A-Z])\b/gi,/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g,/\bES\d{2}(?:\s?\d){20}\b/gi];
  while((node=walker.nextNode())){
   const p=node.parentElement,text=node.nodeValue||'';
   if(!p||!text.trim()||p.closest('.videoPrivateLayer,[data-video-private-other]')||/SCRIPT|STYLE|OPTION|TEXTAREA/.test(p.tagName))continue;
   const r=p.getBoundingClientRect();if(!r.width||!r.height||r.bottom<=0||r.top>=innerHeight)continue;
   const matches=[];
   for(const re of sensitive)for(const m of text.matchAll(re))matches.push([m.index,m.index+m[0].length]);
   for(const name of names){let start=0;while((start=text.toLowerCase().indexOf(name.toLowerCase(),start))>=0){const end=start+name.length;if(!/[\p{L}\p{N}]/u.test(text[start-1]||'')&&!/[\p{L}\p{N}]/u.test(text[end]||''))matches.push([start,end]);start=end;}}
   for(const [start,end] of matches){const range=document.createRange();range.setStart(node,start);range.setEnd(node,end);for(const r of range.getClientRects())add(r);}
  }
  return found;
 }
 function mask(){
  queued=false;try{
   collectNames();filterUnrelated();
   const host=Array.from(document.querySelectorAll('dialog[open]')).at(-1);
   if(!layer){layer=document.createElement('div');layer.className='videoPrivateLayer';layer.setAttribute('aria-hidden','true');document.body.appendChild(layer);}
   const boxes=rects(document.body);
   function render(target,boxes){const frag=document.createDocumentFragment();
   for(const r of boxes){const b=document.createElement('div');b.className=r.editor?'videoPrivateMirror':'videoPrivateMask'+(r.large?' large':'');Object.assign(b.style,{left:r.x+'px',top:r.y+'px',width:r.w+'px',height:r.h+'px'});if(r.editor){Object.assign(b.style,{font:r.font,color:r.color,padding:r.padding,background:r.background||'white'});const t=document.createElement('div');t.textContent=r.editor;t.style.transform='translateY(-'+r.scroll+'px)';b.appendChild(t);}frag.appendChild(b);}
   const badge=document.createElement('div');badge.className='videoPrivateBadge';badge.textContent='Grabación · datos ocultos';frag.appendChild(badge);target.replaceChildren(frag);}
   render(layer,boxes);
   if(host){if(!dialogLayer||dialogLayer.parentElement!==host){dialogLayer?.remove();dialogLayer=document.createElement('div');dialogLayer.className='videoPrivateLayer';dialogLayer.setAttribute('aria-hidden','true');host.appendChild(dialogLayer);}render(dialogLayer,rects(host));}else{dialogLayer?.remove();dialogLayer=null;}
   root.dataset.videoPrivateMasks=String(boxes.length);root.dataset.videoPrivateReady='1';root.removeAttribute('data-video-private-pending');
  }catch(_){root.dataset.videoPrivatePending='1';root.removeAttribute('data-video-private-ready');}
 }
 function queue(){if(queued)return;queued=true;root.dataset.videoPrivatePending='1';queueMicrotask(mask);}
 function start(){
  const observer=new MutationObserver(changes=>{if(changes.some(c=>!c.target.closest?.('.videoPrivateLayer')&&!(c.type==='attributes'&&c.attributeName==='data-video-private-other')&&!(c.type==='childList'&&Array.from(c.addedNodes).every(n=>n.nodeType===1&&n.classList?.contains('videoPrivateLayer')))))queue();});
  observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','style','open','hidden','value']});
  document.addEventListener('scroll',queue,{capture:true,passive:true});document.addEventListener('input',queue,true);document.addEventListener('change',queue,true);window.addEventListener('resize',queue,{passive:true});
  queue();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
