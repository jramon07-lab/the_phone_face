/* TPF physical module split · generated from app-core.js */
const SB_URL='https://overfzbjtpjqxzbujezg.supabase.co', SB_KEY='sb_publishable_o6_eM5v04EBInhfiSnyFLA_5yRHlB4j';
let sb=null;
if(window.supabase){
  sb=window.supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
}else{
  window.addEventListener("load",()=>{const el=document.getElementById("loginMsg");if(el)el.textContent="No se pudo cargar la conexión. Recarga la página o prueba en Safari sin bloqueadores.";});
}
let perms=null, importRows=[], importHeaders=[];


const $=id=>document.getElementById(id);
function setSidebarCollapsed(collapsed){
  document.body.classList.toggle("sidebarCollapsed",!!collapsed);
  const b=$("sidebarToggle");
  if(b){
    b.textContent=collapsed?"›":"‹";
    b.title=collapsed?"Mostrar menú":"Ocultar menú";
    b.setAttribute("aria-label",b.title);
  }
  try{localStorage.setItem("tpf_sidebar_collapsed",collapsed?"1":"0")}catch(e){}
}
setTimeout(()=>{
  let saved=false;
  try{saved=localStorage.getItem("tpf_sidebar_collapsed")==="1"}catch(e){}
  setSidebarCollapsed(saved);
  if($("sidebarToggle"))$("sidebarToggle").onclick=()=>setSidebarCollapsed(!document.body.classList.contains("sidebarCollapsed"));
},0);

const esc=s=>String(s??"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[m]));

async function loadSession(){
 if(!sb)return;
 try{
   const {data}=await sb.auth.getSession();
   if(data.session) await enterApp(data.session.user);
 }catch(e){
   $("loginMsg").textContent="No se pudo recuperar la sesión.";
 }
}
async function enterApp(user){
 window.__tpfUserId=user?.id||"anonymous";
 await sb.rpc("bootstrap_user_permissions");
 const {data,error}=await sb.rpc("current_user_permissions");
 if(error){alert(error.message);return}
 perms=data;
 $("login").classList.add("hidden");$("app").classList.remove("hidden");
 $("who").textContent=perms?.display_name||user.email;
 if($("sideWho"))$("sideWho").textContent=perms?.display_name||user.email;
 if($("sideRole"))$("sideRole").textContent=perms?.is_admin?"Administrador":"Usuario";
 crmApplyExpandedPermissions();
 loadSales();
}
async function doSignIn(){
 const btn=$("signin");
 const email=$("email").value.trim();
 const password=$("password").value;
 if(!email||!password){$("loginMsg").textContent="Escribe correo y contraseña.";return}
 if(!window.supabase){$("loginMsg").textContent="No se ha podido cargar la conexión. Cierra Safari y vuelve a abrir la página.";return}
 btn.disabled=true;btn.textContent="Entrando…";$("loginMsg").textContent="Conectando…";
 try{
   const timeout=new Promise((_,rej)=>setTimeout(()=>rej(new Error("La conexión está tardando demasiado. Comprueba internet y vuelve a intentarlo.")),15000));
   const login=sb.auth.signInWithPassword({email,password});
   const {data,error}=await Promise.race([login,timeout]);
   if(error){$("loginMsg").textContent=error.message;return}
   if(data?.user){$("loginMsg").textContent="Acceso correcto";await enterApp(data.user)}
   else $("loginMsg").textContent="No se pudo iniciar sesión.";
 }catch(e){
   $("loginMsg").textContent=e?.message||"Error de conexión.";
 }finally{
   btn.disabled=false;btn.textContent="Entrar";
 }
}
$("signin").onclick=doSignIn;
$("email").addEventListener("keydown",e=>{if(e.key==="Enter")$("password").focus()});
$("password").addEventListener("keydown",e=>{if(e.key==="Enter")doSignIn()});
$("signup").onclick=async()=>{
 const {data,error}=await sb.auth.signUp({email:$("email").value,password:$("password").value});
 $("loginMsg").textContent=error?error.message:"Cuenta creada. Si se solicita confirmación por email, confírmala antes de entrar.";
};
$("logout").onclick=async()=>{await sb.auth.signOut();location.reload()};

document.querySelectorAll(".nav").forEach(n=>n.onclick=()=>{
 if(n.dataset.view==="system" && !perms?.is_admin){alert("Solo el administrador puede ver Estado del sistema.");return}
 closeOpenDetailScreensForNavigation();
 document.querySelectorAll('.referenceWorkspace main > section[id^="view-"]').forEach(section=>section.classList.add("hidden"));
 document.querySelectorAll("dialog[open]").forEach(dialog=>{try{dialog.close()}catch(_){dialog.removeAttribute("open")}});
 if(!n.dataset.tpfBackNavigation)tpfPushView(n.dataset.view);
 else window.__tpfCurrentView=n.dataset.view;
 if($("waQuickModal"))$("waQuickModal").classList.add("hidden");
 if($("waQuickScheduleBox"))$("waQuickScheduleBox").classList.add("hidden");
 document.querySelectorAll(".nav").forEach(x=>x.classList.remove("active"));n.classList.add("active");
 ["dashboard","alerts","search","database","sales","import","agenda","whatsapplive","whatsapp","labels","settings","automations","users","system","trash"].forEach(v=>$("view-"+v).classList.toggle("hidden",v!==n.dataset.view));
 if(n.dataset.view==="search" && typeof n.dataset.sheet!=="undefined"){
   $("searchSheet").value=n.dataset.sheet||"";
   if(n.dataset.sheet){$("searchText").value="";$("searchBtn").click();}
 }
 if(n.dataset.view==="dashboard")loadDashboard();
 if(n.dataset.view==="alerts")loadAlerts();
 if(n.dataset.view==="trash")loadTrash();
 if(n.dataset.view==="whatsapplive")loadWhatsAppLive();
 if(n.dataset.view==="sales")loadSales();
 if(n.dataset.view==="agenda")loadAgenda();
 if(n.dataset.view==="whatsapp")loadWhatsappPrograms();
 if(n.dataset.view==="settings"){loadGoogleSettings();loadNotifySettings();}
 if(n.dataset.view==="automations")loadAutomations();
 if(n.dataset.view==="users")loadUsersAdmin();
 if(n.dataset.view==="system")loadSystemStatus();
});

let lastSearchRows=[];
let lastSearchKeys=[];

function searchSourceKey(){
  return $("searchSheet").value || "TODAS";
}
function searchColumnsBaseKey(source){
  return "search_columns_"+String(source||"TODAS").replace(/\s+/g,"_").toUpperCase();
}
function currentUserConfigId(){
  if(perms?.is_admin && $("settingsSearchUserSelect")?.value){
    return $("settingsSearchUserSelect").value;
  }
  return window.__tpfUserId || "anonymous";
}
function searchColumnsSettingKey(source){
  return searchColumnsBaseKey(source)+"__user__"+currentUserConfigId();
}
function searchColumnsGlobalSettingKey(source){
  return searchColumnsBaseKey(source);
}
function searchColumnsStorageKey(source){
  return "tpf_"+searchColumnsSettingKey(source);
}
function searchDefaultColumns(keys){
  const priority=[
    "NOMBRE Y APELLIDOS","NOMBRE","APELLIDOS","CLIENTE","CLIENTE FINAL",
    "TELÉFONO","TELEFONO","PHONE","MOVIL",
    "DNI / NIF","DNI","NIF","EMAIL","Email","email",
    "CONCEPTO","PRODUCTO","NOTAS","OBSERVACIONES"
  ];
  const result=[];
  for(const p of priority) if(keys.includes(p) && !result.includes(p)) result.push(p);
  if(!result.length) result.push(...keys.slice(0,6));
  return result.slice(0,8);
}
const searchColumnsCache={};
function searchColumnsCacheKey(source){return currentUserConfigId()+"::"+source;}
async function loadSavedSearchColumns(source,keys){
  const ck=searchColumnsCacheKey(source);
  if(searchColumnsCache[ck]) return searchColumnsCache[ck].filter(k=>keys.includes(k));

  // 1. Configuración personal del usuario
  try{
    const {data}=await sb.from("app_settings")
      .select("value")
      .eq("key",searchColumnsSettingKey(source))
      .maybeSingle();
    if(Array.isArray(data?.value)){
      searchColumnsCache[ck]=data.value;
      localStorage.setItem(searchColumnsStorageKey(source),JSON.stringify(data.value));
      return data.value.filter(k=>keys.includes(k));
    }
  }catch(e){}

  // 2. Si todavía no tiene configuración propia, hereda la general
  try{
    const {data}=await sb.from("app_settings")
      .select("value")
      .eq("key",searchColumnsGlobalSettingKey(source))
      .maybeSingle();
    if(Array.isArray(data?.value)){
      searchColumnsCache[ck]=data.value;
      return data.value.filter(k=>keys.includes(k));
    }
  }catch(e){}

  // 3. Fallback local del propio navegador
  try{
    const raw=localStorage.getItem(searchColumnsStorageKey(source));
    if(raw){
      const arr=JSON.parse(raw);
      if(Array.isArray(arr)){
        searchColumnsCache[ck]=arr;
        return arr.filter(k=>keys.includes(k));
      }
    }
  }catch(e){}

  return searchDefaultColumns(keys);
}
function getCachedSearchColumns(source,keys){
  const ck=searchColumnsCacheKey(source);
  if(searchColumnsCache[ck]) return searchColumnsCache[ck].filter(k=>keys.includes(k));
  try{
    const raw=localStorage.getItem(searchColumnsStorageKey(source));
    if(raw){
      const arr=JSON.parse(raw);
      if(Array.isArray(arr)){
        searchColumnsCache[ck]=arr;
        return arr.filter(k=>keys.includes(k));
      }
    }
  }catch(e){}
  return searchDefaultColumns(keys);
}
async function renderSearchResults(rows){
  lastSearchRows=rows||[];
  const keys=[];
  (rows||[]).forEach(r=>Object.keys(r.data||{}).forEach(k=>{if(!keys.includes(k))keys.push(k)}));
  lastSearchKeys=keys;

  const source=searchSourceKey();
  let visible=await loadSavedSearchColumns(source,keys);

  // If user intentionally saved zero columns, still keep actions.
  $("searchHead").innerHTML="<tr>"+visible.map(k=>"<th>"+esc(k)+"</th>").join("")+"<th>Acciones</th></tr>";
  $("searchRows").innerHTML=(rows||[]).map(r=>{
    const d=r.data||{};
    const name=d["NOMBRE Y APELLIDOS"]||d["NOMBRE"]||d["CLIENTE"]||d["CLIENTE FINAL"]||"";
    const phone=d["TELÉFONO"]||d["TELEFONO"]||d["PHONE"]||d["MOVIL"]||"";
    return "<tr>"+visible.map(k=>"<td>"+esc(d[k]??"")+"</td>").join("")+
    `<td><div class="contactActions">
      <button class="primary" onclick="openContact('${r.id}')">Ver ficha</button>
      <button class="secondary" onclick='createOppFromRecord(${JSON.stringify(JSON.stringify({id:r.id,name,phone}))})'>+ Oportunidad</button>
      <button class="secondary" onclick='createAgendaFromRecord(${JSON.stringify(JSON.stringify({id:r.id,name,phone}))})'>+ Agenda</button>
      <button class="secondary" onclick="showRelated('${r.id}')">Ver relación</button>
    </div></td></tr>`;
  }).join("");
}

function searchRowActions(r){
  const d=r.data||{};
  const name=d["NOMBRE Y APELLIDOS"]||d["NOMBRE"]||d["CLIENTE"]||d["CLIENTE FINAL"]||"";
  const phone=d["TELÉFONO"]||d["TELEFONO"]||d["PHONE"]||d["MOVIL"]||"";
  return `<div class="contactActions">
    <button class="primary" onclick="openContact('${r.id}')">Ver ficha</button>
    <button class="secondary" onclick='createOppFromRecord(${JSON.stringify(JSON.stringify({id:r.id,name,phone}))})'>+ Oportunidad</button>
    <button class="secondary" onclick='createAgendaFromRecord(${JSON.stringify(JSON.stringify({id:r.id,name,phone}))})'>+ Agenda</button>
    <button class="secondary" onclick="showRelated('${r.id}')">Ver relación</button>
  </div>`;
}


let lastUnifiedRows=[];
let lastUnifiedColumns=[];

function normalizeSearchFieldLabel(k){
  const x=String(k||"").trim();
  const u=x.toUpperCase();
  const aliases={
    "TELEFONO":"TELÉFONO","PHONE":"TELÉFONO","MOVIL":"TELÉFONO",
    "DNI":"DNI / NIF","NIF":"DNI / NIF",
    "NOMBRE":"NOMBRE Y APELLIDOS","CLIENTE":"NOMBRE Y APELLIDOS","CLIENTE FINAL":"NOMBRE Y APELLIDOS",
    "EMAIL":"EMAIL","E-MAIL":"EMAIL"
  };
  return aliases[u]||x;
}
function valueForUnifiedField(d,field){
  if(Object.prototype.hasOwnProperty.call(d,field)) return d[field];
  const target=normalizeSearchFieldLabel(field);
  for(const [k,v] of Object.entries(d||{})){
    if(normalizeSearchFieldLabel(k)===target) return v;
  }
  return "";
}

async function renderUnifiedSearchResults(rows){
  lastUnifiedRows=rows||[];

  const sourceKeys={};
  const allNormalized=[];
  for(const r of rows||[]){
    const source=String(r.source_sheet||"SIN ORIGEN").trim().toUpperCase();
    if(!sourceKeys[source]) sourceKeys[source]=new Set();
    const rawKeys=Object.keys(r.data||{});
    const configured=await loadSavedSearchColumns(source,rawKeys);
    configured.forEach(k=>{
      const nk=normalizeSearchFieldLabel(k);
      sourceKeys[source].add(nk);
      if(!allNormalized.includes(nk))allNormalized.push(nk);
    });
  }

  // Count in how many different source files each field exists.
  const frequency={};
  for(const k of allNormalized){
    frequency[k]=Object.values(sourceKeys).filter(set=>set.has(k)).length;
  }

  // Common fields first, then source-specific fields.
  const priority=["DNI / NIF","TELÉFONO","NOMBRE Y APELLIDOS","EMAIL","FECHA","NOTAS"];
  allNormalized.sort((a,b)=>{
    const fa=frequency[a]||0, fb=frequency[b]||0;
    if(fb!==fa)return fb-fa;
    const pa=priority.indexOf(a), pb=priority.indexOf(b);
    if(pa!==-1||pb!==-1){
      if(pa===-1)return 1;
      if(pb===-1)return -1;
      return pa-pb;
    }
    return a.localeCompare(b,"es");
  });

  lastUnifiedColumns=allNormalized;

  $("searchUnifiedSummary").innerHTML=
    `<b>${(rows||[]).length} resultados</b> · `+
    `${Object.keys(sourceKeys).length} orígenes · `+
    `Las columnas comunes aparecen primero.`;

  $("searchUnifiedHead").innerHTML="<tr><th>Origen</th>"+
    allNormalized.map(k=>`<th class="${(frequency[k]||0)>1?"commonFieldHead":""}">${esc(k)}</th>`).join("")+
    "<th>Acciones</th></tr>";

  $("searchUnifiedRows").innerHTML=(rows||[]).map(r=>{
    const d=r.data||{};
    return `<tr><td><span class="sourceBadge">${esc(r.source_sheet||"")}</span></td>`+
      allNormalized.map(k=>`<td>${esc(valueForUnifiedField(d,k)??"")}</td>`).join("")+
      `<td>${searchRowActions(r)}</td></tr>`;
  }).join("");
}

function exportUnifiedSearchToExcel(){
  if(!lastUnifiedRows.length)return;
  if(typeof XLSX==="undefined"){
    alert("No se ha podido cargar el módulo de Excel. Comprueba la conexión a internet y vuelve a intentarlo.");
    return;
  }

  const headers=["Origen",...lastUnifiedColumns];
  const data=[headers];

  for(const r of lastUnifiedRows){
    const d=r.data||{};
    data.push([
      r.source_sheet||"",
      ...lastUnifiedColumns.map(k=>valueForUnifiedField(d,k))
    ]);
  }

  const ws=XLSX.utils.aoa_to_sheet(data);

  // Widths for readability.
  ws["!cols"]=headers.map((h,i)=>{
    let max=String(h||"").length;
    for(let row=1;row<data.length;row++){
      max=Math.max(max,String(data[row][i]??"").length);
    }
    return {wch:Math.min(Math.max(max+2,10),35)};
  });

  // Autofilter across all exported columns.
  if(headers.length){
    ws["!autofilter"]={ref:XLSX.utils.encode_range({
      s:{r:0,c:0},
      e:{r:Math.max(data.length-1,0),c:headers.length-1}
    })};
  }

  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,"Resultados");

  const now=new Date();
  const pad=n=>String(n).padStart(2,"0");
  const filename=`Busqueda_ThePhoneFace_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.xlsx`;

  XLSX.writeFile(wb,filename,{compression:true});
}
if($("exportSearchExcel"))$("exportSearchExcel").onclick=exportUnifiedSearchToExcel;

async function renderGroupedSearchResults(rows){
  const order=["LIQUIDACION","DATA","CLAWBACK","AJUSTES","CONTACTOS"];
  const groups={};
  (rows||[]).forEach(r=>{
    const source=String(r.source_sheet||"SIN ORIGEN").trim().toUpperCase();
    (groups[source]||(groups[source]=[])).push(r);
  });
  const sources=[
    ...order.filter(s=>groups[s]?.length),
    ...Object.keys(groups).filter(s=>!order.includes(s))
  ];

  $("searchGroupedResults").innerHTML="";
  if(!sources.length){
    $("searchGroupedResults").innerHTML='<div class="card"><p class="muted">No se encontraron resultados.</p></div>';
    return;
  }

  for(const source of sources){
    const sourceRows=groups[source]||[];
    const keys=[];
    sourceRows.forEach(r=>Object.keys(r.data||{}).forEach(k=>{if(!keys.includes(k))keys.push(k)}));
    const visible=await loadSavedSearchColumns(source,keys);

    const section=document.createElement("section");
    section.className="searchSourceGroup";
    section.innerHTML=`
      <div class="searchSourceTitle">
        <h3>${esc(source)}</h3>
        <span class="searchSourceCount">${sourceRows.length} ${sourceRows.length===1?"resultado":"resultados"}</span>
      </div>
      <div class="scroll">
        <table>
          <thead><tr>${visible.map(k=>"<th>"+esc(k)+"</th>").join("")}<th>Acciones</th></tr></thead>
          <tbody>${sourceRows.map(r=>{
            const d=r.data||{};
            return "<tr>"+visible.map(k=>"<td>"+esc(d[k]??"")+"</td>").join("")+
              "<td>"+searchRowActions(r)+"</td></tr>";
          }).join("")}</tbody>
        </table>
      </div>`;
    $("searchGroupedResults").appendChild(section);
  }
}


$("searchBtn").onclick=async()=>{
 const q=$("searchText").value.trim(), sheet=$("searchSheet").value;
 const {data,error}=await sb.rpc("search_records",{search_text:q||null,sheet_filter:sheet||null,result_limit:100});
 if(error){alert(error.message);return}
 if(sheet){
   $("searchSingleResults").classList.remove("hidden");
   $("searchUnifiedResults").classList.add("hidden");
   $("searchGroupedResults").classList.add("hidden");
   $("exportSearchExcel").classList.add("hidden");
   await renderSearchResults(data||[]);
 }else{
   $("searchSingleResults").classList.add("hidden");
   $("searchGroupedResults").classList.add("hidden");
   $("searchUnifiedResults").classList.remove("hidden");
   if(perms?.is_admin)$("exportSearchExcel").classList.remove("hidden");
   else $("exportSearchExcel").classList.add("hidden");
   await renderUnifiedSearchResults(data||[]);
 }
};


async function logContactActivity(contactId,type,title,description=""){
  try{
    const {data:{user}}=await sb.auth.getUser();
    await sb.from("contact_activity").insert({
      contact_id:contactId,
      activity_type:type,
      title,
      description:description||null,
      created_by:user?.id||null
    });
  }catch(e){
    console.warn("No se pudo registrar actividad:",e?.message||e);
  }
}



let settingsSearchUsers=[];

async function loadSettingsSearchUsers(){
  const wrap=$("settingsSearchUserWrap");
  const select=$("settingsSearchUserSelect");
  if(!wrap||!select)return;

  if(!perms?.is_admin){
    wrap.classList.add("hidden");
    return;
  }

  const {data,error}=await sb.rpc("admin_list_users_permissions");
  if(error){
    wrap.classList.add("hidden");
    console.warn(error.message);
    return;
  }

  settingsSearchUsers=data||[];
  const myId=window.__tpfUserId||"";
  select.innerHTML=settingsSearchUsers.map(u=>
    `<option value="${u.user_id}" ${String(u.user_id)===String(myId)?"selected":""}>${esc(u.display_name||u.email||"Usuario")}${u.email?` · ${esc(u.email)}`:""}</option>`
  ).join("");
  wrap.classList.remove("hidden");

  select.onchange=async()=>{
    for(const k of Object.keys(searchColumnsCache))delete searchColumnsCache[k];
    await renderSettingsSearchColumns();
  };
}
function selectedSettingsUserName(){
  if(perms?.is_admin && $("settingsSearchUserSelect")?.value){
    const id=$("settingsSearchUserSelect").value;
    const u=settingsSearchUsers.find(x=>String(x.user_id)===String(id));
    return u?.display_name||u?.email||"Usuario";
  }
  return perms?.display_name||$("who")?.textContent||"Usuario";
}

let settingsSearchDetectedKeys=[];

async function detectColumnsForSource(source){
  $("settingsSearchColumnsMsg").textContent="Cargando campos...";
  const {data,error}=await sb.rpc("search_records",{search_text:null,sheet_filter:source,result_limit:100});
  if(error){
    $("settingsSearchColumnsMsg").textContent=error.message;
    return [];
  }
  const keys=[];
  (data||[]).forEach(r=>Object.keys(r.data||{}).forEach(k=>{if(!keys.includes(k))keys.push(k)}));
  settingsSearchDetectedKeys=keys;
  return keys;
}

async function renderSettingsSearchColumns(){
  const source=$("settingsSearchSource").value;
  if($("settingsSearchUser")){
    $("settingsSearchUser").innerHTML=`Configuración de columnas para <b>${esc(selectedSettingsUserName())}</b>`;
  }
  const keys=await detectColumnsForSource(source);
  $("settingsSearchColumnsInfo").innerHTML=`Configurando <b>${esc(source)}</b> · ${keys.length} campos detectados`;
  if(!keys.length){
    $("settingsSearchColumnsOptions").innerHTML='<div class="small">No se han detectado campos en este archivo.</div>';
    return;
  }
  const selected=new Set(await loadSavedSearchColumns(source,keys));
  $("settingsSearchColumnsOptions").innerHTML=keys.map(k=>`
    <label class="searchColumnOption">
      <input type="checkbox" value="${esc(k)}" ${selected.has(k)?"checked":""}>
      <span>${esc(k)}</span>
    </label>`).join("");
  $("settingsSearchColumnsMsg").textContent="";
}

$("settingsLoadColumns").onclick=renderSettingsSearchColumns;
$("settingsSearchSource").onchange=renderSettingsSearchColumns;
$("settingsSearchSelectAll").onclick=()=>document.querySelectorAll("#settingsSearchColumnsOptions input").forEach(x=>x.checked=true);
$("settingsSearchClear").onclick=()=>document.querySelectorAll("#settingsSearchColumnsOptions input").forEach(x=>x.checked=false);
$("settingsSearchDefault").onclick=()=>{
  const defaults=new Set(searchDefaultColumns(settingsSearchDetectedKeys||[]));
  document.querySelectorAll("#settingsSearchColumnsOptions input").forEach(x=>x.checked=defaults.has(x.value));
};
$("settingsSearchUseGlobal").onclick=async()=>{
  const source=$("settingsSearchSource").value;
  $("settingsSearchColumnsMsg").textContent="Cargando configuración general...";
  try{
    const {data,error}=await sb.from("app_settings")
      .select("value")
      .eq("key",searchColumnsGlobalSettingKey(source))
      .maybeSingle();
    if(error)throw error;
    const arr=Array.isArray(data?.value)?data.value:searchDefaultColumns(settingsSearchDetectedKeys||[]);
    const selected=new Set(arr);
    document.querySelectorAll("#settingsSearchColumnsOptions input").forEach(x=>x.checked=selected.has(x.value));
    $("settingsSearchColumnsMsg").textContent="Configuración general cargada. Pulsa Guardar configuración para aplicarla a este usuario.";
  }catch(e){
    $("settingsSearchColumnsMsg").textContent=e?.message||"No se pudo cargar la configuración general.";
  }
};

$("settingsSearchSave").onclick=async()=>{
  const source=$("settingsSearchSource").value;
  const selected=[...document.querySelectorAll("#settingsSearchColumnsOptions input:checked")].map(x=>x.value);
  $("settingsSearchColumnsMsg").textContent="Guardando...";
  const {error}=await sb.from("app_settings").upsert(
    {key:searchColumnsSettingKey(source),value:selected},
    {onConflict:"key"}
  );
  if(error){
    $("settingsSearchColumnsMsg").textContent=error.message;
    return;
  }
  searchColumnsCache[searchColumnsCacheKey(source)]=selected;
  localStorage.setItem(searchColumnsStorageKey(source),JSON.stringify(selected));
  $("settingsSearchColumnsMsg").textContent=`Configuración guardada para ${selectedSettingsUserName()} · ${source}`;
  if(searchSourceKey()===source && lastSearchRows.length) await renderSearchResults(lastSearchRows);
};
