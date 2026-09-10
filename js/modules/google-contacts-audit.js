(function(){
'use strict';
const M=window.TPFModules;if(!M)return;
const $=id=>document.getElementById(id),SOURCES=['BASE DE DATOS','DATA','CONTACTOS'],PAGE_SIZE=100;
const REVIEW_KEY='tpf_google_contacts_review_v1';
const state={rows:[],filter:'all',query:'',page:1,running:false,decisions:{}};
const safe=value=>String(value??'').trim();
const esc=value=>safe(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fold=value=>safe(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ');
const phone=value=>{let digits=safe(value).replace(/\D/g,'');if(digits.startsWith('00'))digits=digits.slice(2);if(digits.startsWith('34')&&digits.length===11)digits=digits.slice(2);return digits.length>=7?digits:''};
const email=value=>safe(value).toLowerCase();
function first(data,...keys){for(const key of keys){const value=data?.[key];if(value!==undefined&&value!==null&&safe(value))return safe(value)}return''}
function crmContact(row){
 const data=row?.data||{},given=first(data,'NOMBRE'),family=first(data,'APELLIDOS','APELLIDO'),legacy=first(data,'NOMBRE Y APELLIDOS','CLIENTE','CLIENTE FINAL');
 return{id:safe(row?.id),name:[given,family].filter(Boolean).join(' ')||legacy||'Contacto',nickname:first(data,'APODO','Apodo','ALIAS'),phones:[first(data,'TELÉFONO','TELEFONO','PHONE','MOVIL')].map(phone).filter(Boolean),emails:[first(data,'EMAIL','Email','email')].map(email).filter(Boolean)};
}
function googleContact(person){
 const name=person?.names?.find(item=>item?.metadata?.primary)?.displayName||person?.names?.[0]?.displayName||[person?.names?.[0]?.givenName,person?.names?.[0]?.familyName].filter(Boolean).join(' ')||'Contacto de Google';
 return{id:safe(person?.resourceName),name:safe(name),nickname:safe(person?.nicknames?.[0]?.value),phones:(person?.phoneNumbers||[]).map(item=>phone(item?.canonicalForm||item?.value)).filter(Boolean),emails:(person?.emailAddresses||[]).map(item=>email(item?.value)).filter(Boolean)};
}
function keys(contact){return [...contact.phones.map(value=>'p:'+value),...contact.emails.map(value=>'e:'+value)]}
function indexByKeys(rows){const map=new Map();rows.forEach(row=>keys(row).forEach(key=>{if(!map.has(key))map.set(key,new Set());map.get(key).add(row)}));return map}
function candidates(contact,index){const out=new Set();keys(contact).forEach(key=>index.get(key)?.forEach(row=>out.add(row)));return [...out]}
function validAlias(value){const x=fold(value);return !!x&&!['no name','noname','desconocido','unknown','contacto','sin nombre'].includes(x)&&!/^[+\d\s().-]+$/.test(safe(value))}
function proposal(crm,google){
 const sameName=fold(crm.name)===fold(google.name),sameNickname=fold(crm.nickname)===fold(google.nickname);
 if(sameName&&(sameNickname||!crm.nickname||!google.nickname))return'Datos principales coinciden';
 if(!sameName&&validAlias(google.name)&&!crm.nickname)return`Poner “${google.name}” como apodo y “${crm.name}” como nombre`;
 if(!sameName)return`Revisar nombre; el CRM propone “${crm.name}”`;
 return'Revisar el apodo antes de sincronizar';
}
function compare(crmRows,googleRows){
 const gIndex=indexByKeys(googleRows),cIndex=indexByKeys(crmRows),matchedGoogle=new Set(),result=[];
 crmRows.forEach(crm=>{
  const matches=candidates(crm,gIndex),ambiguous=matches.length!==1||keys(crm).some(key=>(cIndex.get(key)?.size||0)>1||(gIndex.get(key)?.size||0)>1);
  if(!matches.length){result.push({kind:'crm_only',crm,google:null,action:'Crear en Google cuando se apruebe'});return}
  matches.forEach(item=>matchedGoogle.add(item.id));const google=matches[0];
  if(ambiguous){result.push({kind:'duplicate',crm,google,action:'Revisión manual: hay varias coincidencias'});return}
  const action=proposal(crm,google),kind=action==='Datos principales coinciden'?'match':'conflict';result.push({kind,crm,google,action});
 });
 googleRows.filter(item=>!matchedGoogle.has(item.id)).forEach(google=>result.push({kind:'google_only',crm:null,google,action:'Solo en Google; no se modificará'}));
 return result;
}
async function loadCrm(){
 const rows=[],size=1000;for(let from=0;;from+=size){const res=await sb.from('records').select('id,data,source_sheet').in('source_sheet',SOURCES).range(from,from+size-1);if(res.error)throw res.error;const chunk=res.data||[];rows.push(...chunk);if(chunk.length<size)break}return rows.map(crmContact);
}
async function loadGoogle(){
 if(typeof googleApi!=='function')throw Error('Google Contacts no está disponible.');
 const rows=[];let pageToken='';do{const query=new URLSearchParams({personFields:'names,nicknames,emailAddresses,phoneNumbers,metadata',pageSize:'1000',sortOrder:'FIRST_NAME_ASCENDING'});query.append('sources','READ_SOURCE_TYPE_CONTACT');if(pageToken)query.set('pageToken',pageToken);const data=await googleApi('people/me/connections?'+query);rows.push(...(data.connections||[]));pageToken=data.nextPageToken||'';if(rows.length>50000)throw Error('Hay demasiados contactos para una sola comprobación.')}while(pageToken);return rows.map(googleContact).filter(item=>item.id&&keys(item).length);
}
function label(kind){return{all:'Todos',match:'Coinciden',conflict:'Datos diferentes',crm_only:'Solo CRM',google_only:'Solo Google',duplicate:'Duplicados'}[kind]||kind}
function rowKey(row){return[row.kind,row.crm?.id||'',row.google?.id||''].join(':')}
function loadDecisions(){try{const saved=JSON.parse(sessionStorage.getItem(REVIEW_KEY)||'{}');state.decisions=saved&&typeof saved==='object'?saved:{}}catch(_){state.decisions={}}}
function saveDecisions(){try{sessionStorage.setItem(REVIEW_KEY,JSON.stringify(state.decisions))}catch(_){}}
function setDecision(row,decision){state.decisions[rowKey(row)]={decision,at:new Date().toISOString()};saveDecisions();render()}
function reviewSummary(){
 const values=Object.values(state.decisions),ready=values.filter(item=>item?.decision==='ready').length,ignored=values.filter(item=>item?.decision==='ignore'||item?.decision==='keep_google').length,reviewed=values.filter(item=>item?.decision==='reviewed').length;
 return{ready,ignored,reviewed,total:ready+ignored+reviewed};
}
function reviewActions(row){
 const decision=state.decisions[rowKey(row)]?.decision||'',view=`<button type="button" class="gcaAction secondary" data-gca-action="view" data-gca-key="${esc(rowKey(row))}">Ver comparación</button>`;
 if(row.kind==='match')return view;
 if(row.kind==='duplicate')return`${view}<button type="button" class="gcaAction ${decision==='reviewed'?'selected':''}" data-gca-action="reviewed" data-gca-key="${esc(rowKey(row))}">${decision==='reviewed'?'Revisado':'Marcar revisado'}</button>`;
 if(row.kind==='google_only')return`${view}<button type="button" class="gcaAction ${decision==='keep_google'?'selected':''}" data-gca-action="keep_google" data-gca-key="${esc(rowKey(row))}">${decision==='keep_google'?'Se dejará en Google':'Dejar solo en Google'}</button>`;
 const readyText=row.kind==='crm_only'?'Marcar para crear':'Marcar para aprobar';
 return`${view}<button type="button" class="gcaAction ${decision==='ready'?'selected':''}" data-gca-action="ready" data-gca-key="${esc(rowKey(row))}">${decision==='ready'?'Preparado':readyText}</button><button type="button" class="gcaAction danger ${decision==='ignore'?'selected':''}" data-gca-action="ignore" data-gca-key="${esc(rowKey(row))}">${decision==='ignore'?'Ignorado':'Ignorar'}</button>`;
}
function filtered(){const q=fold(state.query);return state.rows.filter(row=>(state.filter==='all'||row.kind===state.filter)&&(!q||fold([row.crm?.name,row.crm?.nickname,row.google?.name,row.google?.nickname,row.crm?.phones,row.google?.phones,row.action].join(' ')).includes(q)))}
function render(){
 const rows=filtered(),pages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));state.page=Math.min(state.page,pages);const shown=rows.slice((state.page-1)*PAGE_SIZE,state.page*PAGE_SIZE),body=$('gcaRows');
 document.querySelectorAll('[data-gca-filter]').forEach(button=>{const count=button.dataset.gcaFilter==='all'?state.rows.length:state.rows.filter(row=>row.kind===button.dataset.gcaFilter).length;button.querySelector('b').textContent=count;button.classList.toggle('active',button.dataset.gcaFilter===state.filter)});
 const summary=reviewSummary();$('gcaDecisionSummary').innerHTML=`<b>${summary.ready} preparados</b> · ${summary.ignored} ignorados · ${summary.reviewed} revisados <span>Ningún cambio se aplicará.</span>`;$('gcaClearReviews').disabled=!summary.total;
 $('gcaResult').textContent=`${rows.length} resultado${rows.length===1?'':'s'}`;$('gcaPage').textContent=`Página ${state.page} de ${pages}`;$('gcaPrev').disabled=state.page<=1;$('gcaNext').disabled=state.page>=pages;
 body.innerHTML=shown.map(row=>`<tr><td><span class="gcaBadge ${esc(row.kind)}">${esc(label(row.kind))}</span></td><td><b>${esc(row.crm?.name||'—')}</b>${row.crm?.nickname?`<small>Apodo: ${esc(row.crm.nickname)}</small>`:''}</td><td><b>${esc(row.google?.name||'—')}</b>${row.google?.nickname?`<small>Apodo: ${esc(row.google.nickname)}</small>`:''}</td><td>${esc(row.crm?.phones?.[0]||row.google?.phones?.[0]||'—')}</td><td>${esc(row.action)}</td><td><div class="gcaActions">${reviewActions(row)}</div></td></tr>`).join('')||'<tr><td colspan="6" class="gcaEmpty">No hay resultados con este filtro.</td></tr>';
 body.querySelectorAll('[data-gca-action]').forEach(button=>{button.onclick=event=>{event.preventDefault();event.stopPropagation();const row=state.rows.find(item=>rowKey(item)===button.dataset.gcaKey);if(!row)return;if(button.dataset.gcaAction==='view'){showComparison(row);return}setDecision(row,button.dataset.gcaAction)}});
}
function showComparison(row){
 const detail=$('gcaDetail');if(!detail)return;$('gcaDetailTitle').textContent=label(row.kind);$('gcaDetailProposal').textContent=row.action;
 const value=(contact,key)=>{const raw=contact?.[key];if(Array.isArray(raw))return raw.join(', ')||'—';return safe(raw)||'—'};
 $('gcaDetailRows').innerHTML=[['Nombre','name'],['Apodo','nickname'],['Teléfono','phones'],['Correo','emails']].map(([title,key])=>`<tr><th>${title}</th><td>${esc(value(row.crm,key))}</td><td>${esc(value(row.google,key))}</td></tr>`).join('');detail.classList.remove('hidden');
}
function modal(){
 let back=$('gcaBack');if(back)return back;back=document.createElement('div');back.id='gcaBack';back.className='gcaBack hidden';back.innerHTML=`<section class="gcaModal" role="dialog" aria-modal="true" aria-labelledby="gcaTitle"><header><div><span>COMPROBACIÓN SEGURA · SOLO LECTURA</span><h2 id="gcaTitle">CRM y Google Contacts</h2><p>No se creará, editará ni borrará ningún contacto.</p></div><button id="gcaClose" type="button" aria-label="Cerrar">×</button></header><div id="gcaLoading" class="gcaLoading hidden"><b>Comparando contactos…</b><span>Puede tardar según la cantidad guardada en Google.</span></div><div id="gcaContent" class="hidden"><div class="gcaStats">${['all','match','conflict','crm_only','google_only','duplicate'].map(kind=>`<button type="button" data-gca-filter="${kind}"><span>${label(kind)}</span><b>0</b></button>`).join('')}</div><div class="gcaReviewBar"><div id="gcaDecisionSummary"></div><button id="gcaClearReviews" class="secondary" type="button">Borrar marcas</button></div><div class="gcaTools"><input id="gcaSearch" type="search" placeholder="Buscar nombre, apodo o teléfono"><span id="gcaResult"></span></div><div class="gcaTableWrap"><table><thead><tr><th>Estado</th><th>CRM</th><th>Google</th><th>Teléfono</th><th>Resultado propuesto</th><th>Revisión local</th></tr></thead><tbody id="gcaRows"></tbody></table></div><footer><button id="gcaPrev" class="secondary" type="button">Anterior</button><span id="gcaPage"></span><button id="gcaNext" class="secondary" type="button">Siguiente</button></footer></div><div id="gcaError" class="gcaError hidden"></div></section><div id="gcaDetail" class="gcaDetailBack hidden"><section class="gcaDetailCard" role="dialog" aria-modal="true" aria-labelledby="gcaDetailTitle"><header><div><span>DETALLE SIN MODIFICACIONES</span><h3 id="gcaDetailTitle"></h3></div><button id="gcaDetailClose" type="button" aria-label="Cerrar">×</button></header><table><thead><tr><th>Dato</th><th>CRM</th><th>Google</th></tr></thead><tbody id="gcaDetailRows"></tbody></table><div class="gcaProposal"><b>Resultado propuesto</b><span id="gcaDetailProposal"></span></div><footer><button id="gcaDetailOk" class="primary" type="button">Cerrar comparación</button></footer></section></div>`;document.body.appendChild(back);
 $('gcaClose').onclick=()=>back.classList.add('hidden');back.addEventListener('click',event=>{if(event.target===back)back.classList.add('hidden')});
 back.querySelectorAll('[data-gca-filter]').forEach(button=>button.onclick=()=>{state.filter=button.dataset.gcaFilter;state.page=1;render()});$('gcaSearch').oninput=event=>{state.query=event.target.value;state.page=1;render()};$('gcaPrev').onclick=()=>{state.page=Math.max(1,state.page-1);render()};$('gcaNext').onclick=()=>{state.page++;render()};
 $('gcaClearReviews').onclick=()=>{state.decisions={};saveDecisions();render()};const closeDetail=()=>$('gcaDetail').classList.add('hidden');$('gcaDetailClose').onclick=closeDetail;$('gcaDetailOk').onclick=closeDetail;$('gcaDetail').onclick=event=>{if(event.target===$('gcaDetail'))closeDetail()};return back;
}
async function run(){
 if(state.running)return;const back=modal();back.classList.remove('hidden');$('gcaError').classList.add('hidden');$('gcaContent').classList.add('hidden');$('gcaLoading').classList.remove('hidden');state.running=true;
 try{const [crm,google]=await Promise.all([loadCrm(),loadGoogle()]);state.rows=compare(crm,google);state.filter='all';state.query='';state.page=1;$('gcaSearch').value='';render();$('gcaContent').classList.remove('hidden')}
 catch(error){$('gcaError').textContent=(error?.message||'No se pudo completar la comparación.')+' Comprueba que Google Contacts figure como conectado.';$('gcaError').classList.remove('hidden')}
 finally{$('gcaLoading').classList.add('hidden');state.running=false}
}
function styles(){if($('gcaStyles'))return;const style=document.createElement('style');style.id='gcaStyles';style.textContent=`.gcaSettingsBox{display:flex;align-items:flex-start;flex-direction:column;gap:10px;margin-top:16px;padding:14px 0 42px;border-top:1px solid #e3e8ef}.gcaSettingsBox p{margin:3px 0}.gcaSettingsBox #googleContactsAuditBtn{display:inline-flex!important;position:relative;z-index:2}.gcaBack{position:fixed;inset:0;z-index:260000;display:grid;place-items:center;padding:18px;background:#101828b8}.gcaBack.hidden{display:none}.gcaModal{width:min(1280px,100%);height:min(94vh,900px);max-height:94vh;display:flex;flex-direction:column;overflow:hidden;border-radius:16px;background:#fff;box-shadow:0 28px 90px #0006}.gcaModal>header,.gcaDetailCard>header{display:flex;flex:0 0 auto;justify-content:space-between;gap:14px;padding:18px 20px;border-bottom:1px solid #e4e8ef}.gcaModal header span,.gcaDetailCard header span{color:#175cd3;font-size:10px;font-weight:850}.gcaModal h2,.gcaDetailCard h3{margin:3px 0}.gcaModal header p{margin:0;color:#667085;font-size:12px}.gcaModal header button,.gcaDetailCard header button{width:36px;height:36px;border:0;border-radius:50%;font-size:22px}.gcaLoading,.gcaError{margin:22px;padding:24px;border-radius:12px;background:#f5f8fc}.gcaLoading span{display:block;margin-top:5px;color:#667085}.gcaError{color:#9b2737;background:#fff0f1}.gcaModal #gcaContent{flex:1 1 auto;min-height:0;overflow:hidden;display:flex;flex-direction:column}.gcaStats{display:grid;flex:0 0 auto;grid-template-columns:repeat(6,1fr);gap:8px;padding:14px 18px}.gcaStats button{padding:10px;border:1px solid #dfe5ed;border-radius:10px;background:#fff;text-align:left}.gcaStats button.active{border-color:#175cd3;background:#eff5ff}.gcaStats span{display:block;color:#667085;font-size:9px}.gcaStats b{font-size:20px}.gcaReviewBar{display:flex;flex:0 0 auto;align-items:center;justify-content:space-between;gap:12px;margin:0 18px 12px;padding:10px 12px;border:1px solid #b2ddff;border-radius:10px;background:#eff8ff;color:#175cd3;font-size:12px}.gcaReviewBar span{display:block;margin-top:2px;color:#475467;font-size:10px}.gcaTools{display:flex;flex:0 0 auto;align-items:center;gap:12px;padding:0 18px 12px}.gcaTools input{flex:1}.gcaTools span{color:#667085;font-size:11px}.gcaTableWrap{flex:1 1 auto;min-height:0;overflow:auto;overscroll-behavior:contain;padding:0 18px}.gcaTableWrap table{width:100%;border-collapse:collapse;min-width:1120px}.gcaTableWrap th,.gcaTableWrap td{padding:10px;border-bottom:1px solid #e8ecf2;text-align:left;vertical-align:top;font-size:11px}.gcaTableWrap th{position:sticky;top:0;z-index:1;background:#f8fafc;color:#667085;text-transform:uppercase}.gcaTableWrap td small{display:block;color:#667085;margin-top:3px}.gcaBadge{display:inline-block;padding:4px 7px;border-radius:999px;background:#eef2f6}.gcaBadge.match{background:#e5f7eb;color:#14753a}.gcaBadge.conflict,.gcaBadge.duplicate{background:#fff0e0;color:#a64b00}.gcaBadge.google_only{background:#eef4ff;color:#1849a9}.gcaBadge.crm_only{background:#f2ebff;color:#6941c6}.gcaActions{display:flex;flex-wrap:wrap;gap:5px;min-width:170px}.gcaAction{position:relative;z-index:2;padding:5px 7px;border:1px solid #b2ccff;border-radius:7px;background:#eff4ff;color:#1849a9;font-size:10px;cursor:pointer;pointer-events:auto}.gcaAction.secondary{border-color:#d0d5dd;background:#fff;color:#344054}.gcaAction.danger{border-color:#fecdca;background:#fff;color:#b42318}.gcaAction.selected{border-color:#12b76a;background:#ecfdf3;color:#027a48}.gcaEmpty{text-align:center!important;padding:40px!important;color:#667085}.gcaModal>div.hidden{display:none!important}.gcaModal #gcaContent>footer{display:flex;flex:0 0 auto;align-items:center;justify-content:center;gap:14px;padding:12px 18px;border-top:1px solid #e4e8ef}.gcaDetailBack{position:fixed;inset:0;z-index:260010;display:grid;place-items:center;padding:18px;background:#101828b8}.gcaDetailBack.hidden{display:none!important}.gcaDetailCard{width:min(720px,100%);max-height:90vh;overflow:auto;border-radius:14px;background:#fff;box-shadow:0 20px 60px #0007}.gcaDetailCard table{width:calc(100% - 36px);margin:16px 18px;border-collapse:collapse}.gcaDetailCard th,.gcaDetailCard td{padding:10px;border-bottom:1px solid #e4e8ef;text-align:left;font-size:12px}.gcaProposal{display:flex;flex-direction:column;gap:5px;margin:12px 18px;padding:12px;border-radius:10px;background:#f2f4f7}.gcaProposal span{color:#475467}.gcaDetailCard footer{display:flex;justify-content:flex-end;padding:14px 18px;border-top:1px solid #e4e8ef}@media(max-width:800px){.gcaStats{grid-template-columns:repeat(2,1fr)}.gcaBack{padding:6px}.gcaModal{height:98vh;max-height:98vh}.gcaReviewBar,.gcaTools{align-items:stretch;flex-direction:column}}`;document.head.appendChild(style)}
function bind(){styles();loadDecisions();const button=$('googleContactsAuditBtn');if(button)button.onclick=run;window.TPFGoogleContactsAudit={compare,run}}
M.register('google-contacts-audit',{install(){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind()}});
})();
