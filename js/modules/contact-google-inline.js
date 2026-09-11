(function(){
'use strict';
const M=window.TPFModules;if(!M)return;
const $=id=>document.getElementById(id),ALIAS_KEY='tpf_whatsapp_names_by_phone_v1',IGNORE_KEY='tpf_whatsapp_name_ignored_v1';
const safe=v=>String(v??'').trim(),esc=v=>safe(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fold=v=>safe(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ');
const phone=v=>{let x=safe(v).replace(/\D/g,'');if(x.startsWith('00'))x=x.slice(2);if(x.startsWith('34')&&x.length===11)x=x.slice(2);return x.slice(-9)};
const field=(d,...keys)=>{for(const key of keys)if(safe(d?.[key]))return safe(d[key]);return''};
const current=()=>{try{return typeof currentContact!=='undefined'?currentContact:null}catch(_){return null}};
const selectedWa=()=>{try{return typeof waLiveState!=='undefined'?waLiveState?.selected:null}catch(_){return null}};
const matchedWa=()=>{try{return typeof waLiveState!=='undefined'?waLiveState?.contact:null}catch(_){return null}};
let activeId='',matches=[],busy=false,waSignature='',correctionRow=null,correctionMatches=[],correctionWhatsapp='',correctionReturn='profile';

function contactData(row=current()){
 const d=row?.data||{},given=field(d,'NOMBRE'),family=field(d,'APELLIDOS','APELLIDO'),legacy=field(d,'NOMBRE Y APELLIDOS','CLIENTE','CLIENTE FINAL');
 return{id:safe(row?.id),name:[given,family].filter(Boolean).join(' ')||legacy||'Contacto',nickname:field(d,'APODO','Apodo','ALIAS'),phone:field(d,'TELÉFONO','TELEFONO','PHONE','MOVIL'),email:field(d,'EMAIL','Email','email','CORREO'),dni:field(d,'DNI / NIF','DNI','NIF')};
}
function validWaName(v){const x=fold(v);return !!x&&!['no name','noname','desconocido','unknown','contacto','sin nombre'].includes(x)&&!/^[+\d\s().-]+$/.test(safe(v))}
function readAliases(){try{return JSON.parse(localStorage.getItem(ALIAS_KEY)||'{}')||{}}catch(_){return{}}}
function ignoredNames(){try{return JSON.parse(localStorage.getItem(IGNORE_KEY)||'{}')||{}}catch(_){return{}}}
function ignoreName(chat,name,on=true){const map=ignoredNames(),key=phone(chat?.id);if(!key)return;if(on)map[key]=safe(name);else delete map[key];try{localStorage.setItem(IGNORE_KEY,JSON.stringify(map))}catch(_){}waSignature=''}
function rememberWhatsapp(){
 let chats=[];try{chats=[...(waLiveState?.chats||[])];if(selectedWa())chats.push(selectedWa())}catch(_){}
 const map=readAliases(),now=new Date().toISOString();let changed=false;
 chats.forEach(chat=>{const p=phone(chat?.id),name=safe(chat?.name);if(!p||!validWaName(name)||map[p]?.name===name)return;map[p]={name,at:now};changed=true});if(!changed)return;
 const entries=Object.entries(map).sort((a,b)=>safe(b[1]?.at).localeCompare(safe(a[1]?.at))).slice(0,2500);
 try{localStorage.setItem(ALIAS_KEY,JSON.stringify(Object.fromEntries(entries)))}catch(_){}
}
function whatsappName(c){
 const chat=selectedWa(),linked=matchedWa();if(linked&&String(linked.id)===String(c.id)&&phone(chat?.id)===phone(c.phone)&&validWaName(chat?.name))return safe(chat.name);
 const saved=readAliases()[phone(c.phone)]?.name;return validWaName(saved)?safe(saved):'';
}
function googleView(person){
 const name=person?.names?.find(x=>x?.metadata?.primary)?.displayName||person?.names?.[0]?.displayName||'';
 const nickname=person?.nicknames?.[0]?.value||'';return{name:safe(name),nickname:safe(nickname),resourceName:safe(person?.resourceName)};
}
async function searchGoogle(c){
 if(!safe(sessionStorage.getItem('tpf_google_contacts_token')))return[];
 const found=new Map();
 for(const query of [c.phone,c.email].filter(Boolean)){
  const qs=new URLSearchParams({query,readMask:'names,nicknames,emailAddresses,phoneNumbers,userDefined,metadata',pageSize:'30'});
  const data=await googleApi('people:searchContacts?'+qs.toString());
  (data.results||[]).forEach(item=>{const p=item.person||{},phones=(p.phoneNumbers||[]).map(x=>phone(x.canonicalForm||x.value)),emails=(p.emailAddresses||[]).map(x=>fold(x.value));if((phone(c.phone)&&phones.includes(phone(c.phone)))||(fold(c.email)&&emails.includes(fold(c.email))))found.set(p.resourceName,p)});
 }
 return[...found.values()];
}
function ensureStyles(){if($('tpfGoogleInlineStyles'))return;const s=document.createElement('style');s.id='tpfGoogleInlineStyles';s.textContent=`
 #tpfGoogleInlineCard,#tpfWaAliasCard{border:1px solid #d0d5dd;border-radius:12px;padding:12px;background:#fff;margin:0 0 12px;color:#344054}
 #tpfGoogleInlineCard h4,#tpfWaAliasCard h4{margin:0 0 7px;font-size:13px}#tpfGoogleInlineCard p,#tpfWaAliasCard p{margin:4px 0;font-size:11px;line-height:1.4;color:#667085}
 .tpfGoogleInlineStatus{display:inline-flex;padding:3px 7px;border-radius:999px;background:#eff8ff;color:#175cd3;font-size:10px;font-weight:750}.tpfGoogleInlineStatus.ok{background:#ecfdf3;color:#027a48}.tpfGoogleInlineStatus.warn{background:#fff4e5;color:#b54708}
 .tpfGoogleInlineActions{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}.tpfGoogleInlineActions button{padding:6px 8px;font-size:10px;cursor:pointer}
 .tpfInlineBack{position:fixed;inset:0;z-index:280000;display:grid;place-items:center;padding:16px;background:#101828b8}.tpfInlineBack.hidden{display:none!important}.tpfInlineModal{width:min(660px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:16px;box-shadow:0 24px 80px #0006}.tpfInlineModal header{display:flex;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid #e4e7ec}.tpfInlineModal h3{margin:0}.tpfInlineModal header button{width:34px;height:34px;border:0;border-radius:50%;font-size:20px}.tpfInlineBody{padding:16px 18px}.tpfInlineSource{padding:10px;border-radius:9px;background:#f2f4f7;margin-bottom:12px;font-size:11px}.tpfInlineSource b{display:block;margin-bottom:3px}.tpfInlineGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.tpfInlineGrid label{display:flex;flex-direction:column;gap:5px;font-size:11px}.tpfInlineGrid label.full{grid-column:1/-1}.tpfInlineGrid input,.tpfInlineGrid select{width:100%;box-sizing:border-box}.tpfInlineMsg{min-height:18px;margin-top:10px;font-size:11px;color:#475467}.tpfInlineModal footer{display:flex;justify-content:flex-end;gap:8px;padding:14px 18px;border-top:1px solid #e4e7ec}@media(max-width:650px){.tpfInlineGrid{grid-template-columns:1fr}}
 `;document.head.appendChild(s)}
function ensureModal(){let back=$('tpfInlineBack');if(back)return back;back=document.createElement('div');back.id='tpfInlineBack';back.className='tpfInlineBack hidden';back.innerHTML=`<section class="tpfInlineModal" role="dialog" aria-modal="true"><header><div><small>CORREGIR CONTACTO</small><h3>Nombre y apodo</h3></div><button id="tpfInlineClose" type="button">×</button></header><div class="tpfInlineBody"><div id="tpfInlineSource" class="tpfInlineSource"></div><div class="tpfInlineGrid"><label class="full">Contacto de Google<select id="tpfInlineGoogle"></select></label><label>Nombre<input id="tpfInlineFirst" autocomplete="given-name"></label><label>Apellidos<input id="tpfInlineLast" autocomplete="family-name"></label><label class="full">Apodo<input id="tpfInlineNickname" placeholder="Nombre que quieres ver en llamadas"></label></div><div id="tpfInlineMsg" class="tpfInlineMsg"></div></div><footer><button id="tpfInlineCancel" class="secondary" type="button">Cancelar</button><button id="tpfInlineSave" class="primary" type="button">Guardar en CRM y Google</button></footer></section>`;document.body.appendChild(back);const close=()=>back.classList.add('hidden');$('tpfInlineClose').onclick=close;$('tpfInlineCancel').onclick=close;back.onclick=e=>{if(e.target===back)close()};$('tpfInlineSave').onclick=saveCorrection;return back}
function splitName(name){const parts=safe(name).split(/\s+/).filter(Boolean);return{first:parts.shift()||'',last:parts.join(' ')}}
function openCorrection(options={}){
 const row=options.row||current(),c=contactData(row),wa=options.whatsapp??whatsappName(c),available=options.matches||matches,parts=splitName(c.name),back=ensureModal(),select=$('tpfInlineGoogle');
 correctionRow=row;correctionMatches=available;correctionWhatsapp=wa;correctionReturn=options.returnTo||'profile';
 $('tpfInlineFirst').value=field(row?.data||{},'NOMBRE')||parts.first;$('tpfInlineLast').value=field(row?.data||{},'APELLIDOS','APELLIDO')||parts.last;$('tpfInlineNickname').value=c.nickname||wa;
 $('tpfInlineSource').innerHTML=`<b>Nombre detectado en WhatsApp</b>${esc(wa||'Todavía no hay un nombre válido detectado')}<br><b style="margin-top:7px">CRM actual</b>${esc(c.name)}${c.nickname?` · Apodo: ${esc(c.nickname)}`:''}`;
 select.innerHTML=available.length?available.map((p,i)=>{const g=googleView(p);return`<option value="${i}">${esc(g.name||'Contacto Google')}${g.nickname?` · Apodo: ${esc(g.nickname)}`:''}</option>`}).join(''):'<option value="">Crear un contacto nuevo en Google</option>';
 $('tpfInlineMsg').textContent=available.length>1?'Hay varios contactos de Google: elige cuál es el correcto.':'';back.classList.remove('hidden');
}
async function openWhatsappCorrection(row,name){let found=[];try{found=await searchGoogle(contactData(row))}catch(_){}openCorrection({row,whatsapp:name,matches:found,returnTo:'whatsapp'})}
async function detailedPerson(person){if(!person?.resourceName)return null;const qs=new URLSearchParams({personFields:'names,nicknames,emailAddresses,phoneNumbers,userDefined,metadata'});return googleApi(person.resourceName+'?'+qs.toString())}
function replaceDni(items,dni){const keys=['dni','nif','dni / nif','dni/nif','documento','documento de identidad'],kept=(items||[]).filter(x=>!keys.includes(fold(x.key)));if(dni)kept.push({key:'DNI / NIF',value:dni});return kept}
async function writeGoogle(person,c,first,last,nickname){
 if(!safe(sessionStorage.getItem('tpf_google_contacts_token')))return{skipped:true};
 const body={names:[{givenName:first,familyName:last}],nicknames:nickname?[{value:nickname,type:'DEFAULT'}]:[],phoneNumbers:c.phone?[{value:c.phone,type:'mobile'}]:[],emailAddresses:c.email?[{value:c.email,type:'work'}]:[],userDefined:replaceDni([],c.dni)};
 if(!person)return googleApi('people:createContact?personFields=names,nicknames,emailAddresses,phoneNumbers,userDefined',{method:'POST',body:JSON.stringify(body)});
 const full=await detailedPerson(person);body.resourceName=full.resourceName;body.etag=full.etag;body.phoneNumbers=full.phoneNumbers?.length?full.phoneNumbers.map(x=>({value:x.value,type:x.type||'mobile'})):body.phoneNumbers;body.emailAddresses=full.emailAddresses?.length?full.emailAddresses.map(x=>({value:x.value,type:x.type||'work'})):body.emailAddresses;body.userDefined=replaceDni(full.userDefined,c.dni).map(x=>({key:x.key,value:x.value}));
 return googleApi(full.resourceName+':updateContact?updatePersonFields=names,nicknames,emailAddresses,phoneNumbers,userDefined&personFields=names,nicknames,emailAddresses,phoneNumbers,userDefined',{method:'PATCH',body:JSON.stringify(body)});
}
async function writeCrm(row,first,last,nickname){const d={...(row.data||{})},name=[first,last].filter(Boolean).join(' ').trim();d.NOMBRE=first;d.APELLIDOS=last;d['NOMBRE Y APELLIDOS']=name;d.APODO=nickname;const r=await sb.from('records').update({data:d}).eq('id',row.id);if(r.error)throw r.error;row.data=d;return d}
async function saveCorrection(){
 if(busy)return;const row=correctionRow||current(),available=correctionMatches,c=contactData(row),first=safe($('tpfInlineFirst').value),last=safe($('tpfInlineLast').value),nickname=safe($('tpfInlineNickname').value),msg=$('tpfInlineMsg'),btn=$('tpfInlineSave');if(!row||(!first&&!last)){msg.textContent='Escribe el nombre correcto.';return}
 busy=true;btn.disabled=true;msg.textContent='Guardando…';try{await writeCrm(row,first,last,nickname);const person=available[Number($('tpfInlineGoogle').value)]||null;await writeGoogle(person,{...c,name:[first,last].filter(Boolean).join(' ')},first,last,nickname);msg.textContent=safe(sessionStorage.getItem('tpf_google_contacts_token'))?'Guardado en CRM y Google.':'Guardado en CRM. Conecta Google para sincronizarlo.';window.dispatchEvent(new CustomEvent('tpf:contact-updated',{detail:{id:row.id}}));setTimeout(()=>{$('tpfInlineBack').classList.add('hidden');if(correctionReturn==='whatsapp'){waSignature='';refreshWhatsapp()}else window.openContact?.(row.id)},550)}catch(e){msg.textContent=e?.message||'No se pudo guardar.'}finally{busy=false;btn.disabled=false}
}
async function refreshProfile(){
 const row=current(),root=document.querySelector('#contactModal .cpRight');if(!row||!root||$('contactModal')?.classList.contains('hidden'))return;activeId=String(row.id);let card=$('tpfGoogleInlineCard');if(!card){card=document.createElement('section');card.id='tpfGoogleInlineCard';root.prepend(card)}const c=contactData(row),wa=whatsappName(c),connected=!!safe(sessionStorage.getItem('tpf_google_contacts_token'));card.innerHTML=`<h4>Google y WhatsApp</h4><span class="tpfGoogleInlineStatus">Comprobando…</span><p>${wa?`WhatsApp muestra: <b>${esc(wa)}</b>`:'Abre su conversación para detectar el nombre actual de WhatsApp.'}</p>`;
 if(!connected){matches=[];card.innerHTML=`<h4>Google y WhatsApp</h4><span class="tpfGoogleInlineStatus warn">Google no conectado</span><p>${wa?`WhatsApp muestra: <b>${esc(wa)}</b>`:'Todavía no se ha detectado su nombre de WhatsApp.'}</p><div class="tpfGoogleInlineActions"><button id="tpfInlineEdit" class="primary" type="button">Corregir nombre y apodo</button><button id="tpfInlineConnect" class="secondary" type="button">Conectar Google</button></div>`;$('tpfInlineEdit').onclick=openCorrection;$('tpfInlineConnect').onclick=()=>connectGoogleContacts();return}
 try{matches=await searchGoogle(c);if(activeId!==String(current()?.id||''))return;const status=matches.length===0?'No está en Google':matches.length===1?'Contacto localizado':'Posibles duplicados';const cls=matches.length===1?'ok':'warn';const google=matches.length===1?googleView(matches[0]):null;card.innerHTML=`<h4>Google y WhatsApp</h4><span class="tpfGoogleInlineStatus ${cls}">${esc(status)}</span><p>CRM: <b>${esc(c.name)}</b>${c.nickname?` · Apodo: ${esc(c.nickname)}`:''}</p>${google?`<p>Google: <b>${esc(google.name)}</b>${google.nickname?` · Apodo: ${esc(google.nickname)}`:''}</p>`:''}<p>${wa?`WhatsApp: <b>${esc(wa)}</b>`:'WhatsApp: nombre aún no detectado'}</p><div class="tpfGoogleInlineActions"><button id="tpfInlineEdit" class="primary" type="button">Corregir aquí</button></div>`;$('tpfInlineEdit').onclick=openCorrection}catch(e){card.innerHTML=`<h4>Google y WhatsApp</h4><span class="tpfGoogleInlineStatus warn">No se pudo comprobar</span><p>${esc(e?.message||'Vuelve a conectar Google Contacts.')}</p><div class="tpfGoogleInlineActions"><button id="tpfInlineEdit" class="primary" type="button">Corregir en CRM</button></div>`;$('tpfInlineEdit').onclick=openCorrection}
}
function refreshWhatsapp(){
 rememberWhatsapp();
 const chat=selectedWa(),row=matchedWa(),host=$('waContactCard');
 if(!chat||!host||String(chat.id||'').includes('@g.us'))return $('tpfWaAliasCard')?.remove();
 const c=contactData(row),preferred=row?(c.nickname||c.name):'';
 if(preferred){
  if($('waChatName'))$('waChatName').textContent=preferred;
  const active=document.querySelector('.waChatRow.active .waChatRowTop b');if(active)active.textContent=preferred;
 }
 const name=safe(chat.name);
 let card=$('tpfWaAliasCard');if(!card){card=document.createElement('section');card.id='tpfWaAliasCard';const state=$('waContactState');state?.insertAdjacentElement('afterend',card)}if(!card)return;
 const ignored=ignoredNames()[phone(chat.id)]===name;
 if(ignored){const signature=['ignored',safe(chat.id),name].join('|');if(signature===waSignature&&card.innerHTML)return;waSignature=signature;card.innerHTML=`<h4>Nombre de WhatsApp ignorado</h4><p><b>${esc(name)}</b> no se aplicará.</p><div class="tpfGoogleInlineActions"><button id="tpfWaReviewAgain" class="secondary" type="button">Revisar de nuevo</button></div>`;$('tpfWaReviewAgain').onclick=()=>{ignoreName(chat,name,false);refreshWhatsapp()};return}
 if(!validWaName(name)){
  if(!row)return card.remove();
  const signature=['invalid',safe(chat.id),safe(row.id),c.name,c.nickname].join('|');if(signature===waSignature&&card.innerHTML)return;waSignature=signature;
  card.innerHTML=`<h4>Nombre sin identificar</h4><p>WhatsApp muestra <b>${esc(name||'No Name')}</b>. En el CRM figura <b>${esc(c.name)}</b>.</p><div class="tpfGoogleInlineActions"><button id="tpfWaFixGoogle" class="primary" type="button">Corregir Google con datos del CRM</button></div><p id="tpfWaFixGoogleMsg"></p>`;
  const fix=$('tpfWaFixGoogle');fix.onclick=async()=>{const msg=$('tpfWaFixGoogleMsg');fix.disabled=true;msg.textContent='Buscando el contacto en Google…';try{const gm=await searchGoogle(c);if(gm.length===0)throw new Error('No se ha encontrado en Google por teléfono o correo.');if(gm.length>1)throw new Error('Hay varios contactos con ese teléfono. Revísalos desde la ficha completa.');const parts=splitName(c.name);await writeGoogle(gm[0],c,field(row.data,'NOMBRE')||parts.first,field(row.data,'APELLIDOS','APELLIDO')||parts.last,c.nickname);msg.textContent='Google corregido correctamente.'}catch(e){msg.textContent=e?.message||'No se pudo corregir Google.'}finally{fix.disabled=false}};
  return;
 }
 const same=fold(name)===fold(c.nickname),signature=[safe(chat.id),safe(row?.id),name,c.nickname].join('|');if(signature===waSignature&&card.innerHTML)return;waSignature=signature;
 card.innerHTML=`<h4>Nombre actual de WhatsApp</h4><p><b>${esc(name)}</b>${row?(same?' · Ya está guardado como apodo.':' · Decide cómo quieres guardarlo.'):' · Todavía no existe una ficha vinculada.'}</p><div class="tpfGoogleInlineActions">${row&&!same?'<button id="tpfWaUseAlias" class="primary" type="button">Aceptar como apodo</button>':''}${row?'<button id="tpfWaCorrectName" class="secondary" type="button">Corregir y ver resultado</button>':'<button id="tpfWaCreateReview" class="primary" type="button">Aceptar y crear ficha</button>'}<button id="tpfWaIgnoreName" class="secondary" type="button">Ignorar</button></div>`;
 const btn=$('tpfWaUseAlias');if(btn)btn.onclick=async()=>{btn.disabled=true;try{const d={...(row.data||{}),APODO:name},r=await sb.from('records').update({data:d}).eq('id',row.id);if(r.error)throw r.error;row.data=d;let gm=[];try{gm=await searchGoogle(contactData(row));if(gm.length===1)await writeGoogle(gm[0],contactData(row),field(d,'NOMBRE')||splitName(contactData(row).name).first,field(d,'APELLIDOS')||splitName(contactData(row).name).last,name)}catch(_){}waSignature='';refreshWhatsapp()}catch(e){alert(e?.message||'No se pudo guardar el apodo.')}finally{btn.disabled=false}}
 const correct=$('tpfWaCorrectName');if(correct)correct.onclick=()=>openWhatsappCorrection(row,name);
 const create=$('tpfWaCreateReview');if(create)create.onclick=()=>window.createWaContact?.();
 const ignore=$('tpfWaIgnoreName');if(ignore)ignore.onclick=()=>{ignoreName(chat,name,true);refreshWhatsapp()};
}
function install(){ensureStyles();ensureModal();window.addEventListener('tpf:contact-open',()=>setTimeout(refreshProfile,0));window.addEventListener('tpf:contact-updated',()=>setTimeout(refreshProfile,80));window.addEventListener('tpf:wa-chat-changing',()=>{waSignature='';setTimeout(refreshWhatsapp,350)});setInterval(()=>{const view=$('view-whatsapplive');if(view&&!view.classList.contains('hidden'))refreshWhatsapp()},2000);window.TPFContactGoogleInline={refreshProfile,refreshWhatsapp}}
M.register('contact-google-inline',{install});
})();
