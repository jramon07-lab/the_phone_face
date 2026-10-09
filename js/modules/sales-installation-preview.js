/* Monthly installed-sales reconciliation. Confirmation uses an atomic, admin-only RPC. */
(function(){
'use strict';
const $=id=>document.getElementById(id),mode='COMPROBAR VENTAS';let generation=0,rows=[],contacts=[],opps=[],stages=[],busy=false,draftOwner='';
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const html=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid'}).format(new Date());
function date(value){
 let out='';
 if(value instanceof Date){if(!Number.isFinite(value.getTime()))return '';out=[value.getFullYear(),String(value.getMonth()+1).padStart(2,'0'),String(value.getDate()).padStart(2,'0')].join('-');}
 else if(typeof value==='number'){if(!Number.isFinite(value)||value<36526||value>100000)return '';out=new Date(Date.UTC(1899,11,30)+Math.floor(value)*86400000).toISOString().slice(0,10);}
 else {const s=String(value||'').trim(),m=s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);out=m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:s;}
 if(!/^\d{4}-\d{2}-\d{2}$/.test(out))return '';
 const d=new Date(out+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===out?out:'';
}
function months(value,n){if(!date(value))return '';const [y,m,d]=value.split('-').map(Number),target=new Date(Date.UTC(y,m-1+n,1));target.setUTCDate(Math.min(d,new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate()));return target.toISOString().slice(0,10);}
const display=v=>v?v.split('-').reverse().join('/'):'Sin fecha';
const name=r=>r.data?.['NOMBRE Y APELLIDOS']||[r.data?.NOMBRE,r.data?.APELLIDOS].filter(Boolean).join(' ');
const canonical=v=>({VODAFONE:'Vodafone',O2:'O2',MASMOVIL:'MásMóvil',YOIGO:'Yoigo',ORANGE:'Orange',LOWI:'Lowi',JAZZTEL:'Jazztel'}[norm(v)]||String(v||'').trim());
function validPrice(value){return value===''||value==null||Number.isFinite(Number(value))&&Number(value)>=0&&Number(value)<=1000000;}
function payload(r){return {dni:norm(r.DNI),operator:canonical(r.Operador),activation_date:date(r.Fecha_Activacion),orderline:String(r.OrderLine||'').trim(),transaction:String(r.Transaccion||'').trim(),cancelled:String(r.Cancelada||''),shop:String(r.Tienda||'8554'),month:String(r.Mes_Venta||''),activation_original:String(r.Fecha_Activacion??'')};}
function analyse(raw,clients,sales){
 const seen=new Set();
 return raw.filter(r=>Object.keys(r).some(k=>['DNI','OrderLine','Transaccion','Operador','Fecha_Activacion'].includes(k)&&String(r[k]??'').trim())).map(r=>{
  const p=payload(r),dni=p.dni,operator=p.operator,installed=p.activation_date,key=p.shop+':'+p.orderline,duplicate=seen.has(key)&&!!p.orderline;seen.add(key);
  const matches=dni?clients.filter(c=>[c.data?.DNI,c.data?.['DNI / NIF']].some(d=>norm(d)===dni)):[];
  const ids=new Set(matches.map(c=>c.id));
  const managers=matches.length===1?clients.filter(c=>(c.data?.TPF_RELACIONES?.managed_contacts||[]).some(x=>x.record_id===matches[0].id)):[];
  const managerIds=new Set(managers.map(c=>c.id));
  const managerCandidates=sales.filter(o=>managerIds.has(o.record_id)&&legacyManagerOpportunity(o));
  const related=sales.filter(o=>(ids.has(o.record_id)&&(!o.contract_party?.holder_dni||norm(o.contract_party.holder_dni)===dni))||dni&&norm(o.contract_party?.holder_dni)===dni||managerCandidates.includes(o));
  const candidates=related.filter(o=>operator&&(norm(o.title).includes(norm(operator))||norm(o.installation_operator)===norm(operator)));
  const exact=sales.find(o=>p.orderline&&o.import_reference===key);
  let issue=duplicate?'Duplicada en Excel':!dni?'Falta DNI':!operator?'Falta operador':!p.orderline?'Falta OrderLine':!installed||installed>today()||installed<'2000-01-01'?'Fecha de activación obligatoria y válida':norm(p.cancelled)==='SI'?'Cancelada: no importar':matches.length===0?'Cliente no encontrado':matches.length>1?'Revisar titular / gestor':'';
  const available=candidates.filter(o=>!o.import_reference||o.import_reference===key);
  const choice=exact?.id||(!issue&&available.length===1&&!managerCandidates.includes(available[0])?available[0].id:candidates.length?'':'new');
  return {dni,operator,client:matches.map(name).join(' / ')||'Sin identificar',installed,review:months(installed,12),next:months(installed,11),issue,action:issue|| (exact?'Ya importada':candidates.length?'Revisar oportunidad existente':'Crear en Ganado'),expected:exact?.expected_date||candidates[0]?.expected_date||'',key,contactId:matches.length===1?matches[0].id:null,payload:p,related,candidates,choice,managers,managerCandidateIds:managerCandidates.map(o=>o.id),managerOpportunityConfirmed:false,detailsOpen:candidates.length>1,managerId:managers.length?'':matches[0]?.id,recipientId:managers.length?'':matches[0]?.id,amount:exact?.amount??'',imported:!!exact,opportunityId:exact?.id||null,selected:!issue&&choice==='new'&&!managers.length};
 });
}
function legacyManagerOpportunity(o){const p=o.contract_party||{};return p.same!==false&&p.same!=='false'&&!norm(p.holder_dni)&&(!p.holder_record_id||p.holder_record_id===o.record_id);}
function isManagerChoice(r){return !r.imported&&(r.managerCandidateIds?.includes(r.choice)||false);}
async function all(table,columns,filter){const result=[];for(let start=0;;start+=500){let q=sb.from(table).select(columns).order('id').range(start,start+499);if(filter)q=q.eq(...filter);const {data,error}=await q;if(error)throw error;result.push(...(data||[]));if((data||[]).length<500)return result;}}
async function refreshSources(){if(sb.auth?.getSession){const session=await sb.auth.getSession();draftOwner=session.data?.session?.user?.id||'';}[contacts,opps,stages]=await Promise.all([all('records','id,data',['source_sheet','BASE DE DATOS']),all('sales_opportunities','id,record_id,client_name,title,amount,expected_date,contract_party,installation_date,installation_operator,import_reference,annual_review_date,stage_id,updated_at,created_at,phone,notes'),all('sales_stages','id,name')]);}
const draftKey=()=>draftOwner?'tpf-installed-preparation-v1:'+draftOwner:'';
const signature=r=>JSON.stringify([r.key,r.dni,r.operator,r.installed,r.payload?.cancelled]);
function readDraft(){try{const value=JSON.parse(window.sessionStorage?.getItem(draftKey())||'{}');return value.version===1&&Date.now()-value.savedAt<86400000&&value.rows&&typeof value.rows==='object'?value.rows:{};}catch(_){return {};}}
function saveDraft(){if(!draftKey()||!rows.length)return false;try{const saved=readDraft();for(const r of rows){if(!r.ledgerId)continue;if(r.imported){delete saved[r.ledgerId];continue;}saved[r.ledgerId]={signature:signature(r),choice:r.choice,amount:r.amount,managerId:r.managerId,recipientId:r.recipientId,selected:r.selected,detailsOpen:r.detailsOpen};}window.sessionStorage.setItem(draftKey(),JSON.stringify({version:1,savedAt:Date.now(),rows:saved}));return true;}catch(_){return false;}}
function restoreDraft(){const saved=readDraft();for(const r of rows){const d=saved[r.ledgerId];if(!d||r.imported||d.signature!==signature(r))continue;if(validPrice(d.amount))r.amount=d.amount;if(d.choice==='new'||r.candidates.some(o=>o.id===d.choice&&!o.import_reference))r.choice=d.choice;const people=[r.contactId,...r.managers.map(c=>c.id)];if(people.includes(d.managerId))r.managerId=d.managerId;if([r.contactId,r.managerId].includes(d.recipientId))r.recipientId=d.recipientId;r.managerOpportunityConfirmed=false;r.detailsOpen=!!d.detailsOpen;r.selected=!!d.selected&&eligible(r);}}
function sourceMonth(p){const raw=String(p.month||'');const d=date(raw);if(d)return d.slice(0,7)+'-01';const names=['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'],m=raw.toUpperCase().match(/^([A-Z]+)(20\d{2})$/);if(m&&names.includes(m[1]))return m[2]+'-'+String(names.indexOf(m[1])+1).padStart(2,'0')+'-01';return (p.activation_date||today()).slice(0,7)+'-01';}
function eligible(r){return !r.imported&&!r.issue&&!!r.ledgerId&&!!r.choice&&(r.choice!=='new'||!!r.managerId&&!!r.recipientId)&&(!isManagerChoice(r)||r.managerOpportunityConfirmed&&!!r.recipientId)&&validPrice(r.amount);}
function partyControls(r,i){
 if(r.issue)return '';
 const o=opps.find(o=>o.id===r.choice),p=o?.contract_party;
 if(isManagerChoice(r)){const manager=r.managers.find(c=>c.id===o?.record_id),people=[{id:r.contactId,data:{NOMBRE:r.client}},manager].filter(Boolean);return '<small>Gestor: '+html(name(manager||{}))+'</small><label>Comunicaciones<select data-installed-recipient="'+i+'"><option value="">Elegir destinatario…</option>'+people.map(c=>'<option value="'+c.id+'" '+(r.recipientId===c.id?'selected':'')+'>'+html(name(c))+'</option>').join('')+'</select></label><label><input type="checkbox" data-installed-manager-confirm="'+i+'" '+(r.managerOpportunityConfirmed?'checked':'')+'> Esta oportunidad corresponde a '+html(r.client)+' y la gestiona '+html(name(manager||{}))+'</label><small>Se actualizará la oportunidad existente, conservando el precio y la previsión.</small>'; }
 if(r.choice!=='new')return p?'<small>Titular: '+html(p.holder_name||r.client)+' · Gestor: '+html(p.contact_name||r.client)+' · Comunicaciones: '+html(p.recipient_name||r.client)+'</small>':'';
 const people=[{id:r.contactId,data:{NOMBRE:r.client}},...r.managers];
 return '<label>Gestor<select data-installed-manager="'+i+'"><option value="">Elegir gestor…</option>'+people.map(c=>'<option value="'+c.id+'" '+(r.managerId===c.id?'selected':'')+'>'+html(name(c))+'</option>').join('')+'</select></label><label>Comunicaciones<select data-installed-recipient="'+i+'"><option value="">Elegir destinatario…</option>'+people.filter(c=>c.id===r.contactId||c.id===r.managerId).map(c=>'<option value="'+c.id+'" '+(r.recipientId===c.id?'selected':'')+'>'+html(name(c))+'</option>').join('')+'</select></label><button type="button" data-installed-person="'+i+'" data-person-role="manager">Buscar o crear otro gestor</button>';
}
function opportunityLabel(o){return [o.title,stages.find(s=>s.id===o.stage_id)?.name,o.amount!=null?Number(o.amount).toLocaleString('es-ES')+' €':'Sin importe',o.installation_date?'Instalada '+display(o.installation_date):'',o.import_reference?'Ya vinculada a una importación':'',o.created_at?'Creada '+new Date(o.created_at).toLocaleString('es-ES',{timeZone:'Europe/Madrid',dateStyle:'short',timeStyle:'medium'}):'', 'Ref. '+String(o.id||'').slice(0,8)].filter(Boolean).join(' · ');}
function reclamationDraft(r,sourceOpps=opps,sourceContacts=contacts){
 if(!r)throw Error('La fila ya no está disponible. Vuelve a cargar.');
 const opportunity=sourceOpps.find(o=>o.id===(r.opportunityId||r.choice));
 const contact=sourceContacts.find(c=>c.id===r.contactId),data=contact?.data||{};
 const client=r.client&&r.client!=='Sin identificar'?r.client:'Cliente por identificar';
 const description=['Revisar esta venta y reclamar al operador lo que corresponda.','Cliente: '+client,'DNI del Excel: '+(r.dni||'Sin indicar'),'Operador: '+(r.operator||'Sin indicar'),'Activación indicada en el Excel: '+display(r.installed),'Referencia de la fila: '+(r.key||r.ledgerId||'Sin indicar'),opportunity?'Oportunidad: '+opportunityLabel(opportunity):'Oportunidad pendiente de vincular.',r.issue?'Pendiente de revisar: '+r.issue:''].filter(Boolean).join('\n');
 return {opportunity,prefill:{overlay:true,type:'Tarea',title:'Reclamación · '+client+' · '+(r.operator||'Operador sin indicar'),description,customerName:client,contactId:contact?.id||null,phone:data['TELÉFONO']||data.TELEFONO||'',notifyInApp:true,notifyEmail:false,syncGoogle:false},context:{overlay:true,opportunityId:opportunity?.id||null}};
}
function createReclamation(r){
 const draft=reclamationDraft(r),onSaved=()=>{$('importInfo').textContent='Reclamación guardada. Puedes verla en Agenda.';};
 if(draft.opportunity){if(typeof window.TPFOpportunityDetails?.createTask!=='function')throw Error('Actualiza la página para crear la reclamación.');return window.TPFOpportunityDetails.createTask(draft.opportunity,{title:draft.prefill.title,description:draft.prefill.description,onSaved});}
 if($('agendaCreateCard')?.classList.contains('open'))throw Error('Termina o cancela primero la tarea abierta.');
 if(typeof window.TPFAgendaComposer?.open!=='function')throw Error('Actualiza la página para crear la reclamación.');
 return window.TPFAgendaComposer.open(draft.prefill,{...draft.context,onSaved});
}
function missingPrice(r){const original=opps.find(o=>o.id===r.choice);return (original?.amount??r.amount)===''||(original?.amount??r.amount)==null;}
function needsReview(r){return !!r.issue||!r.imported&&!eligible(r)||missingPrice(r);}
function visibleRows(list,filter='all'){
 return list.map((r,i)=>({r,i})).filter(({r})=>filter==='all'||filter==='pending'&&needsReview(r)||filter==='price'&&missingPrice(r))
 .sort((a,b)=>Number(needsReview(b.r))-Number(needsReview(a.r))||Number(a.r.imported)-Number(b.r.imported)||a.i-b.i);
}
function render(){
 const shown=visibleRows(rows,$('installedFilter')?.value||'all');
 $('previewHead').innerHTML='<tr>'+['Importar','Cliente / DNI','Operador','Oportunidad','Importe (€)','Activación y seguimiento'].map(x=>'<th>'+x+'</th>').join('')+'</tr>';
 $('previewRows').innerHTML=shown.map(({r,i})=>{
 const original=opps.find(o=>o.id===r.choice),price=original?.amount??r.amount;
 const choice=r.imported?'<b>Importada · Ganado</b>':r.issue?'<span class="installedWarn">'+html(r.issue)+'</span>':'<select aria-label="Oportunidad de '+html(r.client)+'" data-installed-choice="'+i+'"><option value="">Elegir entre las oportunidades existentes…</option>'+r.candidates.map(o=>'<option value="'+html(o.id)+'" '+(r.choice===o.id?'selected':'')+'>'+html(opportunityLabel(o)+(r.managerCandidateIds?.includes(o.id)?' · Gestor: '+name(r.managers.find(c=>c.id===o.record_id)||{})+' · Revisar titular':''))+'</option>').join('')+'<option value="new" '+(r.choice==='new'?'selected':'')+'>Crear nueva en Ganado</option></select>';
 const existing=r.related?.length?'<small><b>'+r.related.length+' oportunidad(es) para revisar:</b></small>'+r.related.map(o=>'<section class="installedOpportunityCard"><strong>'+html(opportunityLabel(o))+'</strong><small>Titular: '+html(o.contract_party?.holder_name||r.client)+' · Gestor: '+html(o.contract_party?.contact_name||r.client)+'</small><small>'+html(o.installation_date?'Activación registrada: '+display(o.installation_date):'Sin activación registrada en el CRM')+'</small><div><button type="button" data-installed-open="'+html(o.id)+'">Abrir oportunidad</button><button type="button" data-installed-task="'+html(o.id)+'">Crear tarea de reclamación</button></div></section>').join(''):'';
 const amount='<input type="number" min="0" max="1000000" step="0.01" placeholder="Sin precio" aria-label="Importe de '+html(r.client)+'" value="'+html(price)+'" data-installed-amount="'+i+'" '+(original?.amount!=null?'readonly':'')+'><small data-price-note="'+i+'" class="installedWarn">'+(missingPrice(r)?'Sin precio · Revisar':'')+'</small>'+(r.imported&&original?.amount==null?'<button type="button" data-installed-price-save="'+i+'">Guardar importe</button>':'');
 const details='<details class="installedDetails" data-installed-details="'+i+'" '+(r.detailsOpen?'open':'')+'><summary>Revisar datos</summary><small>Titular: '+html(r.client)+'</small>'+(!r.imported?'<button type="button" data-installed-person="'+i+'" data-person-role="holder">Buscar / crear titular</button>':'')+partyControls(r,i)+'<small>Previsión de cierre: '+display(r.choice==='new'?'':original?.expected_date||r.expected)+'</small>'+existing+'</details>';
 const dates='<b>'+display(r.installed)+'</b><small>11 meses: '+display(r.next)+'</small><small>12 meses: '+display(r.review)+'</small><small>Mes de venta: '+display(sourceMonth(r.payload))+'</small>';
 return '<tr>'+['<input type="checkbox" aria-label="Importar '+html(r.client)+'" data-installed-select="'+i+'" '+(r.selected?'checked':'')+' '+(!eligible(r)?'disabled':'')+'>','<b>'+html(r.client)+'</b><small>'+html(r.dni)+'</small>'+ (r.managers.length?'<small>Gestionado por '+r.managers.map(c=>html(name(c))).join(' · ')+'</small>':''),html(r.operator),choice+'<div class="installedRowActions"><button type="button" data-installed-claim-row="'+i+'">Crear reclamación</button></div>'+details,amount,dates].map(v=>'<td>'+v+'</td>').join('')+'</tr>';
 }).join('');
 updateButton();
 updateSummary();
}
function updateSummary(){
 const created=rows.filter(r=>r.imported).length,ready=rows.filter(eligible).length,pending=rows.filter(needsReview).length;
 $('importInfo').textContent=`${rows.length} ventas · ${created} ya importadas · ${ready} disponibles para importar · ${pending} para revisar. Primero se muestran las que necesitan revisión. Una venta sin precio puede importarse y queda pendiente de completar el importe. La activación determina los seguimientos de 11 y 12 meses.`;
}
function rebuildRow(i){
 const old=rows[i],p=old.payload;
 const next=analyse([{DNI:p.dni,Operador:p.operator,Fecha_Activacion:p.activation_date,OrderLine:p.orderline,Transaccion:p.transaction,Cancelada:p.cancelled,Tienda:p.shop,Mes_Venta:p.month}],contacts,opps)[0];
 rows[i]={...next,ledgerId:old.ledgerId,amount:old.amount,selected:false};
 if(old.issue==='Duplicada en Excel'||old.issue==='La referencia guardada tiene otros datos: revisar')rows[i].issue=old.issue;
 if(old.choice&&old.choice!=='new'&&next.candidates.some(o=>o.id===old.choice))rows[i].choice=old.choice;
 return rows[i];
}
async function choosePerson(i,role){
 const version=generation,r=rows[i];if(!r||r.imported||busy)return;
 if(role==='manager'&&!r.contactId)throw Error('Identifica primero al titular');
 busy=true;updateButton();
 try{
 const picked=await window.TPFWorkspace.pickContact({role,dni:role==='holder'?r.dni:'',holderId:r.contactId});
 if(!picked||version!==generation||rows[i]!==r)return;
 if(role==='holder'&&![picked.data?.DNI,picked.data?.['DNI / NIF']].some(x=>norm(x)===r.dni))throw Error('El DNI del contacto debe coincidir con el Excel. Edita su ficha si falta el DNI.');
 if(role==='manager'&&picked.id!==r.contactId){const saved=await sb.rpc('crm_link_import_manager',{p_holder:r.contactId,p_manager:picked.id});if(saved.error)throw saved.error;window.dispatchEvent(new CustomEvent('tpf:contact-updated',{detail:{id:picked.id}}));}
 await refreshSources();if(version!==generation)return;
 const next=rebuildRow(i);if(role==='manager'){if(picked.id!==next.contactId&&!next.managers.some(c=>c.id===picked.id))throw Error('No se ha guardado el vínculo del gestor. Conserva esta pantalla y revisa la relación en la ficha.');next.managerId=picked.id;next.recipientId='';next.detailsOpen=true;}
 render();
 }finally{busy=false;updateButton();}
}
function updateButton(){saveDraft();const n=rows.filter(r=>r.selected&&eligible(r)).length;$('runImport').disabled=busy||!n;$('runImport').textContent='Confirmar '+n+' venta'+(n===1?'':'s');if($('installedSelection'))$('installedSelection').textContent=n+' seleccionada'+(n===1?'':'s')+' para importar · '+rows.filter(eligible).length+' disponibles. Solo se confirman las marcadas.';}
function clearPreview(){rows=[];$('previewHead').innerHTML='';$('previewRows').innerHTML='';updateButton();}
async function preview(){
 if(busy)return;
 const version=++generation,file=$('excelFile')?.files[0];clearPreview();$('runImport').disabled=true;
 if(!file){$('importInfo').textContent='Selecciona el Excel del mes.';return;}
 $('importMapping')?.classList.add('hidden');$('importInfo').textContent='Comprobando ventas y guardando pendientes…';
 try{
  const book=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false}),sheet=book.SheetNames.find(n=>n==='Export')||book.SheetNames[0],raw=XLSX.utils.sheet_to_json(book.Sheets[sheet],{defval:'',raw:true});
  if(!raw.length||!['DNI','Fecha_Activacion','OrderLine','Operador'].every(k=>k in raw[0]))throw Error('Faltan columnas obligatorias: DNI, Operador, OrderLine o Fecha_Activacion.');
  await refreshSources();if(version!==generation||$('destination').value!==mode)return;
  rows=analyse(raw,contacts,opps);
  for(const r of rows){if(!r.payload.orderline||r.issue==='Duplicada en Excel')continue;const record={source_key:r.key,source_file:file.name,sale_month:sourceMonth(r.payload),payload:r.payload};const {error}=await sb.from('crm_sales_import_rows').upsert(record,{onConflict:'source_key',ignoreDuplicates:true});if(error)throw error;}
  const saved=await all('crm_sales_import_rows','id,source_key,payload,opportunity_id');
  for(const r of rows){const row=saved.find(x=>x.source_key===r.key);r.ledgerId=row?.id;
   if(row&&['dni','operator','activation_date','orderline','cancelled'].some(k=>row.payload[k]!==r.payload[k])){
    const conflict=['dni','operator','activation_date','orderline','cancelled'].some(k=>row.payload[k]&&row.payload[k]!==r.payload[k]);
    if(!row.opportunity_id&&!conflict){const {error}=await sb.from('crm_sales_import_rows').update({payload:r.payload,source_file:file.name,sale_month:sourceMonth(r.payload)}).eq('id',row.id).is('opportunity_id',null);if(error)throw error;}
    else {r.issue='La referencia guardada tiene otros datos: revisar';r.selected=false;}
   }
  }
  if(version!==generation||$('destination').value!==mode)return;
  restoreDraft();window.TPFInstallationPreview.last=rows;render();
 }catch(e){$('runImport').disabled=true;$('importInfo').textContent='No se han importado ventas: '+e.message;}
}
async function history(draftOnly=false){saveDraft();const version=++generation;$('importInfo').textContent='Cargando comprobaciones guardadas…';try{await refreshSources();const stored=await all('crm_sales_import_rows','id,source_key,payload,sale_month,opportunity_id');const month=$('installedMonth').value;const savedDraft=readDraft();const selected=stored.filter(r=>draftOnly?!!savedDraft[r.id]:!month||r.sale_month.slice(0,7)===month);const raw=selected.map(r=>({DNI:r.payload.dni,Operador:r.payload.operator,OrderLine:r.payload.orderline,Transaccion:r.payload.transaction,Fecha_Activacion:r.payload.activation_date,Cancelada:r.payload.cancelled,Tienda:r.payload.shop,Mes_Venta:r.payload.month}));if(version!==generation)return;rows=analyse(raw,contacts,opps);rows.forEach((r,i)=>r.ledgerId=selected[i].id);restoreDraft();window.TPFInstallationPreview.last=rows;render();}catch(e){$('importInfo').textContent=e.message;}}
async function importSelected(){if(busy)return;const selected=rows.filter(r=>r.selected&&eligible(r));if(!selected.length)return;
 if(!confirm(`Confirmar ${selected.length} venta(s) como Ganado. Se conservarán los teléfonos y previsiones existentes. Se programarán los seguimientos futuros que falten, sin mensajes inmediatos. ¿Importar?`))return;
 busy=true;updateButton();let done=0,errors=[];
 try{for(const r of selected){const result=await sb.rpc('crm_import_installed_sale_v3',{p_row_id:r.ledgerId,p_contact_id:r.contactId,p_manager_contact_id:r.choice==='new'?r.managerId:isManagerChoice(r)?opps.find(o=>o.id===r.choice)?.record_id:null,p_recipient_contact_id:r.choice==='new'||isManagerChoice(r)?r.recipientId:null,p_confirm_manager_opportunity:isManagerChoice(r)&&r.managerOpportunityConfirmed,p_expected_updated_at:isManagerChoice(r)?opps.find(o=>o.id===r.choice)?.updated_at:null,p_opportunity_id:r.choice==='new'?null:r.choice,p_amount:r.amount===''||r.amount==null?null:Number(r.amount)});if(result.error){errors.push(r.client+': '+result.error.message);continue;}r.imported=true;r.opportunityId=result.data.id;r.choice=result.data.id;r.selected=false;done++;}
 await refreshSources();for(const r of rows){const o=opps.find(x=>x.id===r.opportunityId);if(o)r.amount=o.amount??'';}render();const contactIds=[...new Set(selected.filter(r=>r.imported).flatMap(r=>{const p=opps.find(o=>o.id===r.opportunityId)?.contract_party||{};return [r.contactId,p.holder_record_id,p.manager_record_id,p.recipient_contact_id].filter(Boolean)}))];window.dispatchEvent(new CustomEvent('tpf:sales-updated',{detail:{contactIds}}));window.TPFAutomationInbox?.reload();$('importInfo').textContent=`${done} ventas confirmadas. `+(errors.length?errors.join(' · '):'Sin mensajes inmediatos. Las filas pendientes siguen guardadas para revisar.');
 }finally{busy=false;updateButton();}
}
async function savePrice(i){const r=rows[i];if(!r?.opportunityId||r.amount===''||!validPrice(r.amount))return;const {error}=await sb.from('sales_opportunities').update({amount:Number(r.amount)}).eq('id',r.opportunityId).is('amount',null);if(error){$('importInfo').textContent=error.message;return;}await refreshSources();render();window.dispatchEvent(new CustomEvent('tpf:sales-updated'));}
function bind(){const select=$('destination');if(!select)return;const option=document.createElement('option');option.value=mode;option.textContent='COMPROBAR VENTAS DEL MES';select.append(option);
 const box=document.createElement('div');box.id='installedTools';box.hidden=true;box.innerHTML='<style>#installedTools{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:14px 0}#installedTools[hidden]{display:none}#view-import:has(#installedTools:not([hidden])) #previewRows td{vertical-align:top;min-width:95px}#previewRows [data-installed-amount]{width:105px}#previewRows [data-installed-choice]{max-width:210px}#view-import:has(#installedTools:not([hidden])) #previewRows small{display:block;margin-top:5px;color:#64748b}#previewRows .installedDetails{margin-top:8px;max-width:390px}.installedOpportunityCard{border:1px solid #dce5ef;border-radius:8px;padding:10px;margin:8px 0;background:#f8fafc}.installedOpportunityCard strong{display:block;font-size:12px;line-height:1.5;font-weight:600}.installedOpportunityCard>div{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.installedOpportunityCard button{font-size:11px;padding:5px 8px}.installedRowActions{margin-top:8px}.installedRowActions button{font-size:11px;padding:5px 8px}#previewRows .installedDetails summary{cursor:pointer;color:#2563eb}#previewRows .installedDetails label{display:block;margin-top:8px}#previewRows .installedDetails select{max-width:100%;width:100%}#installedSelection{flex-basis:100%;font-weight:600;color:#1e40af}#previewRows .installedWarn{color:#b42318}.installedWarn{color:#b42318;font-weight:600}</style><label>Mes de venta para consultar <input id="installedMonth" type="month" value="'+today().slice(0,7)+'"></label><button type="button" id="installedHistory">Ver comprobaciones guardadas</button><button type="button" id="installedRestore">Recuperar preparación de esta pestaña</button><label>Mostrar <select id="installedFilter"><option value="all">Todas</option><option value="pending">Pendientes de revisar</option><option value="price">Sin precio</option></select></label><span>El mes filtra las comprobaciones guardadas. No cambia las fechas del Excel. Vacíalo para consultar todos.</span><div id="installedSelection" role="status" aria-live="polite"></div>';$('importInfo').before(box);
 $('installedHistory').onclick=()=>history();$('installedRestore').onclick=()=>history(true);$('installedFilter').onchange=render;
 document.addEventListener('click',e=>{if(select.value!==mode)return;const b=e.target.closest?.('#previewImport,#runImport,[data-installed-price-save],[data-installed-person],[data-installed-open],[data-installed-task],[data-installed-claim-row]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();if(b.dataset.installedClaimRow!=null){try{createReclamation(rows[Number(b.dataset.installedClaimRow)]);}catch(err){$('importInfo').textContent=err.message;}return;}if(b.dataset.installedOpen!=null){Promise.resolve(window.openOpportunityFull(b.dataset.installedOpen)).catch(err=>$('importInfo').textContent=err.message);return;}if(b.dataset.installedTask!=null){try{const o=opps.find(x=>x.id===b.dataset.installedTask);if(!o)throw Error('La oportunidad ya no está disponible. Vuelve a cargar.');window.TPFOpportunityDetails.createTask(o,{description:'Comprobar la activación y reclamar al operador si sigue pendiente.\n'+opportunityLabel(o)+'\nTitular: '+(o.contract_party?.holder_name||o.client_name||'Sin indicar')+'\nGestor: '+(o.contract_party?.contact_name||'Sin indicar'),onSaved:()=>{$('importInfo').textContent='Tarea de reclamación guardada y vinculada a la oportunidad. Puedes verla en Agenda.';}});}catch(err){$('importInfo').textContent=err.message;}return;}if(b.id==='previewImport')preview();else if(b.id==='runImport')importSelected().catch(err=>$('importInfo').textContent=err.message);else if(b.dataset.installedPerson!=null)choosePerson(Number(b.dataset.installedPerson),b.dataset.personRole).catch(err=>$('importInfo').textContent=err.message);else savePrice(Number(b.dataset.installedPriceSave));},true);
 $('previewRows').addEventListener('toggle',e=>{const i=e.target.dataset?.installedDetails;if(i!=null&&rows[i])rows[i].detailsOpen=e.target.open;},true);
 $('previewRows').addEventListener('change',e=>{if(select.value!==mode)return;const el=e.target;if(el.dataset.installedManagerConfirm!=null){const r=rows[el.dataset.installedManagerConfirm];r.managerOpportunityConfirmed=el.checked;r.selected=eligible(r);render();return;}if(el.dataset.installedManager!=null){const r=rows[el.dataset.installedManager];r.managerId=el.value;r.recipientId='';r.selected=false;render();return;}if(el.dataset.installedRecipient!=null){const r=rows[el.dataset.installedRecipient];r.recipientId=el.value;r.selected=eligible(r);render();return;}if(el.dataset.installedSelect!=null){rows[el.dataset.installedSelect].selected=el.checked;updateButton();}if(el.dataset.installedChoice!=null){const r=rows[el.dataset.installedChoice];r.choice=el.value;r.managerOpportunityConfirmed=false;r.detailsOpen=true;if(isManagerChoice(r)){r.recipientId='';}r.selected=eligible(r);render();}});
 $('previewRows').addEventListener('input',e=>{const el=e.target;if(el.dataset.installedAmount!=null){const r=rows[el.dataset.installedAmount];r.amount=el.value;$('previewRows').querySelector('[data-price-note="'+el.dataset.installedAmount+'"]').textContent=el.value===''?'Sin precio · Revisar':validPrice(el.value)?'':'Importe no válido';const checkbox=$('previewRows').querySelector('[data-installed-select="'+el.dataset.installedAmount+'"]');if(checkbox){checkbox.disabled=!eligible(r);if(!eligible(r)){r.selected=false;checkbox.checked=false;}}updateButton();updateSummary();}});
 select.addEventListener('change',()=>{generation++;box.hidden=select.value!==mode;if(select.value===mode){clearPreview();$('runImport').disabled=true;$('importMapping')?.classList.add('hidden');$('importInfo').textContent='Carga el Excel del mes o revisa pendientes guardados. La fecha de activación es obligatoria.';$('runImport').textContent='Confirmar ventas';}else $('runImport').textContent='Confirmar importación';});
 $('excelFile')?.addEventListener('change',()=>{generation++;if(select.value===mode)clearPreview();else rows=[];});
}
window.TPFInstallationPreview={saveDraft,restoreDraft,readDraft,analyse,date,months,validPrice,sourceMonth,eligible,needsReview,visibleRows,legacyManagerOpportunity,isManagerChoice,opportunityLabel,reclamationDraft,createReclamation};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
