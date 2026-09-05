/* Importador guiado de Contactos y Oportunidades. Mantiene intacto el importador histórico. */
(()=>{
 const q=id=>document.getElementById(id), clean=v=>String(v??"").trim();
 const norm=v=>clean(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
 const digits=v=>clean(v).replace(/\D/g,"").replace(/^00/,"").replace(/^34(?=\d{9}$)/,"");
 const dni=v=>clean(v).toUpperCase().replace(/[^A-Z0-9]/g,"");
 const email=v=>clean(v).toLowerCase();
 const slug=v=>norm(v).replace(/\s+/g,"_").slice(0,54)||"campo";
 const escHtml=v=>typeof esc==="function"?esc(v):clean(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
 const synonyms={
  contact:{
   first_name:["nombre","first name"],last_name:["apellidos","apellido","last name"],full_name:["nombre y apellidos","nombre completo","cliente","contacto"],
   phone:["telefono","teléfono","telefono 1","teléfono 1","movil","móvil","phone","celular"],phone_2:["telefono 2","teléfono 2"],phone_3:["telefono 3","teléfono 3"],
   dni:["dni","nif","nif nit","dni nif","documento"],email:["email","correo","correo electronico","correo electrónico","correo electronico 1","correo electrónico 1"],
   observations:["observaciones","observacion","observación","comentarios"],notes:["notas","nota"],labels:["etiquetas","tags"],owner:["propietario"],created_at:["creado","fecha de creación","fecha creacion"],avatar:["url de imagen del contacto","imagen del contacto","avatar"]
  },
  opportunity:{
   title:["titulo","título","oportunidad","nombre oportunidad","asunto"],client_name:["cliente","nombre cliente","contacto","nombre y apellidos"],
   phone:["telefono","teléfono","movil","móvil","phone"],dni:["dni","nif","dni nif"],email:["email","correo","correo electronico","correo electrónico"],
   amount:["importe","cantidad","valor","precio","amount"],expected_date:["fecha prevista","fecha cierre","cierre esperado","fecha","expected date"],
   stage:["estado","etapa","columna","fase","stage"],notes:["notas","nota","observaciones","comentarios"]
  }
 };
 const labels={contact:{first_name:"Nombre",last_name:"Apellidos",full_name:"Nombre completo",phone:"Teléfono principal",phone_2:"Teléfono adicional 1",phone_3:"Teléfono adicional 2",dni:"DNI / NIF",email:"Correo",observations:"Observaciones",notes:"Notas",labels:"Etiquetas",owner:"Propietario",created_at:"Fecha de creación",avatar:"Imagen del contacto"},opportunity:{title:"Título",client_name:"Cliente",phone:"Teléfono",dni:"DNI del contacto",email:"Correo del contacto",amount:"Importe",expected_date:"Fecha prevista",stage:"Estado / columna",notes:"Notas"}};
 const contactIgnored=new Set(["importe de oportunidades ganadas","importe de oportunidades perdidas","numero de oportunidades ganadas","numero de oportunidades perdidas","etapa de oportunidad activa","moneda"]);
 let state=null, legacyPreview=null, legacyRun=null, running=false;

 function isGuided(){return ["BASE DE DATOS","OPORTUNIDADES"].includes(q("destination")?.value)}
 function guess(header,type){const n=norm(header);if(type==="contact"&&contactIgnored.has(n))return "ignore";const group=synonyms[type];for(const [key,list] of Object.entries(group))if(list.some(x=>norm(x)===n))return key;return "custom"}
 function options(type,selected){return '<option value="ignore">No importar</option>'+Object.entries(labels[type]).map(([v,l])=>`<option value="${v}" ${selected===v?"selected":""}>${escHtml(l)}</option>`).join("")+`<option value="custom" ${selected==="custom"?"selected":""}>Campo adicional</option>`}
 function ensureUi(){
  if(q("importMapping"))return;
  const box=document.createElement("div");box.id="importMapping";box.className="hidden";
  box.innerHTML=`<style>
   #importMapping{margin-top:16px;border-top:1px solid #e5e7eb;padding-top:14px}#importMapping.hidden{display:none}
   .importSummary{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin:12px 0}.importSummary div{padding:10px;border:1px solid #e5e7eb;border-radius:10px;background:#fafafa}.importSummary b{display:block;font-size:20px}.importWarn{color:#a15c00}
   .importMapGrid{display:grid;grid-template-columns:minmax(160px,1fr) minmax(180px,1fr);gap:8px;align-items:center}.importMapGrid label{font-weight:600}.importMapGrid select{width:100%}.importHelp{margin:8px 0;color:#475467}.importErrors{color:#b42318;white-space:pre-line}
  </style><h3>Asignar columnas del Excel</h3><p class="small importHelp">Revisa la asignación automática. Las columnas adicionales se conservarán como campos personalizados.</p><div id="importMapGrid" class="importMapGrid"></div><div id="importSummary" class="importSummary"></div><div id="importErrors" class="small importErrors"></div>`;
  q("importInfo").parentNode.appendChild(box);
 }
 function readMapped(raw,key){for(const [h,target] of Object.entries(state.mapping))if(target===key&&clean(raw[h]))return clean(raw[h]);return ""}
 function readMappedValues(raw,key){return Object.entries(state.mapping).filter(([,target])=>target===key).map(([h])=>clean(raw[h])).filter(Boolean)}
 function extraValues(raw){const out={};for(const [h,target] of Object.entries(state.mapping))if(target==="custom"&&clean(raw[h])!=="")out[h]=raw[h];return out}
 function rowPhones(raw){return ["phone","phone_2","phone_3"].flatMap(key=>readMappedValues(raw,key)).filter((v,i,a)=>{const d=digits(v);return d&&a.findIndex(x=>digits(x)===d)===i})}
 function rowDnis(raw){return [...new Set(readMappedValues(raw,"dni").flatMap(v=>v.split(/[|;\n]+/)).map(dni).filter(Boolean))]}
 function splitLabels(v){return [...new Set(clean(v).split(/[,;\n]+/).map(x=>clean(x).replace(/\s+/g," ").toLocaleUpperCase("es-ES")).filter(Boolean))]}
 function uniqueLabels(values){const out=[],seen=new Set();for(const value of values){const key=norm(value);if(key&&!seen.has(key)){seen.add(key);out.push(value)}}return out}
 function contactData(raw){
  const first=readMapped(raw,"first_name"),last=readMapped(raw,"last_name"),full=readMapped(raw,"full_name")||[first,last].filter(Boolean).join(" ");
  const phones=rowPhones(raw),dnis=rowDnis(raw);
  return {...raw,"NOMBRE":first||full,"APELLIDOS":last,"NOMBRE Y APELLIDOS":full,"TELÉFONO":phones[0]||"","TELÉFONO 2":phones[1]||"","TELÉFONO 3":phones[2]||"","DNI / NIF":dnis[0]||"","EMAIL":readMapped(raw,"email"),"OBSERVACIONES":readMapped(raw,"observations"),"NOTAS":readMapped(raw,"notes"),"PROPIETARIO":readMapped(raw,"owner"),"FECHA DE CREACIÓN":readMapped(raw,"created_at"),"IMAGEN DEL CONTACTO":readMapped(raw,"avatar")};
 }
 async function allContacts(){let out=[];for(let from=0;;from+=1000){const {data,error}=await sb.from("records").select("id,data").eq("source_sheet","BASE DE DATOS").order("id").range(from,from+999);if(error)throw error;out.push(...(data||[]));if((data||[]).length<1000)break}return out}
 function contactKeys(data){const phones=[data["TELÉFONO"],data.TELEFONO,data.MOVIL,data["TELÉFONO 2"],data["TELEFONO 2"],data["TELÉFONO 3"],data["TELEFONO 3"]].map(digits).filter(Boolean),unique=[...new Set(phones)];return {phone:unique[0]||"",phones:unique,dni:dni(data["DNI / NIF"]||data.DNI||data.NIF),email:email(data.EMAIL||data.Email)}}
 async function analyse(){
  if(!state)return;const errors=[];let duplicates=0;state.duplicateRows=new Set();
  if(state.type==="contact"){
   const existing=await allContacts();
   if(state.contacts&&JSON.stringify(state.contacts)!==JSON.stringify(existing))state.decisions={};state.contacts=existing;
   const nextReview=reviewContacts(state.rawRows.map(contactData),existing,state.rawRows.map(rowDnis));
   if(state.review&&JSON.stringify(state.review)!==JSON.stringify(nextReview)){state.decisions={};q("importInfo").textContent="Han cambiado los datos o coincidencias. Revisa de nuevo las decisiones."}
   state.review=nextReview;
   state.decisions=state.decisions||{};
   state.review.forEach((r,i)=>{if(r.issues.length)errors.push(`Fila ${i+2}: ${r.issues.join(" · ")}`);if(r.matches.length){duplicates++;state.duplicateRows.add(i)}});
   const lr=await sb.rpc("crm_list_labels");if(lr.error)throw lr.error;state.crmLabels=lr.data||[];const existingLabels=new Set(state.crmLabels.map(x=>norm(x.name)));state.importLabels=uniqueLabels(state.rawRows.flatMap(raw=>splitLabels(readMapped(raw,"labels"))));state.newLabels=state.importLabels.filter(name=>!existingLabels.has(norm(name)));
  }else state.rawRows.forEach((raw,i)=>{if(!readMapped(raw,"title"))errors.push(`Fila ${i+2}: falta el título de la oportunidad.`)});
  const custom=Object.entries(state.mapping).filter(([,v])=>v==="custom").length;
  state.errors=errors;q("importSummary").innerHTML=`<div><b>${state.rawRows.length}</b>filas encontradas</div><div><b>${state.type==="contact"?state.review.filter(r=>!r.matches.length&&!r.issues.length).length:state.rawRows.length-errors.length}</b>sin avisos</div><div class="importWarn"><b>${duplicates}</b>coincidencias en CRM</div><div><b>${errors.length}</b>filas con revisión</div><div><b>${custom}</b>campos adicionales</div>${state.type==="contact"?`<div><b>${state.newLabels?.length||0}</b>etiquetas nuevas</div>`:""}`;
  q("importErrors").textContent=errors.slice(0,8).join("\n")+(errors.length>8?`\n… y ${errors.length-8} más.`:"");
  renderPreview();q("runImport").disabled=state.type==="contact"?!validRows().length:!state.rawRows.length||state.rawRows.length===duplicates+errors.length;
 }
 const editableKeys=["NOMBRE","APELLIDOS","NOMBRE Y APELLIDOS","TELÉFONO","TELÉFONO 2","TELÉFONO 3","DNI / NIF","EMAIL","OBSERVACIONES","NOTAS"];
 function contactName(data){return clean(data["NOMBRE Y APELLIDOS"])||[data.NOMBRE,data.APELLIDOS].map(clean).filter(Boolean).join(" ")}
 const textKey=v=>clean(v).replace(/\s+/g," ");
 function identity(a,b){
  const ak=contactKeys(a),bk=contactKeys(b),an=norm(contactName(a)),bn=norm(contactName(b));
  const sameName=!!an&&an===bn,sameDni=!!ak.dni&&ak.dni===bk.dni,samePhone=ak.phones.some(p=>bk.phones.includes(p));
  return {confirmed:sameName&&samePhone&&!(ak.dni&&bk.dni&&ak.dni!==bk.dni),separate:!!an&&!!bn&&an!==bn&&!!ak.dni&&!!bk.dni&&ak.dni!==bk.dni};
 }
 function contactDiff(incoming,current){
  const sameName=norm(contactName(incoming))===norm(contactName(current));
  return editableKeys.flatMap(key=>{
   const before=clean(current[key]),value=clean(incoming[key]);if(!value)return [];
   if(["NOMBRE","APELLIDOS","NOMBRE Y APELLIDOS"].includes(key)&&sameName)return [];
   if(key.startsWith("TELÉFONO")&&contactKeys(current).phones.includes(digits(value)))return [];
   if(key==="DNI / NIF"&&dni(value)===contactKeys(current).dni)return [];
   if(key==="EMAIL"&&email(value)===contactKeys(current).email)return [];
   if(textKey(before)===textKey(value))return [];
   const isText=key==="NOTAS"||key==="OBSERVACIONES";
   if(isText&&before.split("\n\n[Importación Excel]\n").some(part=>textKey(part)===textKey(value)))return [];
   return [{key,before,incoming:value,after:isText&&before?before+"\n\n[Importación Excel]\n"+value:value,mode:!before?"complete":isText?"append":"replace"}];
  });
 }
 const reviewGroups={unchanged:"Duplicado · sin novedades",complete:"Duplicado · datos para completar",text:"Duplicado · textos para añadir",different:"Posible persona diferente · teléfono compartido",new:"Sin coincidencias detectadas",doubt:"Caso dudoso · revisar"};
 function classifyContact(r){
  const confirmed=r.matches.filter(m=>identity(r.data,m.data||{}).confirmed);
  if(r.blocked)return {group:"doubt",explanation:"Hay datos incompletos o con formato incorrecto que corregir."};
  if(confirmed.length===1&&!r.matches.some(m=>!identity(r.data,m.data||{}).confirmed&&m.reasons.includes("DNI"))){
   const target=confirmed[0],changes=contactDiff(r.data,target.data||{});
   if(changes.some(c=>c.mode==="replace"))return {group:"doubt",target,changes,explanation:"Coinciden nombre y teléfono sin DNI contradictorios, pero otros datos son distintos. Comprueba cuál es correcto."};
   return {group:changes.some(c=>c.mode==="append")?"text":changes.length?"complete":"unchanged",target,changes,explanation:"Coinciden nombre y al menos un teléfono, sin DNI contradictorios. No hace falta que ambos tengan DNI. Se ignoran mayúsculas, tildes, espacios y el prefijo +34."};
  }
  if(r.matches.length&&r.matches.every(m=>identity(r.data,m.data||{}).separate))return {group:"different",explanation:"El nombre y el DNI son distintos. No se permite mezclar estos contactos aunque compartan teléfono o correo."};
  if(!r.matches.length&&!r.peers.length&&!r.issues.length)return {group:"new",explanation:"No se ha encontrado coincidencia por teléfono, DNI o correo."};
  return {group:"doubt",explanation:"Faltan datos para confirmar la identidad, hay varias coincidencias o se repite dentro del Excel. No se considera duplicado automáticamente."};
 }
 function renderReviewSummary(){
  const counts=Object.fromEntries(Object.keys(reviewGroups).map(k=>[k,0]));state.review.forEach(r=>counts[r.classification.group]++);
  q("importSummary").innerHTML=`<div><b>${state.rawRows.length}</b>filas del Excel</div>`+Object.entries(reviewGroups).map(([k,label])=>`<div><b>${counts[k]}</b>${label}</div>`).join("");
  q("importErrors").textContent="Los duplicados sin novedades se ocultan de la lista y se omiten; su contador se conserva. Nada se guarda automáticamente. Notas y observaciones diferentes se añaden conservando el texto actual. La comparación de novedades cubre los datos principales, notas y observaciones; las etiquetas existentes se conservan.";
 }
 function reviewContacts(rows,existing,dniLists=[]){
  const keys=rows.map(data=>({...contactKeys(data),name:norm(contactName(data))})),stored=existing.map(r=>({...r,keys:{...contactKeys(r.data||{}),name:norm(contactName(r.data||{}))}}));
  const reasons=(a,b)=>[a.name&&a.name===b.name?"nombre y apellidos":"",a.dni&&a.dni===b.dni?"DNI":"",a.email&&a.email===b.email?"correo":"",a.phones.some(p=>b.phones.includes(p))?"teléfono":""].filter(Boolean);
  return rows.map((data,i)=>{
   const k=keys[i],issues=[];
   const matches=stored.map(r=>({...r,reasons:reasons(k,r.keys)})).filter(r=>r.reasons.length);
   const peers=keys.flatMap((other,j)=>j!==i&&reasons(k,other).length?[j+2]:[]);
   if(!clean(data["NOMBRE Y APELLIDOS"]))issues.push("Falta nombre");
   if(!k.phones.length&&!k.dni&&!k.email)issues.push("Sin teléfono, DNI ni correo");
   if(k.phones.some(p=>!/^\d{9}$/.test(p)&&!/^\d{10,15}$/.test(p)))issues.push("Teléfono incompleto o formato no válido");
   if((dniLists[i]||[]).length>1||/[|;]/.test(data["DNI / NIF"]||""))issues.push("Varios DNI en la misma fila");
   if(k.dni&&!/^(?:\d{8}[A-Z]|[XYZ]\d{7}[A-Z]|[A-Z]\d{7}[A-Z0-9])$/.test(k.dni))issues.push("Revisar formato del DNI/NIF");
   if(k.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(k.email))issues.push("Correo no válido");
   if(peers.length)issues.push("Coincide con filas del Excel: "+peers.join(", "));
   if(matches.some(r=>r.reasons.includes("teléfono")&&r.keys.dni&&k.dni&&r.keys.dni!==k.dni))issues.push("Teléfono compartido con otro DNI: pueden ser personas diferentes");
   const blocked=issues.some(x=>/Falta nombre|Teléfono incompleto|Varios DNI|formato del DNI|Correo no válido/.test(x));
   const result={data,matches,peers,issues,blocked};result.classification=classifyContact(result);return result;
  });
 }
 function canCreateContact(r){return !!r&&!r.blocked&&!r.matches.some(m=>m.reasons.includes("DNI")||identity(r.data,m.data||{}).confirmed)}

 function holderProposal(incoming,target){
  if(!target||!window.TPFContactParty)return {error:"Elige una ficha de contacto."};
  if(target.data?.TPF_TITULAR?.recipient==="holder")return {error:"Esta ficha envía WhatsApp al titular. Revisa el destinatario en la ficha antes de asignar otro titular desde el Excel."};
  if(identity(incoming,target.data||{}).confirmed)return {error:"Esta fila corresponde a la propia persona de contacto."};
  const old=target.data?.TPF_TITULAR||{},sameOld=norm(old.holder_name)===norm(contactName(incoming))&&(!old.holder_dni||!contactKeys(incoming).dni||dni(old.holder_dni)===contactKeys(incoming).dni);
  const candidate={same:false,holder_first_name:clean(incoming.NOMBRE)||contactName(incoming),holder_last_name:clean(incoming.APELLIDOS),holder_dni:contactKeys(incoming).dni||(sameOld?old.holder_dni:"")||"",holder_phone:clean(incoming["TELÉFONO"])||(sameOld?old.holder_phone:"")||"",recipient:"contact"};
  try{return {party:window.TPFContactParty.validate(candidate),old,textChanges:contactDiff(incoming,target.data||{}).filter(c=>c.key==="OBSERVACIONES"||c.key==="NOTAS")}}catch(e){return {error:e.message}}
 }

 function holderChoices(contacts,matches,query,targetId){
  const matchIds=new Set(matches.map(c=>String(c.id))),term=norm(query),phoneTerm=digits(query);
  const filtered=contacts.filter(c=>{
   if(!term)return matchIds.has(String(c.id));
   if(term.length<2)return false;
   const data=c.data||{},keys=contactKeys(data);
   return norm([contactName(data),keys.dni].join(" ")).includes(term)||(phoneTerm.length>=3&&keys.phones.some(p=>p.includes(phoneTerm)));
  }).sort((a,b)=>Number(matchIds.has(String(b.id)))-Number(matchIds.has(String(a.id)))||contactName(a.data||{}).localeCompare(contactName(b.data||{}),"es"));
  const list=filtered.slice(0,30),selected=contacts.find(c=>String(c.id)===targetId);
  if(selected&&!list.some(c=>String(c.id)===targetId))list.unshift(selected);
  return {list,total:filtered.length,matchIds};
 }
 function holderChoiceOptions(choices,targetId){
  return '<option value="">Seleccionar contacto existente</option>'+choices.list.map(c=>`<option value="${escHtml(c.id)}" ${String(c.id)===targetId?"selected":""}>${choices.matchIds.has(String(c.id))?"Coincidencia · ":""}${escHtml(contactName(c.data||{}))} · ${escHtml(contactKeys(c.data||{}).phone)} · ${escHtml(contactKeys(c.data||{}).dni)}</option>`).join("");
 }
 function holderChoiceHint(choices,query){
  return norm(query).length===1?"Escribe al menos 2 caracteres.":choices.total>30?"Se muestran 30 resultados. Afina la búsqueda.":choices.total?`${choices.total} ${clean(query)?"resultados":"contactos coincidentes"}. Elige la ficha para comprobarla.`:"No hay coincidencias. Busca por nombre, teléfono o DNI.";
 }

 function holderImportHtml(r,d,i){
  const contacts=state.contacts||[],target=contacts.find(c=>String(c.id)===d.target),p=holderProposal(r.data,target),choices=holderChoices(contacts,r.matches,d.holderQuery||"",d.target);
  return `<p>Elige la persona que gestiona el contrato:</p><input type="search" data-holder-search="${i}" aria-label="Buscar persona de contacto por nombre, teléfono o DNI" placeholder="Buscar nombre, teléfono o DNI…" value="${escHtml(d.holderQuery||"")}"><p data-holder-hint="${i}">${holderChoiceHint(choices,d.holderQuery||"")}</p><select data-holder-target="${i}">${holderChoiceOptions(choices,d.target)}</select>${target?`<p><b>Titular actual:</b> ${escHtml(p.old?.same===false?p.old.holder_name:target.data?.TPF_TITULAR?.holder_name||contactName(target.data||{}))} · ${escHtml(p.old?.holder_dni)}</p>`:""}${p.error?`<p>${escHtml(p.error)}</p>`:`<p><b>Titular propuesto:</b> ${escHtml(p.party.holder_name)}<br>DNI: ${escHtml(p.party.holder_dni)||"Sin DNI"}<br>Teléfono: ${escHtml(p.party.holder_phone)||"Sin teléfono"}</p><p>La ficha seguirá a nombre de ${escHtml(contactName(target.data||{}))}, con su teléfono actual. El nombre, DNI y teléfono del Excel se guardan en Titular del contrato. Se juntan observaciones con observaciones y notas con notas, conservando los textos existentes. Las etiquetas y el destinatario de WhatsApp se conservan.</p>${p.textChanges.map(c=>`<div style="margin:10px 0;white-space:pre-wrap"><b>${escHtml(c.key)} · Resultado al juntar:</b><br>${escHtml(c.after)}</div>`).join("")}${!p.textChanges.length?"<p>No hay notas ni observaciones nuevas que añadir.</p>":""}<label><input type="checkbox" data-holder-confirm="${i}" ${d.holderConfirmed?"checked":""}> Confirmo la relación y la sustitución del titular mostrado, si ya había uno.</label>`}`;
 }

 function allowedDecision(r,d,contacts=[]){
  if(!r||r.classification?.group==="unchanged"||r.blocked||!d||d.action==="skip")return false;
  if(d.action==="holder")return d.reviewed===true&&d.holderConfirmed===true&&!!holderProposal(r.data,contacts.find(c=>String(c.id)===d.target)).party;
  if(d.action==="create")return d.reviewed===true&&canCreateContact(r);
  if(d.action==="update")return r.matches.some(m=>!identity(r.data,m.data||{}).separate&&String(m.id)===d.target&&contactDiff(r.data,m.data||{}).some(c=>d.fields?.includes(c.key)))&&d.reviewed===true;
  return false;
 }
 function renderContactReview(){
  renderReviewSummary();
  q("previewHead").innerHTML="<tr><th>Fila / Contacto</th><th>Revisión y coincidencias</th><th>Decisión</th></tr>";
  q("previewRows").innerHTML=state.review.map((r,i)=>{
   if(r.classification.group==="unchanged"){state.decisions[i]={action:"skip",fields:[]};return ""}
   const d=state.decisions[i]||{action:"skip",fields:[]};state.decisions[i]=d;
   const eligible=r.matches.filter(m=>!identity(r.data,m.data||{}).separate),classification=r.classification;
   const target=eligible.find(m=>String(m.id)===d.target),changes=target?contactDiff(r.data,target.data||{}):[];
   return `<tr><td style="vertical-align:top;min-width:180px">${i+2} · <b>${escHtml(r.data["NOMBRE Y APELLIDOS"])||"Sin nombre"}</b><br>${escHtml(contactKeys(r.data).phones.join(" · "))}<br>${escHtml(r.data["DNI / NIF"])}<details><summary>Ver todos los datos</summary>${state.headers.map(h=>`<div><b>${escHtml(h)}:</b> ${escHtml(state.rawRows[i][h])}</div>`).join("")}</details></td>
   <td style="white-space:normal;min-width:250px"><b style="color:#175cd3">${reviewGroups[classification.group]}</b><p>${escHtml(classification.explanation)}</p>${classification.changes?.length?`<p><b>Información que aporta el Excel:</b></p>${classification.changes.map(c=>`<div style="margin:6px 0"><b>${escHtml(c.key)}</b> · ${c.mode==="complete"?"Falta en el CRM":c.mode==="append"?"Añadir conservando el texto actual":"Dato diferente"}<br>${escHtml(c.incoming)}</div>`).join("")}`:""}${state.completed.has(i)?"Ya guardada en este intento":r.issues.length?`<b style="color:#a15c00">Revisar</b><ul>${r.issues.map(x=>`<li>${escHtml(x)}</li>`).join("")}</ul>`:r.matches.length?"Coincidencia en CRM":"Nuevo contacto, sin coincidencias detectadas"}${r.matches.map(m=>`<p><b>${escHtml(m.data?.["NOMBRE Y APELLIDOS"]||[m.data?.NOMBRE,m.data?.APELLIDOS].filter(Boolean).join(" ")||m.id)}</b><br>Coincide por ${m.reasons.join(" y ")} · DNI: ${escHtml(m.keys.dni)||"sin DNI"}<br>${escHtml(m.keys.phones.join(" · "))}</p>`).join("")}</td>
   <td style="white-space:normal;min-width:260px"><select data-decision="${i}" ${state.completed.has(i)?"disabled":""}><option value="skip">Omitir por ahora</option>${canCreateContact(r)?`<option value="create" ${d.action==="create"?"selected":""}>Crear contacto nuevo</option>`:""}${!r.blocked&&eligible.length?`<option value="update" ${d.action==="update"?"selected":""}>Actualizar contacto existente</option>`:""}${!r.blocked?`<option value="holder" ${d.action==="holder"?"selected":""}>Asignar titular y juntar notas</option>`:""}</select>
   ${d.action==="holder"?holderImportHtml(r,d,i):""}
   ${d.action==="update"?`<p><b>Esta opción cambia datos de la persona de contacto.</b> Si el Excel corresponde al titular del contrato, elige «Asignar titular y juntar notas» para conservar la ficha actual.</p><select data-target="${i}"><option value="">Elige el contacto que has comprobado</option>${eligible.map(m=>`<option value="${escHtml(m.id)}" ${String(m.id)===d.target?"selected":""}>${escHtml(m.data?.["NOMBRE Y APELLIDOS"]||m.data?.NOMBRE||m.id)} · ${escHtml(m.keys.dni)}</option>`).join("")}</select><p>Marca solo los campos que quieres cambiar. Los vacíos no borran datos. Las notas y observaciones distintas se añaden; no sustituyen el texto actual. Se conservan las etiquetas, titular y campos adicionales del CRM.</p>${changes.map(c=>`<label style="display:block;margin:8px 0"><input type="checkbox" data-field-row="${i}" data-field="${escHtml(c.key)}" ${d.fields?.includes(c.key)?"checked":""}> <b>${escHtml(c.key)}</b> · ${c.mode==="complete"?"Completar":c.mode==="append"?"Conservar ambos textos":"Cambiar valor"}<br>Actual: ${escHtml(c.before)||"Vacío"}<br>Resultado: ${escHtml(c.after)}</label>`).join("")}`:""}
   ${r.blocked?"<p>Corrige estos datos en el Excel y vuelve a generar la vista previa.</p>":""}${d.action!=="skip"?`<label style="display:block;margin-top:10px"><input type="checkbox" data-reviewed="${i}" ${d.reviewed?"checked":""}> ${d.action==="create"&&r.matches.length?"Confirmo que es otra persona y quiero crear una ficha nueva.":"He comprobado los datos y esta decisión."}</label>`:""}</td></tr>`;
  }).join("")||'<tr><td colspan="3">No quedan filas para revisar. Los duplicados sin novedades se han omitido.</td></tr>';
  const root=q("previewRows"),refresh=()=>{renderContactReview();q("runImport").disabled=!validRows().length;q("importInfo").textContent=`${state.rawRows.length} filas · ${validRows().length} seleccionadas para guardar. El resto se omitirá.`};
  root.querySelectorAll("[data-decision]").forEach(el=>el.onchange=()=>{const r=state.review[el.dataset.decision];state.decisions[el.dataset.decision]={action:el.value,target:el.value==="update"?String(r.classification.target?.id||""):"",fields:[],reviewed:false};refresh()});
  root.querySelectorAll("[data-holder-search]").forEach(el=>el.oninput=()=>{
   const i=Number(el.dataset.holderSearch),d=state.decisions[i];d.holderQuery=el.value;
   const choices=holderChoices(state.contacts||[],state.review[i].matches,el.value,d.target);
   root.querySelector('[data-holder-target="'+i+'"]').innerHTML=holderChoiceOptions(choices,d.target);
   root.querySelector('[data-holder-hint="'+i+'"]').textContent=holderChoiceHint(choices,el.value);
  });
  root.querySelectorAll("[data-holder-target]").forEach(el=>el.onchange=()=>{Object.assign(state.decisions[el.dataset.holderTarget],{target:el.value,holderConfirmed:false,reviewed:false});refresh()});
  root.querySelectorAll("[data-holder-confirm]").forEach(el=>el.onchange=()=>{Object.assign(state.decisions[el.dataset.holderConfirm],{holderConfirmed:el.checked,reviewed:false});refresh()});
  root.querySelectorAll("[data-target]").forEach(el=>el.onchange=()=>{Object.assign(state.decisions[el.dataset.target],{target:el.value,fields:[],reviewed:false});refresh()});
  root.querySelectorAll("[data-field-row]").forEach(el=>el.onchange=()=>{const d=state.decisions[el.dataset.fieldRow];d.fields=d.fields.filter(k=>k!==el.dataset.field);if(el.checked)d.fields.push(el.dataset.field);d.reviewed=false;refresh()});
  root.querySelectorAll("[data-reviewed]").forEach(el=>el.onchange=()=>{state.decisions[el.dataset.reviewed].reviewed=el.checked;refresh()});
 }

 function renderPreview(){
  if(state.type==="contact"){renderContactReview();return}
  const headers=state.headers.slice(0,12);q("previewHead").innerHTML="<tr>"+headers.map(h=>`<th>${escHtml(h)}</th>`).join("")+"</tr>";
  q("previewRows").innerHTML=state.rawRows.slice(0,10).map((r,i)=>`<tr ${state.duplicateRows.has(i)?'style="opacity:.55" title="Duplicado: se omitirá"':""}>${headers.map(h=>`<td>${escHtml(r[h])}</td>`).join("")}</tr>`).join("");
 }
 async function preview(){
  const f=q("excelFile").files[0];if(!f){alert("Selecciona un Excel");return}q("runImport").disabled=true;q("importInfo").textContent="Leyendo Excel…";
  const data=await f.arrayBuffer(),wb=XLSX.read(new Uint8Array(data),{type:"array",raw:false,cellDates:true});const dest=q("destination").value;
  ensureUi();let sheetPicker=q("importSheetChoice");if(!sheetPicker){sheetPicker=document.createElement("select");sheetPicker.id="importSheetChoice";sheetPicker.setAttribute("aria-label","Hoja del Excel para revisar");q("importMapping").prepend(sheetPicker);sheetPicker.onchange=()=>preview().catch(e=>q("importInfo").textContent=e.message)}
  if(sheetPicker.dataset.file!==f.name){sheetPicker.innerHTML=wb.SheetNames.map(n=>`<option>${escHtml(n)}</option>`).join("");sheetPicker.dataset.file=f.name;sheetPicker.value=wb.SheetNames.find(n=>norm(n)==="revisar no importar")||wb.SheetNames[0]}
  const target=wb.SheetNames.includes(sheetPicker.value)?sheetPicker.value:wb.SheetNames.find(n=>norm(n)===norm(dest)||dest==="BASE DE DATOS"&&["contactos","base de datos"].includes(norm(n))||dest==="OPORTUNIDADES"&&["oportunidades","ventas"].includes(norm(n)))||wb.SheetNames[0];
  const rows=XLSX.utils.sheet_to_json(wb.Sheets[target],{header:1,defval:"",raw:false,blankrows:false});const hi=typeof findHeader==="function"?findHeader(rows):0;
  const headers=(rows[hi]||[]).map((h,i)=>clean(h)||`Columna ${i+1}`), rawRows=rows.slice(hi+1).filter(r=>r.some(v=>clean(v))).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??""])));
  const type=dest==="BASE DE DATOS"?"contact":"opportunity",mapping=Object.fromEntries(headers.map(h=>[h,rawRows.some(r=>clean(r[h])!=="")?guess(h,type):"ignore"]));
  state={completed:new Set(),file:f.name,sheet:target,type,headers,rawRows,mapping,duplicateRows:new Set(),errors:[]};ensureUi();q("importMapping").classList.remove("hidden");
  q("importMapGrid").innerHTML=headers.map((h,i)=>`<label for="importMap_${i}">${escHtml(h)}</label><select id="importMap_${i}" data-header="${escHtml(h)}">${options(type,mapping[h])}</select>`).join("");
  q("importMapGrid").querySelectorAll("select").forEach(s=>s.onchange=()=>{state.mapping[s.dataset.header]=s.value;state.decisions={};analyse().catch(e=>q("importErrors").textContent=e.message)});
  q("importInfo").textContent=`${rawRows.length} filas en “${target}”. Revisa la asignación antes de confirmar.`;await analyse();
 }
 function validRows(){if(state.type==="contact")return state.rawRows.map((raw,i)=>({raw,i,decision:state.decisions[i]})).filter(x=>!state.completed.has(x.i)&&allowedDecision(state.review[x.i],x.decision,state.contacts));return state.rawRows.map((raw,i)=>({raw,i})).filter(x=>!state.duplicateRows.has(x.i)&&!state.errors.some(e=>e.startsWith(`Fila ${x.i+2}:`)))}
 async function ensureContactFields(names){
  const {data,error}=await sb.rpc("crm_list_custom_fields");if(error)throw error;let fields=data||[];
  for(const name of names)if(!fields.some(f=>norm(f.name)===norm(name))){const {error:e}=await sb.rpc("crm_create_custom_field",{p_name:name,p_field_type:"text",p_options:[]});if(e)throw e}
  const again=await sb.rpc("crm_list_custom_fields");if(again.error)throw again.error;return new Map((again.data||[]).map(f=>[norm(f.name),f]));
 }
 async function ensureLabels(){
  let rows=state.crmLabels||[];
  for(const name of state.newLabels||[]){const r=await sb.rpc("crm_create_label",{p_name:name});if(r.error)throw r.error}
  if(state.newLabels?.length){const again=await sb.rpc("crm_list_labels");if(again.error)throw again.error;rows=again.data||[]}
  return new Map(rows.map(label=>[norm(label.name),label]));
 }
 async function importContacts(rows){
  const existingLabels=new Set((state.crmLabels||[]).map(l=>norm(l.name)));
  state.newLabels=uniqueLabels(rows.filter(r=>r.decision.action==="create").flatMap(r=>splitLabels(readMapped(r.raw,"labels")))).filter(n=>!existingLabels.has(norm(n)));
  const creating=rows.some(r=>r.decision.action==="create"),customNames=Object.entries(state.mapping).filter(([,v])=>v==="custom").map(([h])=>h),fields=creating?await ensureContactFields(customNames):new Map(),labelMap=creating?await ensureLabels():new Map();let done=0;
  for(const {raw,i,decision} of rows){
   if(decision?.action==="holder"){
    const target=state.contacts.find(c=>String(c.id)===decision.target),proposal=holderProposal(contactData(raw),target);
    if(!proposal.party||!decision.holderConfirmed)throw new Error(proposal.error||"Confirma el titular.");
    const next={...target.data,TPF_TITULAR:proposal.party};proposal.textChanges.forEach(c=>next[c.key]=c.after);
    const saved=await sb.from("records").update({data:next}).eq("id",target.id).eq("data",JSON.stringify(target.data)).select("id");
    if(saved.error)throw saved.error;if(saved.data?.length!==1)throw new Error("La ficha ha cambiado. Genera una nueva vista previa antes de continuar.");
    state.completed.add(i);done++;progress(done,rows.length);continue;
   }
   if(decision?.action==="update"){
    const target=state.review[i].matches.find(r=>String(r.id)===decision.target);
    const changes=contactDiff(contactData(raw),target.data||{}).filter(c=>decision.fields?.includes(c.key));
    const next={...target.data};changes.forEach(c=>next[c.key]=c.after);
    const saved=await sb.from("records").update({data:next}).eq("id",target.id).eq("data",JSON.stringify(target.data)).select("id");
    if(saved.error)throw saved.error;if(saved.data?.length!==1)throw new Error(`Fila ${i+2}: el contacto ha cambiado. Genera otra vista previa.`);
    state.completed.add(i);done++;progress(done,rows.length);continue;
   }
   const payload={source_sheet:"BASE DE DATOS",source_row:i+2,data:contactData(raw)};const {data,error}=await sb.from("records").insert(payload).select("id").single();if(error)throw error;state.completed.add(i);
   const values=Object.entries(extraValues(raw)).map(([name,value])=>({field_id:fields.get(norm(name))?.id,value:clean(value)})).filter(x=>x.field_id&&x.value!=="");if(values.length){const saved=await sb.rpc("crm_set_contact_custom_values",{p_contact_id:String(data.id),p_values:values});if(saved.error)throw saved.error}
   const labelIds=splitLabels(readMapped(raw,"labels")).map(name=>labelMap.get(norm(name))?.id).filter(Boolean);if(labelIds.length){const saved=await sb.rpc("crm_set_contact_labels",{p_contact_id:String(data.id),p_label_ids:[...new Set(labelIds)]});if(saved.error)throw saved.error}done++;progress(done,rows.length)}
  if(typeof crmLoadCustomFields==="function")await crmLoadCustomFields();
 }
 async function ensureSalesFields(names){
  let r=await sb.from("sales_custom_fields").select("id,label,field_key").eq("active",true);if(r.error)throw r.error;let fields=r.data||[];
  for(const name of names)if(!fields.some(f=>norm(f.label)===norm(name))){const a=await sb.rpc("add_sales_custom_field",{field_label:name,field_type:"text"});if(a.error)throw a.error}
  r=await sb.from("sales_custom_fields").select("id,label,field_key").eq("active",true);if(r.error)throw r.error;return new Map((r.data||[]).map(f=>[norm(f.label),f]));
 }
 function number(v){const s=clean(v).replace(/\s/g,"").replace(/\.(?=\d{3}(?:\D|$))/g,"").replace(",", ".").replace(/[^0-9.-]/g,"");const n=Number(s);return Number.isFinite(n)?n:null}
 function date(v){const s=clean(v);if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);const m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);return m?`${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`:null}
 async function importOpportunities(rows){
  const st=await sb.from("sales_stages").select("id,pipeline_id,name").eq("active",true).order("position");if(st.error||!st.data?.length)throw st.error||new Error("No hay columnas de ventas activas.");
  const contacts=await allContacts(), contactMap=new Map();contacts.forEach(r=>{const k=contactKeys(r.data||{});k.phones.forEach(v=>contactMap.set("phone:"+v,r.id));if(k.dni)contactMap.set("dni:"+k.dni,r.id);if(k.email)contactMap.set("email:"+k.email,r.id)});
  const customNames=Object.entries(state.mapping).filter(([,v])=>v==="custom").map(([h])=>h),fields=await ensureSalesFields(customNames);let done=0;
  for(const {raw} of rows){const stageName=norm(readMapped(raw,"stage")),stage=st.data.find(s=>norm(s.name)===stageName)||st.data[0],p=digits(readMapped(raw,"phone")),d=dni(readMapped(raw,"dni")),e=email(readMapped(raw,"email")),recordId=contactMap.get("dni:"+d)||contactMap.get("phone:"+p)||contactMap.get("email:"+e)||null;
   const payload={pipeline_id:stage.pipeline_id,stage_id:stage.id,record_id:recordId,title:readMapped(raw,"title"),client_name:readMapped(raw,"client_name")||null,phone:readMapped(raw,"phone")||null,amount:number(readMapped(raw,"amount")),expected_date:date(readMapped(raw,"expected_date")),notes:readMapped(raw,"notes")||null};
   const ins=await sb.from("sales_opportunities").insert(payload).select("id").single();if(ins.error)throw ins.error;const vals=Object.entries(extraValues(raw)).map(([name,value])=>({opportunity_id:ins.data.id,field_id:fields.get(norm(name))?.id,value:clean(value)})).filter(x=>x.field_id&&x.value!=="");if(vals.length){const vr=await sb.from("sales_custom_values").upsert(vals);if(vr.error)throw vr.error}done++;progress(done,rows.length)}
  if(typeof loadSales==="function")await loadSales();
 }
 function progress(done,total){q("importBar").style.width=`${done/total*100}%`;q("importInfo").textContent=`Importados ${done} / ${total}`}
 async function run(){
  if(running)return;running=true;q("runImport").disabled=true;
  try{await runSelected()}catch(e){q("importInfo").textContent="Importación detenida: "+(e.message||e)}finally{running=false;if(state)q("runImport").disabled=!validRows().length}
 }
 async function runSelected(){
  if(!(perms?.is_admin||perms?.can_manage_imports)){alert("Sin permiso");return}if(!state)return;await analyse();const rows=validRows();if(!rows.length){alert("No hay filas seleccionadas y válidas para importar.");return}
  const labelNotice=state.type==="contact"&&state.newLabels?.length?`\n\nSe crearán ${state.newLabels.length} etiquetas nuevas en MAYÚSCULAS y se asignarán sin iniciar automatizaciones.`:"";
  if(!confirm(`¿Importar ${rows.length} filas válidas en ${state.type==="contact"?"Contactos":"Oportunidades"}? Solo se guardarán las decisiones seleccionadas. Revisa los cambios antes de confirmar.${labelNotice}`))return;
  q("runImport").disabled=true;try{if(state.type==="contact")await importContacts(rows);else await importOpportunities(rows);q("importInfo").textContent=`Importación terminada: ${rows.length} filas procesadas. Las columnas adicionales se han conservado.`;state=null;q("importMapping").classList.add("hidden")}catch(e){q("importInfo").textContent="Importación detenida: "+(e.message||e)+". Puede haber filas ya guardadas; genera una nueva vista previa antes de continuar.";renderPreview();q("runImport").disabled=false}
 }
 function bind(){ensureUi();legacyPreview=q("previewImport").onclick;legacyRun=q("runImport").onclick;q("previewImport").onclick=e=>isGuided()?preview().catch(err=>{q("importInfo").textContent="No se pudo leer el Excel: "+err.message}):legacyPreview?.call(q("previewImport"),e);q("runImport").onclick=e=>isGuided()?run():legacyRun?.call(q("runImport"),e);q("destination").addEventListener("change",()=>{state=null;q("importMapping").classList.add("hidden");q("runImport").disabled=true;q("previewHead").innerHTML="";q("previewRows").innerHTML=""})}
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind);else bind();
 window.TPFImportMapping={norm,guess,digits,contactKeys,number,date,splitLabels,reviewContacts,contactDiff,allowedDecision,identity,classifyContact,holderProposal,holderChoices};
})();

