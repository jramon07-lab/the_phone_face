(function(){
  'use strict';

  const SB_URL='https://overfzbjtpjqxzbujezg.supabase.co';
  const SB_KEY='sb_publishable_o6_eM5v04EBInhfiSnyFLA_5yRHlB4j';
  const CONTACT_SOURCE='BASE DE DATOS';
  const byId=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const clean=value=>String(value??'').trim();
  const digits=value=>String(value??'').replace(/\D/g,'');
  const client=window.supabase?.createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}})||null;

  const state={
    user:null,perms:null,contacts:[],board:{stages:[],opportunities:[],fields:[]},tasks:[],
    loading:false,lastRefresh:0,profileTab:'summary',taskFilter:'all',scanFile:null,scanUrl:'',ocrDebugText:'',
    draft:null,createdContactId:null,createdOpportunityId:null,creationError:null,creating:false,
    whatsapp:{chats:[],messages:[],selectedId:'',query:'',filter:'all',limit:60,loaded:false,loadingChats:false,loadingHistory:false,historyLoadingId:'',historyRequestId:0,sending:false,sendingChatId:'',readAt:{},listScroll:0,lastSync:0,providerState:'',error:'',historyError:''}
  };
  let mobileWaRefreshTimer=null;

  const field=(data,...names)=>{
    for(const name of names){const value=data?.[name];if(value!==undefined&&value!==null&&clean(value)!=='')return value;}
    return '';
  };
  function splitFullName(value){
    const parts=clean(value).replace(/\s+/g,' ').split(' ').filter(Boolean);
    return {first:parts.shift()||'',last:parts.join(' ')};
  }
  function mapContact(row){
    const data=row?.data||{};
    let first=clean(field(data,'NOMBRE'));
    let last=clean(field(data,'APELLIDOS','APELLIDO'));
    const legacy=clean(field(data,'NOMBRE Y APELLIDOS','CLIENTE','CLIENTE FINAL'));
    if(!first&&!last&&legacy){const split=splitFullName(legacy);first=split.first;last=split.last;}
    return {
      id:String(row?.id||''),source:row?.source_sheet||CONTACT_SOURCE,data,
      first,last,fullName:[first,last].filter(Boolean).join(' ')||legacy||'Contacto',
      phone:clean(field(data,'TELÉFONO','TELEFONO','PHONE','MOVIL')),
      dni:clean(field(data,'DNI / NIF','DNI','NIF')),
      email:clean(field(data,'EMAIL','Email','email')),
      bank:clean(field(data,'BANCO','Banco','bank')),
      notes:clean(field(data,'NOTAS','NOTES')),
      observations:clean(field(data,'OBSERVACIONES','OBSERVACION','Observaciones')),
      createdAt:row?.created_at||'',updatedAt:row?.updated_at||''
    };
  }
  const initials=contact=>{
    const parts=clean(contact?.fullName).split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0]||'C')+(parts.length>1?(parts.at(-1)?.[0]||''):'')).toUpperCase();
  };
  const has=permission=>!!(state.perms?.is_admin||state.perms?.[permission]);
  const money=value=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:2}).format(Number(value||0));
  const date=value=>{if(!value)return 'Sin fecha';const d=new Date(value);return Number.isNaN(d.getTime())?'Sin fecha':d.toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit',year:'numeric'});};
  const dateTime=value=>{if(!value)return 'Sin fecha';const d=new Date(value);return Number.isNaN(d.getTime())?'Sin fecha':d.toLocaleString('es-ES',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});};
  const safeDecode=value=>{try{return decodeURIComponent(String(value||''));}catch(_){return String(value||'');}};
  const todayKey=(value=Date.now())=>{const d=new Date(value);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const TASK_FILTERS=['all','pending','today','overdue','completed'];
  const MOBILE_WA_FILTERS=['all','unread','contacts','groups'];
  const MOBILE_WA_PAGE_SIZE=60;
  const taskStatus=task=>String(task?.status||'pending').toLowerCase();
  const taskIsPending=task=>taskStatus(task)==='pending';
  const taskIsCompleted=task=>taskStatus(task)==='completed';
  const taskDateKey=task=>{const value=new Date(task?.starts_at||'');return Number.isNaN(value.getTime())?'':todayKey(value);};
  const taskIsOverdue=(task,now=Date.now())=>{const value=new Date(task?.starts_at||'').getTime();return taskIsPending(task)&&Number.isFinite(value)&&value<Number(now);};
  function taskMatchesFilter(task,filter='all',now=Date.now()){
    if(filter==='pending')return taskIsPending(task);
    if(filter==='today')return taskIsPending(task)&&taskDateKey(task)===todayKey(now);
    if(filter==='overdue')return taskIsOverdue(task,now);
    if(filter==='completed')return taskIsCompleted(task);
    return true;
  }
  const filterTasks=(tasks,filter='all',now=Date.now())=>(tasks||[]).filter(task=>taskMatchesFilter(task,TASK_FILTERS.includes(filter)?filter:'all',now));
  function taskFilterCounts(tasks,now=Date.now()){
    const rows=tasks||[];
    return {all:rows.length,pending:filterTasks(rows,'pending',now).length,today:filterTasks(rows,'today',now).length,overdue:filterTasks(rows,'overdue',now).length,completed:filterTasks(rows,'completed',now).length};
  }

  function toast(message,type=''){
    const node=byId('mobileToast');node.textContent=message;node.className=`m-toast ${type}`.trim();
    clearTimeout(toast.timer);toast.timer=setTimeout(()=>node.classList.add('hidden'),3600);
  }
  function setLoginMessage(message){byId('mobileLoginMsg').textContent=message||'';}
  function showLogin(message=''){
    byId('mobileBoot').classList.add('hidden');byId('mobileApp').classList.add('hidden');byId('mobileLogin').classList.remove('hidden');setLoginMessage(message);
  }
  function showApp(){byId('mobileBoot').classList.add('hidden');byId('mobileLogin').classList.add('hidden');byId('mobileApp').classList.remove('hidden');}
  function route(){
    const raw=location.hash.replace(/^#\/?/,'')||'home';
    const [path,query='']=raw.split('?');return {path,parts:path.split('/').filter(Boolean),query:new URLSearchParams(query)};
  }
  function go(path,replace=false){
    const target='#/'+String(path||'home').replace(/^\//,'');
    if(location.hash===target){render();return;}
    if(replace)location.replace(target);else location.hash=target;
  }
  function goBack(fallback='home'){
    if(history.length>1)history.back();else go(fallback,true);
  }
  function pageHead(title,back='home',action=''){
    return `<div class="m-page-head"><button class="m-back" data-action="back" data-fallback="${esc(back)}" type="button" aria-label="Volver">‹</button><h1>${esc(title)}</h1>${action||'<span class="m-head-spacer"></span>'}</div>`;
  }
  function skeleton(){return '<div class="m-skeleton"></div><div class="m-skeleton"></div><div class="m-skeleton"></div>';}
  function empty(title,text){return `<div class="m-empty"><strong>${esc(title)}</strong>${esc(text)}</div>`;}

  async function boot(){
    if(!client){showLogin('No se ha podido cargar la conexión. Recarga la página.');return;}
    bindStaticEvents();
    try{
      const {data,error}=await client.auth.getSession();if(error)throw error;
      if(data?.session?.user)await enter(data.session.user);else showLogin();
    }catch(error){showLogin(error?.message||'No se pudo recuperar la sesión.');}
  }
  async function enter(user){
    state.user=user;
    try{
      await client.rpc('bootstrap_user_permissions');
      const {data,error}=await client.rpc('current_user_permissions');if(error)throw error;
      state.perms=data||{};showApp();
      await refreshData({silent:true});
      if(!location.hash)go('home',true);else render();
    }catch(error){
      await client.auth.signOut().catch(()=>{});state.user=null;showLogin(error?.message||'No se pudieron cargar tus permisos.');
    }
  }
  async function signIn(event){
    event?.preventDefault();const button=byId('mobileSignIn');const email=clean(byId('mobileEmail').value);const password=byId('mobilePassword').value;
    if(!email||!password){setLoginMessage('Escribe correo y contraseña.');return;}
    button.disabled=true;button.textContent='Entrando…';setLoginMessage('Conectando…');
    try{
      const {data,error}=await client.auth.signInWithPassword({email,password});if(error)throw error;
      if(!data?.user)throw new Error('No se pudo iniciar sesión.');
      await enter(data.user);
    }catch(error){setLoginMessage(error?.message||'No se pudo iniciar sesión.');}
    finally{button.disabled=false;button.textContent='Entrar';}
  }
  async function signOut(){
    stopMobileWaRefresh();
    await client.auth.signOut();state.user=null;state.perms=null;state.contacts=[];state.tasks=[];state.board={stages:[],opportunities:[],fields:[]};state.ocrDebugText='';state.whatsapp={chats:[],messages:[],selectedId:'',query:'',filter:'all',limit:60,loaded:false,loadingChats:false,loadingHistory:false,historyLoadingId:'',historyRequestId:0,sending:false,sendingChatId:'',readAt:{},listScroll:0,lastSync:0,providerState:'',error:'',historyError:''};location.hash='';showLogin();
  }

  async function refreshData({silent=false}={}){
    if(!state.user||state.loading)return;
    state.loading=true;if(!silent)renderLoading();
    try{
      const jobs=[];
      jobs.push(has('can_view_database')
        ?client.from('records').select('id,source_sheet,source_row,data,created_at,updated_at').eq('source_sheet',CONTACT_SOURCE).order('updated_at',{ascending:false}).limit(2000)
        :Promise.resolve({data:[],error:null}));
      jobs.push((has('can_view_sales')||has('can_edit_sales'))?client.rpc('sales_board'):Promise.resolve({data:{stages:[],opportunities:[],fields:[]},error:null}));
      jobs.push((has('can_view_agenda')||has('can_manage_agenda'))
        ?client.from('agenda_items').select('id,title,description,customer_name,customer_phone,starts_at,reminder_at,assigned_to,related_record_id,status,whatsapp_enabled,created_at').or('whatsapp_enabled.is.null,whatsapp_enabled.eq.false').order('starts_at',{ascending:true}).limit(1000)
        :Promise.resolve({data:[],error:null}));
      const [contacts,board,tasks]=await Promise.all(jobs);
      if(contacts.error)throw contacts.error;if(board.error)throw board.error;if(tasks.error)throw tasks.error;
      state.contacts=(contacts.data||[]).map(mapContact);
      state.board={stages:board.data?.stages||[],opportunities:board.data?.opportunities||[],fields:board.data?.fields||[]};
      state.tasks=tasks.data||[];state.lastRefresh=Date.now();updateAlertDot();
    }catch(error){toast(error?.message||'No se pudieron actualizar los datos.','error');}
    finally{state.loading=false;if(!silent)render();}
  }
  function renderLoading(){const view=byId('mobileView');if(view)view.innerHTML=`<div class="m-page">${skeleton()}</div>`;}
  function pendingTasks(){return state.tasks.filter(task=>String(task.status||'pending')==='pending');}
  function noticeStats(){
    const now=Date.now(),today=todayKey(),pending=pendingTasks();
    const expiredTasks=pending.filter(task=>new Date(task.starts_at).getTime()<now);
    const todayTasks=pending.filter(task=>String(task.starts_at||'').slice(0,10)===today);
    const open=state.board.opportunities.filter(opp=>String(opp.status||'open')==='open');
    const expiredOpp=open.filter(opp=>opp.expected_date&&opp.expected_date<today);
    const todayOpp=open.filter(opp=>opp.expected_date===today);
    return {all:expiredTasks.length+todayTasks.length+expiredOpp.length+todayOpp.length,expired:expiredTasks.length+expiredOpp.length,today:todayTasks.length+todayOpp.length,pending:pending.length,soon:open.filter(opp=>opp.expected_date&&opp.expected_date>today).length};
  }
  function updateAlertDot(){byId('mobileAlertDot')?.classList.toggle('hidden',noticeStats().all===0);}

  function render(){
    if(!state.user||byId('mobileApp').classList.contains('hidden'))return;
    const current=route();setActiveNav(current.parts[0]);
    const view=byId('mobileView');
    try{
      switch(current.parts[0]){
        case 'home':view.innerHTML=renderHome();break;
        case 'contacts':view.innerHTML=renderContacts();bindSearch();break;
        case 'contact':view.innerHTML=renderContact(current.parts[1]);break;
        case 'edit-contact':view.innerHTML=renderEditContact(current.parts[1]);break;
        case 'opportunities':view.innerHTML=renderOpportunities();break;
        case 'opportunity':view.innerHTML=renderOpportunity(current.parts[1]);break;
        case 'tasks':view.innerHTML=renderTasks();break;
        case 'new-task':view.innerHTML=renderNewTask(current.parts[1]);break;
        case 'whatsapp':view.innerHTML=renderMobileWhatsApp();initMobileWhatsAppList();break;
        case 'whatsapp-chat':view.innerHTML=renderMobileWhatsAppChat(safeDecode(current.parts[1]));initMobileWhatsAppChat(safeDecode(current.parts[1]));break;
        case 'alerts':view.innerHTML=renderAlerts();break;
        case 'scan':view.innerHTML=renderScan();break;
        case 'detected':ensureDraft();view.innerHTML=renderDetected();break;
        case 'new-opportunity':ensureDraft();view.innerHTML=renderOpportunityForm();break;
        case 'review':ensureDraft();view.innerHTML=renderReview();break;
        case 'creating':view.innerHTML=renderCreating();break;
        case 'success':view.innerHTML=renderSuccess();break;
        case 'more':view.innerHTML=renderMore();break;
        default:view.innerHTML=renderHome();
      }
      if(!['whatsapp','whatsapp-chat'].includes(current.parts[0]))stopMobileWaRefresh();
      view.scrollTop=current.parts[0]==='whatsapp'?Number(state.whatsapp.listScroll||0):0;
    }catch(error){view.innerHTML=`<div class="m-page">${pageHead('CRM móvil')} ${empty('No se pudo abrir esta pantalla',error?.message||'Vuelve a intentarlo.')}</div>`;}
  }
  function setActiveNav(name){
    const group=name==='contact'||name==='edit-contact'?'contacts':name==='opportunity'?'opportunities':['scan','detected','new-opportunity','review','creating','success'].includes(name)?'add':['whatsapp','whatsapp-chat'].includes(name)?'':name;
    document.querySelectorAll('[data-mobile-route]').forEach(button=>button.classList.toggle('active',button.dataset.mobileRoute===group));
    byId('mobileAdd').classList.toggle('active',group==='add');
  }

  function renderHome(){
    const stats=noticeStats();const name=clean(state.perms?.display_name||state.user?.email?.split('@')[0]||'Ramón').split(' ')[0];
    return `<div class="m-page">
      <h1 class="m-greeting">Hola, ${esc(name)}</h1><p class="m-subtitle">Bienvenido de nuevo</p>
      <button class="m-notice-card" data-action="route" data-route="alerts" type="button" style="width:100%;color:inherit;text-align:left">
        <div class="m-notice-head"><strong>♧ Centro de avisos</strong><span>›</span></div>
        <div class="m-notice-grid"><div><b>${stats.all}</b><small>Todos</small></div><div><b>${stats.expired}</b><small>Vencidos</small></div><div><b>${stats.today}</b><small>Hoy</small></div><div class="wide"><span><b>${stats.pending}</b><small>Sin completar</small></span><span><b>${stats.soon}</b><small>Próximos</small></span></div></div>
      </button>
      <h2 class="m-section-title">Accesos rápidos</h2>
      <div class="m-quick-grid">
        <button class="m-quick" data-action="route" data-route="contacts"><span>♙</span><small>Contactos</small></button>
        <button class="m-quick" data-action="route" data-route="opportunities"><span>◇</span><small>Oportunidades</small></button>
        <button class="m-quick" data-action="route" data-route="tasks"><span>▣</span><small>Tareas</small></button>
        <button class="m-quick" data-action="open-desktop"><span>◷</span><small>Agenda</small></button>
        <button class="m-quick" data-action="route" data-route="whatsapp"><span>◉</span><small>WhatsApp</small></button>
        <button class="m-quick" data-action="open-desktop"><span>▤</span><small>Plantillas</small></button>
      </div>
      <h2 class="m-section-title">Acciones rápidas</h2>
      <div class="m-action-stack">
        <button class="m-primary m-action-large" data-action="start-scan"><span>▧</span> Escanear contacto</button>
        <button class="m-secondary m-action-large" data-action="manual-contact"><span>＋</span> Nuevo contacto</button>
      </div>
    </div>`;
  }

  function contactCard(contact){
    return `<button class="m-list-card" data-action="route" data-route="contact/${esc(contact.id)}"><span class="m-list-row"><span class="m-avatar">${esc(initials(contact))}</span><span class="m-list-main"><strong>${esc(contact.fullName)}</strong><small>${esc(contact.phone||contact.dni||contact.email||'Sin datos de contacto')}</small></span><span class="m-chevron">›</span></span></button>`;
  }
  function renderContacts(){
    if(!has('can_view_database'))return `<div class="m-page">${pageHead('Contactos')}${empty('Acceso restringido','No tienes permiso para ver contactos.')}</div>`;
    return `<div class="m-page">${pageHead('Contactos','home','<button class="m-back" data-action="manual-contact" aria-label="Nuevo contacto">＋</button>')}
      <div class="m-search"><input id="mobileContactSearch" class="m-input" placeholder="Nombre, DNI o teléfono" autocomplete="off"></div>
      <div id="mobileContactsList" class="m-list">${state.contacts.length?state.contacts.slice(0,200).map(contactCard).join(''):empty('No hay contactos','Crea el primero desde el botón +.')}</div>
    </div>`;
  }
  function bindSearch(){
    const input=byId('mobileContactSearch');if(!input)return;
    input.oninput=()=>{
      const value=clean(input.value).toLowerCase(),valueDigits=digits(value);
      const rows=state.contacts.filter(contact=>{
        const hay=`${contact.fullName} ${contact.dni} ${contact.phone} ${contact.email}`.toLowerCase();
        return !value||hay.includes(value)||(valueDigits.length>=3&&digits(hay).includes(valueDigits));
      }).slice(0,200);
      byId('mobileContactsList').innerHTML=rows.length?rows.map(contactCard).join(''):empty('Sin resultados','Prueba con otro nombre, DNI o teléfono.');
    };
  }

  function relatedOpportunities(id){return state.board.opportunities.filter(opp=>String(opp.record_id||opp.contact_id||'')===String(id));}
  function relatedTasks(id){return state.tasks.filter(task=>String(task.related_record_id||'')===String(id));}
  function renderContact(id){
    const contact=state.contacts.find(row=>String(row.id)===String(id));
    if(!contact)return `<div class="m-page">${pageHead('Ficha del contacto','contacts')}${empty('Contacto no encontrado','Actualiza los datos e inténtalo de nuevo.')}</div>`;
    const opps=relatedOpportunities(id),tasks=relatedTasks(id);const tab=state.profileTab;
    let body='';
    if(tab==='summary')body=`<div class="m-info-card">
      ${infoRow('DNI / NIF',contact.dni)}${infoRow('Teléfono',contact.phone)}${infoRow('Correo electrónico',contact.email)}${infoRow('Banco / IBAN',contact.bank)}${infoRow('Observaciones',contact.observations)}${infoRow('Notas',contact.notes)}
    </div>`;
    if(tab==='opportunities')body=opps.length?`<div class="m-list">${opps.map(opportunityCard).join('')}</div>`:empty('Sin oportunidades','Este contacto todavía no tiene oportunidades.');
    if(tab==='tasks')body=`${has('can_manage_agenda')?'<button class="m-primary" style="width:100%;margin-bottom:12px" data-action="route" data-route="new-task/'+esc(id)+'">＋ Nueva tarea</button>':''}${tasks.length?`<div class="m-list">${tasks.map(taskCard).join('')}</div>`:empty('Sin tareas','Este contacto todavía no tiene tareas.')}`;
    if(tab==='more')body=`<div class="m-info-card">${infoRow('Origen',contact.source)}${infoRow('Última actualización',dateTime(contact.updatedAt))}</div><div class="m-inline-actions"><button class="m-secondary full" data-action="open-desktop">Abrir en el CRM completo</button></div>`;
    return `<div class="m-page">${pageHead('Ficha del contacto','contacts',has('can_edit_records')?`<button class="m-back" data-action="route" data-route="edit-contact/${esc(id)}" aria-label="Editar">✎</button>`:'')}
      <div class="m-profile-hero"><div class="m-avatar">${esc(initials(contact))}</div><h1>${esc(contact.fullName)}</h1><p>${esc(contact.dni||'Sin DNI')}</p><p>${esc(contact.phone||'Sin teléfono')}</p></div>
      <div class="m-tabs"><button class="${tab==='summary'?'active':''}" data-action="profile-tab" data-tab="summary">Resumen</button><button class="${tab==='opportunities'?'active':''}" data-action="profile-tab" data-tab="opportunities">Oportunidades (${opps.length})</button><button class="${tab==='tasks'?'active':''}" data-action="profile-tab" data-tab="tasks">Tareas (${tasks.length})</button><button class="${tab==='more'?'active':''}" data-action="profile-tab" data-tab="more">Más</button></div>${body}
    </div>`;
  }
  function infoRow(label,value){return `<div class="m-info-row"><span>${esc(label)}</span><b>${esc(value||'—')}</b></div>`;}

  function contactFields(contact={},prefix='edit'){
    return `<div class="m-form-grid two">
      <label class="m-field"><span>Nombre</span><input id="${prefix}First" class="m-input" value="${esc(contact.first||'')}" autocomplete="given-name"></label>
      <label class="m-field"><span>Apellidos</span><input id="${prefix}Last" class="m-input" value="${esc(contact.last||'')}" autocomplete="family-name"></label>
      <label class="m-field"><span>DNI / NIF</span><input id="${prefix}Dni" class="m-input" value="${esc(contact.dni||'')}" autocapitalize="characters"></label>
      <label class="m-field"><span>Teléfono</span><input id="${prefix}Phone" class="m-input" value="${esc(contact.phone||'')}" inputmode="tel"></label>
      <label class="m-field"><span>Correo electrónico</span><input id="${prefix}Email" class="m-input" value="${esc(contact.email||'')}" inputmode="email"></label>
      <label class="m-field"><span>Banco / IBAN</span><input id="${prefix}Bank" class="m-input" value="${esc(contact.bank||'')}"></label>
      <label class="m-field"><span>Observaciones</span><textarea id="${prefix}Observations" class="m-textarea">${esc(contact.observations||'')}</textarea></label>
      <label class="m-field"><span>Notas</span><textarea id="${prefix}Notes" class="m-textarea">${esc(contact.notes||'')}</textarea></label>
    </div>`;
  }
  function readContactFields(prefix){
    const value=id=>clean(byId(`${prefix}${id}`)?.value);
    return {first:value('First'),last:value('Last'),dni:value('Dni').toUpperCase(),phone:value('Phone'),email:value('Email'),bank:value('Bank'),observations:value('Observations'),notes:value('Notes')};
  }
  function renderEditContact(id){
    const contact=state.contacts.find(row=>String(row.id)===String(id));
    if(!contact||!has('can_edit_records'))return `<div class="m-page">${pageHead('Editar contacto',`contact/${id}`)}${empty('No disponible','No tienes permiso o el contacto ya no existe.')}</div>`;
    return `<div class="m-page">${pageHead('Editar contacto',`contact/${id}`)}${contactFields(contact,'edit')}<button class="m-primary" style="width:100%;margin-top:18px" data-action="save-contact" data-id="${esc(id)}">Guardar cambios</button><p id="mobileEditMsg" class="m-form-msg"></p></div>`;
  }
  async function saveContact(id){
    const contact=state.contacts.find(row=>String(row.id)===String(id));if(!contact||!has('can_edit_records'))return;
    const values=readContactFields('edit');if(!values.first&&!values.last){byId('mobileEditMsg').textContent='Escribe el nombre o los apellidos.';return;}
    const fullName=[values.first,values.last].filter(Boolean).join(' ');const data={...contact.data,'NOMBRE':values.first,'APELLIDOS':values.last,'NOMBRE Y APELLIDOS':fullName,'TELÉFONO':values.phone,'DNI / NIF':values.dni,'DNI':values.dni,'EMAIL':values.email,'BANCO':values.bank,'OBSERVACIONES':values.observations,'NOTAS':values.notes};
    const button=document.querySelector('[data-action="save-contact"]');button.disabled=true;byId('mobileEditMsg').textContent='Guardando…';
    try{
      const {error}=await client.from('records').update({data}).eq('id',id).eq('source_sheet',CONTACT_SOURCE).select('id').single();if(error)throw error;
      await refreshData({silent:true});toast('Contacto actualizado en todo el CRM.','success');go(`contact/${id}`);
    }catch(error){byId('mobileEditMsg').textContent=error?.message||'No se pudo guardar.';}
    finally{button.disabled=false;}
  }

  function opportunityCard(opp){
    const stage=state.board.stages.find(row=>String(row.id)===String(opp.stage_id));
    return `<button class="m-list-card" data-action="route" data-route="opportunity/${esc(opp.id)}"><span class="m-list-row"><span class="m-avatar">◇</span><span class="m-list-main"><strong>${esc(opp.title||'Oportunidad')}</strong><small>${esc(opp.client_name||'Sin contacto')} · ${esc(stage?.name||'Sin columna')}</small></span><span class="m-chevron">›</span></span></button>`;
  }
  function renderOpportunities(){
    if(!has('can_view_sales')&&!has('can_edit_sales'))return `<div class="m-page">${pageHead('Oportunidades')}${empty('Acceso restringido','No tienes permiso para ver ventas.')}</div>`;
    const rows=[...state.board.opportunities].sort((a,b)=>String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||'')));
    return `<div class="m-page">${pageHead('Oportunidades','home')}${rows.length?`<div class="m-list">${rows.map(opportunityCard).join('')}</div>`:empty('Sin oportunidades','Todavía no hay oportunidades creadas.')}</div>`;
  }
  function renderOpportunity(id){
    const opp=state.board.opportunities.find(row=>String(row.id)===String(id));if(!opp)return `<div class="m-page">${pageHead('Oportunidad','opportunities')}${empty('No encontrada','Actualiza e inténtalo de nuevo.')}</div>`;
    const stage=state.board.stages.find(row=>String(row.id)===String(opp.stage_id));
    return `<div class="m-page">${pageHead('Oportunidad','opportunities')}<div class="m-profile-hero"><div class="m-avatar">◇</div><h1>${esc(opp.title||'Oportunidad')}</h1><p>${esc(opp.client_name||'Sin contacto')}</p></div><div class="m-info-card">${infoRow('Columna / Estado',stage?.name||'—')}${infoRow('Importe',opp.amount!=null?money(opp.amount):'—')}${infoRow('Cierre previsto',date(opp.expected_date))}${infoRow('Teléfono',opp.phone)}${infoRow('Notas',opp.notes)}</div>${opp.record_id?`<button class="m-secondary" style="width:100%;margin-top:12px" data-action="route" data-route="contact/${esc(opp.record_id)}">Ver contacto</button>`:''}</div>`;
  }

  function taskCard(task){
    const overdue=String(task.status)==='pending'&&task.starts_at&&new Date(task.starts_at).getTime()<Date.now();
    return `<article class="m-list-card m-task-card"><div class="m-list-row"><span class="m-avatar">▣</span><span class="m-list-main"><strong>${esc(task.title||'Tarea')}</strong><small>${esc(task.customer_name||'Sin contacto')} · ${esc(dateTime(task.starts_at))}</small></span><span class="m-badge ${String(task.status)==='completed'?'':overdue?'red':'amber'}">${String(task.status)==='completed'?'Completada':overdue?'Vencida':'Pendiente'}</span></div>${task.description?`<p class="m-muted" style="font-size:.75rem;margin:10px 0 0">${esc(task.description)}</p>`:''}${String(task.status)==='pending'&&has('can_manage_agenda')?`<div class="m-task-actions"><button class="m-secondary" data-action="complete-task" data-id="${esc(task.id)}">Marcar completada</button>${task.related_record_id?`<button class="m-secondary" data-action="route" data-route="contact/${esc(task.related_record_id)}">Ver contacto</button>`:''}</div>`:''}</article>`;
  }
  function renderTaskFilters(counts,active=state.taskFilter){
    const options=[['all','Todas'],['pending','Pendientes'],['today','Hoy'],['overdue','Vencidas'],['completed','Completadas']];
    return `<div class="m-task-filters" role="group" aria-label="Filtrar tareas">${options.map(([key,label])=>`<button class="m-task-filter ${active===key?'active':''}" data-action="task-filter" data-filter="${key}" type="button" aria-pressed="${active===key}"><span>${label}</span><b>${counts[key]||0}</b></button>`).join('')}</div>`;
  }
  function renderTasks(){
    if(!has('can_view_agenda')&&!has('can_manage_agenda'))return `<div class="m-page">${pageHead('Tareas')}${empty('Acceso restringido','No tienes permiso para ver tareas.')}</div>`;
    const allRows=[...state.tasks].sort((a,b)=>String(a.starts_at||'').localeCompare(String(b.starts_at||'')));
    const active=TASK_FILTERS.includes(state.taskFilter)?state.taskFilter:'all';
    const now=Date.now(),rows=filterTasks(allRows,active,now),filters=renderTaskFilters(taskFilterCounts(allRows,now),active);
    const content=rows.length?`<div class="m-list">${rows.map(taskCard).join('')}</div>`:empty(allRows.length?'Sin tareas en este filtro':'Sin tareas',allRows.length?'Prueba con otro filtro.':'No hay tareas pendientes ni completadas.');
    return `<div class="m-page">${pageHead('Tareas','home')}${filters}${content}</div>`;
  }
  async function completeTask(id){
    if(!has('can_manage_agenda')||!confirm('¿Marcar esta tarea como completada?'))return;
    try{const {error}=await client.from('agenda_items').update({status:'completed'}).eq('id',id).select('id').single();if(error)throw error;await refreshData({silent:true});render();toast('Tarea completada.','success');}catch(error){toast(error?.message||'No se pudo completar.','error');}
  }
  function renderNewTask(contactId){
    const contact=state.contacts.find(row=>String(row.id)===String(contactId));if(!contact||!has('can_manage_agenda'))return `<div class="m-page">${pageHead('Nueva tarea',`contact/${contactId}`)}${empty('No disponible','No tienes permiso o el contacto no existe.')}</div>`;
    const next=new Date(Date.now()+86400000);next.setMinutes(next.getMinutes()-next.getTimezoneOffset());
    return `<div class="m-page">${pageHead('Nueva tarea',`contact/${contactId}`)}<p class="m-subtitle" style="margin-bottom:16px">Tarea para ${esc(contact.fullName)}</p><div class="m-form-grid"><label class="m-field"><span>Asunto</span><input id="newTaskTitle" class="m-input" placeholder="Llamar al cliente"></label><label class="m-field"><span>Fecha y hora</span><input id="newTaskStarts" class="m-input" type="datetime-local" value="${next.toISOString().slice(0,16)}"></label><label class="m-field"><span>Notas</span><textarea id="newTaskNotes" class="m-textarea"></textarea></label></div><button class="m-primary" style="width:100%;margin-top:18px" data-action="save-task" data-contact-id="${esc(contactId)}">Crear tarea</button><p id="mobileTaskMsg" class="m-form-msg"></p></div>`;
  }
  async function saveTask(contactId){
    const contact=state.contacts.find(row=>String(row.id)===String(contactId));const title=clean(byId('newTaskTitle').value),starts=byId('newTaskStarts').value;
    if(!contact||!title||!starts){byId('mobileTaskMsg').textContent='Escribe un asunto y una fecha.';return;}
    const button=document.querySelector('[data-action="save-task"]');button.disabled=true;byId('mobileTaskMsg').textContent='Guardando…';
    try{
      const row={title,description:clean(byId('newTaskNotes').value)||null,customer_name:contact.fullName||null,customer_phone:contact.phone||null,starts_at:new Date(starts).toISOString(),reminder_at:null,assigned_to:state.user.id,related_record_id:contact.id,status:'pending',reminder_minutes:[],notify_in_app:true,notify_email:false,sync_google_calendar:false,whatsapp_enabled:false};
      const {error}=await client.from('agenda_items').insert(row).select('id').single();if(error)throw error;await refreshData({silent:true});state.profileTab='tasks';go(`contact/${contact.id}`);toast('Tarea creada y sincronizada.','success');
    }catch(error){byId('mobileTaskMsg').textContent=error?.message||'No se pudo crear la tarea.';}
    finally{button.disabled=false;}
  }

  function renderAlerts(){
    const now=Date.now(),today=todayKey();
    const taskRows=pendingTasks().filter(task=>new Date(task.starts_at).getTime()<now||String(task.starts_at||'').slice(0,10)===today);
    const oppRows=state.board.opportunities.filter(opp=>String(opp.status||'open')==='open'&&opp.expected_date&&opp.expected_date<=today);
    const cards=[...taskRows.map(taskCard),...oppRows.map(opportunityCard)];
    return `<div class="m-page">${pageHead('Centro de avisos','home')}${cards.length?`<div class="m-list">${cards.join('')}</div>`:empty('Todo al día','No hay avisos vencidos ni para hoy.')}</div>`;
  }

  function ensureDraft(){
    if(state.draft)return;
    const firstStage=state.board.stages[0];
    state.draft={contact:{first:'',last:'',dni:'',phone:'',email:'',bank:'',observations:'',notes:''},opportunity:{title:'',stageId:firstStage?.id||'',expectedDate:'',amount:'',notes:'',reminder:true},includeOpportunity:true,duplicates:[]};
  }
  function resetDraft(){
    if(state.scanUrl)URL.revokeObjectURL(state.scanUrl);
    state.scanFile=null;state.scanUrl='';state.ocrDebugText='';state.draft=null;state.createdContactId=null;state.createdOpportunityId=null;state.creationError=null;state.creating=false;ensureDraft();
  }
  function renderScan(){
    return `<div class="m-page">${pageHead('Escanear contacto','home')}<div class="m-camera-stage">${state.scanUrl?`<img src="${esc(state.scanUrl)}" alt="Documento seleccionado">`:'<div class="m-camera-placeholder"><span>▧</span><strong>Fotografía el documento o la pantalla</strong><p>La imagen se procesa en el teléfono y no se guarda en el CRM.</p></div>'}</div><div class="m-camera-actions"><button class="m-primary" data-action="camera">Cámara</button><button class="m-secondary" data-action="gallery">Fototeca</button></div>${state.scanFile?'<button class="m-primary" style="width:100%;margin-top:12px" data-action="analyse-scan">Detectar datos</button>':'<button class="m-ghost" style="width:100%;margin-top:8px" data-action="manual-contact">Escribir datos manualmente</button>'}<div id="mobileOcrProgress"></div></div>`;
  }
  async function handleImage(file){
    if(!file)return;if(state.scanUrl)URL.revokeObjectURL(state.scanUrl);state.ocrDebugText='';state.scanFile=file;state.scanUrl=URL.createObjectURL(file);go('scan');
  }
  async function analyseScan(){
    if(!state.scanFile)return;
    const progress=byId('mobileOcrProgress');const button=document.querySelector('[data-action="analyse-scan"]');button.disabled=true;
    progress.innerHTML='<div class="m-ocr-progress"><span>Preparando el lector…</span><div class="m-progress-track"><span></span></div></div>';
    const label=progress.querySelector('.m-ocr-progress>span'),bar=progress.querySelector('.m-progress-track span');
    try{
      if(!window.TPFMobileOCR)throw new Error('El lector no está disponible.');
      const labels={
        'preparing image':'Preparando la foto…','image prepared':'Foto preparada…','loading reader':'Cargando el lector…',
        'loading tesseract core':'Iniciando el lector…','loading language traineddata':'Cargando el idioma…',
        'initializing api':'Preparando el reconocimiento…','recognizing text':'Leyendo DNI, teléfono y nombre…',
        'preparing contact fields':'Preparando DNI y teléfono…','contact fields prepared':'Zona del formulario preparada…',
        'recognizing contact fields':'Leyendo DNI y teléfono…','retrying full image':'Haciendo una segunda lectura completa…',
        'recognizing fallback':'Completando los datos del contacto…',
        'recognition complete':'Lectura completada.'
      };
      const result=await window.TPFMobileOCR.recognize(state.scanFile,event=>{label.textContent=labels[event.status]||'Preparando el documento…';bar.style.width=`${Math.max(5,Math.round(event.progress*100))}%`;});
      state.ocrDebugText=String(result.rawText||'').trim().slice(0,6000);
      ensureDraft();state.draft.contact={...state.draft.contact,first:result.first||'',last:result.last||'',dni:result.dni||'',phone:result.phone||''};
      state.draft.opportunity={...state.draft.opportunity,title:result.opportunitySuggestion?.title||''};
      go('detected');
      if(!result.first&&!result.dni&&!result.phone)toast('No se pudieron reconocer los datos. Puedes escribirlos manualmente.','error');
    }catch(error){progress.innerHTML=`<div class="m-duplicate warn">${esc(error?.message||'No se pudo leer la imagen.')} Puedes continuar escribiendo los datos.</div><button class="m-secondary" style="width:100%" data-action="manual-contact">Continuar manualmente</button>`;}
    finally{button.disabled=false;}
  }
  function renderDetected(){
    const contact=state.draft.contact;const duplicate=state.draft.duplicates||[];
    const duplicateHtml=duplicate.length?`<div class="m-duplicate warn">Se han encontrado ${duplicate.length} posibles duplicados. Revisa el DNI o el teléfono antes de continuar.</div>`:'<div class="m-duplicate">✓ No se ha encontrado ningún contacto duplicado.</div>';
    const ocrDetails=state.ocrDebugText?`<details class="m-info-card" style="margin-top:12px"><summary style="cursor:pointer;font-weight:700">Ver qué ha leído el documento</summary><p class="m-muted" style="font-size:.72rem">Solo se muestra en este móvil; no se guarda ni se envía.</p><pre style="white-space:pre-wrap;max-height:240px;overflow:auto;font-size:.72rem">${esc(state.ocrDebugText)}</pre></details>`:'';
    return `<div class="m-page">${pageHead('Datos detectados','scan')}<p class="m-muted">Comprueba la información antes de continuar. Todos los campos se pueden corregir.</p>${duplicateHtml}${contactFields(contact,'draft')}${ocrDetails}<button class="m-primary" style="width:100%;margin-top:18px" data-action="continue-detected">Continuar</button><button class="m-ghost" style="width:100%;margin-top:5px" data-action="check-duplicates">Comprobar duplicados</button><p id="mobileDetectedMsg" class="m-form-msg"></p></div>`;
  }
  async function captureDraftContact(){state.draft.contact=readContactFields('draft');return state.draft.contact;}
  async function checkDuplicates(){
    const contact=await captureDraftContact();
    try{const {data,error}=await client.rpc('find_possible_duplicate_contact',{phone_text:contact.phone||null,dni_text:contact.dni||null,email_text:contact.email||null});if(error)throw error;state.draft.duplicates=data||[];render();return state.draft.duplicates;}catch(error){byId('mobileDetectedMsg').textContent=error?.message||'No se pudo comprobar.';return [];}
  }
  async function continueDetected(){
    const contact=await captureDraftContact();if(!contact.first&&!contact.last){byId('mobileDetectedMsg').textContent='Escribe el nombre o los apellidos.';return;}
    if(!has('can_create_database')||!has('can_view_database')){byId('mobileDetectedMsg').textContent='No tienes permiso para crear y consultar contactos.';return;}
    await checkDuplicates();
    if(!has('can_edit_sales')||!has('can_view_sales')){state.draft.includeOpportunity=false;go('review');return;}
    state.draft.includeOpportunity=true;go('new-opportunity');
  }
  function renderOpportunityForm(){
    const contact=state.draft.contact,opp=state.draft.opportunity;if(!opp.title)opp.title=`Oportunidad - ${[contact.first,contact.last].filter(Boolean).join(' ')}`;
    return `<div class="m-page">${pageHead('Nueva oportunidad','detected')}<p class="m-muted">El contacto se creará y quedará vinculado a esta oportunidad. El nombre sugerido por el color se puede cambiar.</p><div class="m-form-grid"><label class="m-field"><span>Nombre de oportunidad</span><input id="draftOppTitle" class="m-input" value="${esc(opp.title)}"></label><label class="m-field"><span>Columna / Estado</span><select id="draftOppStage" class="m-select">${state.board.stages.map(stage=>`<option value="${esc(stage.id)}" ${String(stage.id)===String(opp.stageId)?'selected':''}>${esc(stage.name)}</option>`).join('')}</select></label><label class="m-field"><span>Fecha de cierre prevista</span><input id="draftOppDate" class="m-input" type="date" value="${esc(opp.expectedDate)}"></label><label class="m-field"><span>Importe (opcional)</span><input id="draftOppAmount" class="m-input" inputmode="decimal" value="${esc(opp.amount)}" placeholder="0,00"></label><label class="m-field"><span>Notas</span><textarea id="draftOppNotes" class="m-textarea">${esc(opp.notes)}</textarea></label><div class="m-toggle-row"><span><strong>Recordatorio</strong><small style="display:block;color:var(--m-muted);margin-top:3px">2 días antes del cierre</small></span><button id="draftOppReminder" class="m-toggle ${opp.reminder?'on':''}" data-action="toggle-reminder" type="button" aria-pressed="${opp.reminder}"></button></div></div><div class="m-opportunity-actions"><button class="m-primary" data-action="continue-opportunity">Guardar oportunidad</button><button class="m-secondary" data-action="skip-opportunity">No quiero oportunidad</button><p id="mobileOpportunityMsg" class="m-form-msg"></p></div></div>`;
  }
  function captureDraftOpportunity(){
    state.draft.opportunity={...state.draft.opportunity,title:clean(byId('draftOppTitle').value),stageId:byId('draftOppStage').value,expectedDate:byId('draftOppDate').value,amount:clean(byId('draftOppAmount').value),notes:clean(byId('draftOppNotes').value),reminder:byId('draftOppReminder').classList.contains('on')};return state.draft.opportunity;
  }
  function continueOpportunity(){
    if(!has('can_edit_sales')||!has('can_view_sales')){byId('mobileOpportunityMsg').textContent='No tienes permiso para crear oportunidades.';return;}
    const opp=captureDraftOpportunity();if(!opp.title){byId('mobileOpportunityMsg').textContent='Escribe el nombre de la oportunidad.';return;}if(!opp.stageId){byId('mobileOpportunityMsg').textContent='Selecciona una columna.';return;}state.draft.includeOpportunity=true;go('review');
  }
  function skipOpportunity(){captureDraftOpportunity();state.draft.includeOpportunity=false;go('review');}
  function renderReview(){
    const contact=state.draft.contact,opp=state.draft.opportunity,includeOpportunity=state.draft.includeOpportunity!==false,fullName=[contact.first,contact.last].filter(Boolean).join(' '),stage=state.board.stages.find(row=>String(row.id)===String(opp.stageId));
    const opportunityReview=includeOpportunity?`<div class="m-review-section"><h2>Oportunidad</h2><div class="m-review-card"><div class="m-review-lines"><div class="m-review-line"><span>Nombre</span><b>${esc(opp.title)}</b></div><div class="m-review-line"><span>Estado</span><b>${esc(stage?.name||'—')}</b></div><div class="m-review-line"><span>Cierre previsto</span><b>${esc(opp.expectedDate?date(opp.expectedDate):'—')}</b></div><div class="m-review-line"><span>Importe</span><b>${esc(opp.amount?money(Number(opp.amount.replace(',','.'))):'—')}</b></div><div class="m-review-line"><span>Responsable</span><b>${esc(state.perms?.display_name||state.user?.email||'Usuario')}</b></div></div></div></div>`:'<div class="m-duplicate">Se creará únicamente el contacto, sin oportunidad.</div>';
    const back=has('can_edit_sales')&&has('can_view_sales')?'new-opportunity':'detected';
    return `<div class="m-page">${pageHead('Confirmar creación',back)}<div class="m-review-section"><h2>Contacto</h2><div class="m-review-card"><div class="m-review-person"><div class="m-avatar">${esc(initials({fullName}))}</div><div><strong>${esc(fullName)}</strong><div class="m-muted" style="font-size:.75rem;margin-top:4px">DNI / NIF: ${esc(contact.dni||'—')}<br>Teléfono: ${esc(contact.phone||'—')}</div></div></div></div></div>${opportunityReview}<button class="m-primary" style="width:100%" data-action="create-all">${includeOpportunity?'Confirmar y crear':'Crear solo contacto'}</button><button class="m-secondary" style="width:100%;margin-top:10px" data-action="route" data-route="detected">Editar datos</button></div>`;
  }
  function renderCreating(){
    const error=state.creationError,includeOpportunity=state.draft?.includeOpportunity!==false,readyForSync=includeOpportunity?state.createdOpportunityId:state.createdContactId;
    const opportunityStep=includeOpportunity?`<div id="createOpportunityStep" class="m-step ${state.createdOpportunityId?'done':state.createdContactId&&!error?'active':error?'error':''}"><i>${state.createdOpportunityId?'✓':'2'}</i><span>Creando oportunidad</span></div>`:'';
    return `<div class="m-page"><div class="m-create-progress"><div><div class="m-create-visual"><div class="m-avatar">${esc(initials({fullName:[state.draft?.contact?.first,state.draft?.contact?.last].filter(Boolean).join(' ')}))}</div></div><h1>${error?'Falta terminar':'Creando…'}</h1><div class="m-step-list"><div id="createContactStep" class="m-step ${state.createdContactId?'done':'active'}"><i>${state.createdContactId?'✓':'1'}</i><span>Creando contacto</span></div>${opportunityStep}<div id="createSyncStep" class="m-step ${readyForSync?'done':''}"><i>${readyForSync?'✓':includeOpportunity?'3':'2'}</i><span>Sincronizando con el CRM</span></div></div>${error?`<p class="m-form-msg" style="margin-top:18px">${esc(error)}</p><button class="m-primary" style="width:100%;margin-top:8px" data-action="retry-creation">Reintentar</button>${state.createdContactId?`<button class="m-secondary" style="width:100%;margin-top:8px" data-action="route" data-route="contact/${esc(state.createdContactId)}">Ver contacto creado</button>`:''}`:''}</div></div></div>`;
  }
  function setCreationStep(id,status){const node=byId(id);if(!node)return;node.className=`m-step ${status}`;const icon=node.querySelector('i');icon.textContent=status==='done'?'✓':status==='error'?'!':'•';}
  async function performCreation(){
    if(state.creating)return;state.creating=true;state.creationError=null;go('creating');await new Promise(resolve=>setTimeout(resolve,80));
    const contact=state.draft.contact,opp=state.draft.opportunity,includeOpportunity=state.draft.includeOpportunity!==false,fullName=[contact.first,contact.last].filter(Boolean).join(' ');
    try{
      if(!state.createdContactId){
        setCreationStep('createContactStep','active');
        const data={'NOMBRE':contact.first,'APELLIDOS':contact.last,'NOMBRE Y APELLIDOS':fullName,'TELÉFONO':contact.phone,'DNI / NIF':contact.dni,'DNI':contact.dni,'EMAIL':contact.email,'BANCO':contact.bank,'NOTAS':contact.notes,'OBSERVACIONES':contact.observations};
        const result=await client.from('records').insert({source_sheet:CONTACT_SOURCE,data}).select('id').single();if(result.error)throw result.error;state.createdContactId=result.data.id;setCreationStep('createContactStep','done');
      }
      if(includeOpportunity&&!state.createdOpportunityId){
        setCreationStep('createOpportunityStep','active');const stage=state.board.stages.find(row=>String(row.id)===String(opp.stageId));if(!stage)throw new Error('La columna seleccionada ya no existe.');
        const amount=opp.amount===''?null:Number(String(opp.amount).replace(',','.'));if(amount!==null&&!Number.isFinite(amount))throw new Error('El importe no es válido.');
        const result=await client.from('sales_opportunities').insert({pipeline_id:stage.pipeline_id,stage_id:stage.id,record_id:state.createdContactId,title:opp.title,client_name:fullName||null,phone:contact.phone||null,amount,expected_date:opp.expectedDate||null,owner_user_id:state.user.id,notes:opp.notes||null}).select('id').single();if(result.error)throw result.error;state.createdOpportunityId=result.data.id;setCreationStep('createOpportunityStep','done');
      }
      setCreationStep('createSyncStep','active');
      if(includeOpportunity&&opp.reminder&&opp.expectedDate&&has('can_manage_agenda')){
        const remind=new Date(`${opp.expectedDate}T09:00:00`);remind.setDate(remind.getDate()-2);
        const task={title:`Seguimiento · ${opp.title}`,description:`Recordatorio previo al cierre de la oportunidad ${opp.title}`,customer_name:fullName||null,customer_phone:contact.phone||null,starts_at:remind.toISOString(),reminder_at:null,assigned_to:state.user.id,related_record_id:state.createdContactId,status:'pending',reminder_minutes:[],notify_in_app:true,notify_email:false,sync_google_calendar:false,whatsapp_enabled:false};
        const result=await client.from('agenda_items').insert(task);if(result.error)toast('Contacto y oportunidad creados; el recordatorio no pudo guardarse.','error');
      }
      await refreshData({silent:true});setCreationStep('createSyncStep','done');state.creating=false;setTimeout(()=>go('success'),280);
    }catch(error){
      state.creationError=includeOpportunity&&state.createdContactId&&!state.createdOpportunityId?`El contacto está creado, pero falta la oportunidad: ${error?.message||'error desconocido'}`:(error?.message||'No se pudo completar la creación.');
      if(state.createdContactId){setCreationStep('createContactStep','done');await refreshData({silent:true});}
      const failedStep=!state.createdContactId?'createContactStep':includeOpportunity&&!state.createdOpportunityId?'createOpportunityStep':'createSyncStep';
      setCreationStep(failedStep,'error');state.creating=false;render();
    }
  }
  function renderSuccess(){
    const includeOpportunity=state.draft?.includeOpportunity!==false;
    return `<div class="m-page"><div class="m-success"><div class="m-success-check">✓</div><h1>${includeOpportunity?'Contacto y oportunidad creados':'Contacto creado'}</h1><p>${includeOpportunity?'Ya están vinculados y disponibles':'Ya está disponible'} en el CRM del ordenador y en el móvil.</p><div class="m-success-actions"><button class="m-primary" data-action="route" data-route="contact/${esc(state.createdContactId||'')}">Ver contacto</button>${includeOpportunity?`<button class="m-secondary" data-action="route" data-route="opportunity/${esc(state.createdOpportunityId||'')}">Ver oportunidad</button>`:''}<button class="m-ghost" data-action="finish-flow">Ir al inicio</button></div></div></div>`;
  }

  function mobileWaNormalizePhone(value){
    const raw=String(value||'').trim();
    if(raw.includes('@')&&!/@c\.us$/i.test(raw))return '';
    return raw.replace(/@.*$/,'').replace(/\D/g,'');
  }
  function mobileWaPhoneVariants(value){
    const phone=mobileWaNormalizePhone(value),variants=new Set();
    if(phone)variants.add(phone);
    if(phone.startsWith('34')&&phone.length>9)variants.add(phone.slice(2));
    if(phone.length===9)variants.add(`34${phone}`);
    if(phone.length>=9)variants.add(phone.slice(-9));
    return variants;
  }
  function mobileWaChatName(chat){
    const id=String(chat?.id||'');
    return clean(chat?.name)||mobileWaNormalizePhone(id)||(id.includes('@g.us')?'Grupo de WhatsApp':'Contacto de WhatsApp');
  }
  function mobileWaInitials(chat){
    const parts=mobileWaChatName(chat).split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0]||'W')+(parts.length>1?(parts.at(-1)?.[0]||''):'')).toUpperCase();
  }
  function mobileWaUnread(chat){
    for(const value of [chat?.unreadCount,chat?.unreadMessagesCount,chat?.unreadMessages,chat?.countUnread,chat?.unread]){
      const count=Number(value);if(Number.isFinite(count)&&count>0)return Math.floor(count);
    }
    return 0;
  }
  function mobileWaMessageText(message){
    const data=message?.messageData||{};
    const value=data?.textMessageData?.textMessage||data?.extendedTextMessageData?.text||data?.fileMessageData?.caption||message?.textMessage||message?.extendedTextMessage?.text||message?.caption||message?.message||'';
    const text=clean(value);
    if(/^(GREEN_API_(TOKEN|INSTANCE_ID|ID_INSTANCE|IDINSTANCE|API_TOKEN|TOKEN_INSTANCE|API_URL|MEDIA_URL))$/i.test(text))return '';
    if(/^process\.env\./i.test(text)||/GREEN-API no está disponible en esta función de Vercel/i.test(text))return '';
    return text;
  }
  function mobileWaMessageDirection(message){
    const type=String(message?.type||message?.typeMessage||message?.typeWebhook||'').toLowerCase();
    if(type.includes('outgoing')||message?.outgoing===true)return 'out';
    return 'in';
  }
  const mobileWaMessageTimestamp=message=>message?.timestamp||message?.sendAt||message?.time||message?.createdAt||0;
  function mobileWaMediaInfo(message){
    const data=message?.messageData||{},file=data?.fileMessageData||message?.fileMessageData||{};
    const type=String(data?.typeMessage||message?.typeMessage||message?.messageType||message?.typeWebhook||'').toLowerCase();
    const mime=String(file?.mimeType||message?.mimeType||'').toLowerCase();
    const url=clean(file?.downloadUrl||file?.urlFile||message?.downloadUrl||message?.urlFile||data?.downloadUrl||data?.urlFile);
    const name=clean(file?.fileName||message?.fileName)||'archivo';
    let kind='';
    if(type.includes('image')||type.includes('sticker')||mime.startsWith('image/'))kind='image';
    else if(type.includes('video')||mime.startsWith('video/'))kind='video';
    else if(type.includes('audio')||type.includes('voice')||mime.startsWith('audio/'))kind='audio';
    else if(type.includes('document')||type.includes('file')||url)kind='document';
    return {kind,mime,url,name};
  }
  function mobileWaPreview(chat){
    const message=chat?._lastMessage||chat?.lastMessage||null,text=mobileWaMessageText(message);
    if(text)return text;
    const kind=mobileWaMediaInfo(message).kind;
    if(kind==='image')return '📷 Foto';if(kind==='video')return '🎥 Vídeo';if(kind==='audio')return '🎵 Audio';if(kind==='document')return '📎 Documento';
    return String(chat?.id||'').includes('@g.us')?'Grupo':'Sin mensajes recientes';
  }
  function mobileWaTime(value){
    if(!value)return '';
    const number=Number(value),dateValue=new Date(number>0&&number<1e12?number*1000:value);if(Number.isNaN(dateValue.getTime()))return '';
    const now=new Date();return dateValue.toDateString()===now.toDateString()?dateValue.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}):dateValue.toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit'});
  }
  function mobileWaChatTimestamp(chat){return Number(mobileWaMessageTimestamp(chat?._lastMessage||chat?.lastMessage)||chat?.lastMessageTime||chat?.lastMessageTimestamp||chat?.timestamp||chat?.lastActivityTime||0);}
  function mobileWaSortedChats(chats=state.whatsapp.chats){
    return [...(chats||[])].filter(chat=>chat?.id).sort((a,b)=>mobileWaChatTimestamp(b)-mobileWaChatTimestamp(a)||mobileWaChatName(a).localeCompare(mobileWaChatName(b),'es'));
  }
  function mobileWaFilterCounts(chats=state.whatsapp.chats){
    const rows=chats||[];return {all:rows.length,unread:rows.filter(chat=>mobileWaUnread(chat)>0).length,contacts:rows.filter(chat=>!String(chat.id||'').includes('@g.us')).length,groups:rows.filter(chat=>String(chat.id||'').includes('@g.us')).length};
  }
  function mobileWaFilteredChats(){
    const query=clean(state.whatsapp.query).toLowerCase(),queryDigits=digits(query),filter=MOBILE_WA_FILTERS.includes(state.whatsapp.filter)?state.whatsapp.filter:'all';
    return mobileWaSortedChats().filter(chat=>{
      const group=String(chat.id||'').includes('@g.us');
      if(filter==='unread'&&mobileWaUnread(chat)<1)return false;
      if(filter==='contacts'&&group)return false;if(filter==='groups'&&!group)return false;
      const haystack=`${mobileWaChatName(chat)} ${mobileWaNormalizePhone(chat.id)}`.toLowerCase();
      return !query||haystack.includes(query)||(queryDigits.length>=3&&digits(haystack).includes(queryDigits));
    });
  }
  function mobileWaFindContact(chatId){
    if(String(chatId||'').includes('@')&&!/@c\.us$/i.test(String(chatId||'')))return null;
    const wanted=mobileWaPhoneVariants(chatId);if(!wanted.size)return null;
    return state.contacts.find(contact=>{const variants=mobileWaPhoneVariants(contact.phone);return [...wanted].some(value=>variants.has(value));})||null;
  }
  function mobileWaStatus(){
    const value=String(state.whatsapp.providerState||'').toLowerCase();
    if(value==='authorized')return {label:'WhatsApp conectado',className:'ok'};
    if(value==='blocked'||value==='notauthorized')return {label:'WhatsApp sin conexión',className:'error'};
    if(state.whatsapp.loadingChats&&!state.whatsapp.loaded)return {label:'Conectando…',className:'loading'};
    return {label:'Sincronización disponible',className:'warn'};
  }
  function renderMobileWaStatus(){
    const status=mobileWaStatus(),sync=state.whatsapp.lastSync?` · ${mobileWaTime(state.whatsapp.lastSync)}`:'';
    return `<span class="m-wa-status ${status.className}"><i></i>${esc(status.label+sync)}</span>`;
  }
  function renderMobileWaFilters(){
    const counts=mobileWaFilterCounts(),active=MOBILE_WA_FILTERS.includes(state.whatsapp.filter)?state.whatsapp.filter:'all';
    const options=[['all','Todos'],['unread','No leídos'],['contacts','Contactos'],['groups','Grupos']];
    return options.map(([key,label])=>`<button class="m-wa-filter ${active===key?'active':''}" data-action="wa-filter" data-filter="${key}" type="button" aria-pressed="${active===key}"><span>${label}</span><b>${counts[key]||0}</b></button>`).join('');
  }
  function renderMobileWaChatRow(chat){
    const name=mobileWaChatName(chat),id=String(chat.id||''),group=id.includes('@g.us'),lid=id.includes('@lid'),unread=mobileWaUnread(chat),time=mobileWaTime(mobileWaChatTimestamp(chat));
    const kind=group?'Grupo':lid?'Contacto de WhatsApp':`+${mobileWaNormalizePhone(id)}`;
    return `<button class="m-wa-chat-row ${unread?'unread':''}" data-action="route" data-route="whatsapp-chat/${esc(encodeURIComponent(id))}" type="button"><span class="m-avatar m-wa-avatar">${esc(mobileWaInitials(chat))}</span><span class="m-wa-chat-main"><span class="m-wa-chat-top"><strong>${esc(name)}</strong><time>${esc(time)}</time></span><span class="m-wa-chat-bottom"><small>${esc(mobileWaPreview(chat))}</small>${unread?`<b>${unread>99?'99+':unread}</b>`:''}</span><span class="m-wa-chat-kind">${esc(kind)}</span></span></button>`;
  }
  function renderMobileWaListBody(){
    if(state.whatsapp.loadingChats&&!state.whatsapp.loaded)return skeleton();
    if(state.whatsapp.error&&!state.whatsapp.loaded)return `<div class="m-duplicate warn">${esc(state.whatsapp.error)}</div><button class="m-secondary" style="width:100%" data-action="wa-refresh">Reintentar</button>`;
    const all=mobileWaFilteredChats(),rows=all.slice(0,state.whatsapp.limit),warning=state.whatsapp.error?`<div class="m-duplicate warn">${esc(state.whatsapp.error)}</div>`:'';
    if(!rows.length)return `${warning}${empty(state.whatsapp.chats.length?'Sin resultados':'Sin conversaciones',state.whatsapp.chats.length?'Prueba otro texto o filtro.':'No se han encontrado chats de WhatsApp.')}`;
    const more=all.length>rows.length?`<button class="m-secondary m-wa-more" data-action="wa-more" type="button">Mostrar más (${all.length-rows.length})</button>`:'';
    return `${warning}<div class="m-wa-result-count">${rows.length} de ${all.length} conversaciones</div><div class="m-wa-chat-list">${rows.map(renderMobileWaChatRow).join('')}</div>${more}`;
  }
  function renderMobileWhatsApp(){
    if(!has('can_use_whatsapp'))return `<div class="m-page">${pageHead('WhatsApp','home')}${empty('Acceso restringido','No tienes permiso para utilizar WhatsApp.')}</div>`;
    const refresh='<button class="m-back m-wa-refresh" data-action="wa-refresh" type="button" aria-label="Actualizar WhatsApp">↻</button>';
    const head=`<div class="m-page-head"><button class="m-back" data-action="wa-back-home" type="button" aria-label="Volver al inicio">‹</button><h1>WhatsApp</h1>${refresh}</div>`;
    return `<div class="m-page m-wa-page">${head}<div id="mobileWaStatus">${renderMobileWaStatus()}</div><div class="m-search m-wa-search"><input id="mobileWaSearch" class="m-input" value="${esc(state.whatsapp.query)}" placeholder="Buscar nombre o teléfono" autocomplete="off"></div><div id="mobileWaFilters" class="m-wa-filters" role="group" aria-label="Filtrar conversaciones">${renderMobileWaFilters()}</div><div id="mobileWaList">${renderMobileWaListBody()}</div></div>`;
  }
  async function mobileWaApi(action,payload={}){
    const getActions=new Set(['state','summary','chats']);if(!getActions.has(action)&&!['file','history','send','read','sendfile'].includes(action))throw new Error('Acción móvil no permitida.');
    const {data,error}=await client.auth.getSession();if(error)throw error;
    const token=data?.session?.access_token;if(!token)throw new Error('La sesión ha caducado. Vuelve a entrar.');
    const method=getActions.has(action)?'GET':'POST',controller=typeof AbortController==='function'?new AbortController():null;
    const timer=controller?setTimeout(()=>controller.abort(),action==='summary'?30000:20000):null;
    try{
      const response=await fetch(`/api/mobile-green?action=${encodeURIComponent(action)}`,{method,headers:{Authorization:`Bearer ${token}`,...(method==='POST'?{'Content-Type':'application/json'}:{})},body:method==='POST'?JSON.stringify(payload||{}):undefined,cache:'no-store',signal:controller?.signal});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||result?.ok===false){const requestError=new Error(result?.error||`WhatsApp no respondió (${response.status}).`);requestError.status=response.status;throw requestError;}
      return result;
    }catch(error){if(error?.name==='AbortError')throw new Error('WhatsApp está tardando demasiado. Pulsa Actualizar para volver a intentarlo.');throw error;}
    finally{if(timer)clearTimeout(timer);}
  }
  function updateMobileWaListDom(){
    const status=byId('mobileWaStatus'),filters=byId('mobileWaFilters'),list=byId('mobileWaList'),button=document.querySelector('[data-action="wa-refresh"]');
    if(status)status.innerHTML=renderMobileWaStatus();if(filters)filters.innerHTML=renderMobileWaFilters();if(list)list.innerHTML=renderMobileWaListBody();if(button)button.disabled=state.whatsapp.loadingChats;
  }
  async function loadMobileWaChats({silent=false,light=false}={}){
    if(!has('can_use_whatsapp')||state.whatsapp.loadingChats)return;
    state.whatsapp.loadingChats=true;state.whatsapp.error='';if(!silent)updateMobileWaListDom();
    try{
      const action=light&&state.whatsapp.loaded?'chats':'summary';
      const [result,status]=await Promise.all([mobileWaApi(action),mobileWaApi('state').catch(()=>null)]),rows=Array.isArray(result?.chats)?result.chats.filter(chat=>chat?.id):[];
      if(action==='chats'){
        const previous=new Map(state.whatsapp.chats.map(chat=>[String(chat.id),chat]));
        state.whatsapp.chats=rows.map(chat=>{const old=previous.get(String(chat.id))||{};return {...old,...chat,_lastMessage:chat?._lastMessage||chat?.lastMessage||old?._lastMessage||old?.lastMessage||null};});
      }else state.whatsapp.chats=rows;
      state.whatsapp.loaded=true;state.whatsapp.lastSync=Date.now();state.whatsapp.providerState=status?.state||status?.data?.stateInstance||'';
    }catch(error){state.whatsapp.error=error?.message||'No se pudieron cargar las conversaciones.';}
    finally{state.whatsapp.loadingChats=false;if(route().parts[0]==='whatsapp')updateMobileWaListDom();scheduleMobileWaRefresh();}
  }
  function initMobileWhatsAppList(){
    if(!has('can_use_whatsapp')){stopMobileWaRefresh();return;}
    const input=byId('mobileWaSearch');if(input)input.oninput=()=>{state.whatsapp.query=input.value;state.whatsapp.limit=MOBILE_WA_PAGE_SIZE;updateMobileWaListDom();};
    if(!state.whatsapp.loaded&&!state.whatsapp.loadingChats)loadMobileWaChats();else scheduleMobileWaRefresh();
  }
  function mobileWaSafeUrl(value){try{const url=new URL(String(value||''));return url.protocol==='https:'?url.href:'';}catch(_){return '';}}
  function renderMobileWaMedia(message){
    const info=mobileWaMediaInfo(message);if(!info.kind)return '';
    const url=mobileWaSafeUrl(info.url),label=info.kind==='image'?'Foto':info.kind==='video'?'Vídeo':info.kind==='audio'?'Audio':'Documento';
    if(info.kind==='image'&&url)return `<a class="m-wa-media-link" href="${esc(url)}" target="_blank" rel="noopener"><img class="m-wa-media" src="${esc(url)}" loading="lazy" alt="Foto de WhatsApp"></a>`;
    if(info.kind==='video'&&url)return `<video class="m-wa-media" src="${esc(url)}" controls preload="metadata"></video>`;
    if(info.kind==='audio'&&url)return `<audio class="m-wa-audio" src="${esc(url)}" controls preload="metadata"></audio>`;
    if(url)return `<a class="m-wa-document" href="${esc(url)}" target="_blank" rel="noopener">📎 ${esc(info.name||label)}</a>`;
    const id=clean(message?.idMessage);return id?`<button class="m-wa-document" data-action="wa-load-media" data-id="${esc(id)}" type="button">${info.kind==='image'?'📷':info.kind==='video'?'🎥':info.kind==='audio'?'🎵':'📎'} Cargar ${esc(label.toLowerCase())}</button>`:`<span class="m-wa-document">${esc(label)}</span>`;
  }
  function mobileWaFallbackMessage(message){
    const type=String(message?.messageData?.typeMessage||message?.typeMessage||message?.messageType||'').toLowerCase();
    if(type.includes('contact'))return '👤 Contacto compartido';if(type.includes('location'))return '📍 Ubicación';if(type.includes('reaction'))return '↪ Reacción';if(type.includes('template'))return '▤ Plantilla';if(type.includes('interactive'))return '☑ Respuesta interactiva';if(type.includes('quoted'))return '↩ Mensaje citado';return type?'Mensaje de WhatsApp':'';
  }
  function renderMobileWaMessages(){
    if(state.whatsapp.loadingHistory&&!state.whatsapp.messages.length)return skeleton();
    if(state.whatsapp.historyError&&!state.whatsapp.messages.length)return `<div class="m-duplicate warn">${esc(state.whatsapp.historyError)}</div><button class="m-secondary" style="width:100%" data-action="wa-refresh-chat">Reintentar</button>`;
    const rows=[...state.whatsapp.messages].sort((a,b)=>Number(mobileWaMessageTimestamp(a)||0)-Number(mobileWaMessageTimestamp(b)||0));
    if(!rows.length)return empty('Sin mensajes','Todavía no hay mensajes disponibles en este chat.');
    return rows.map(message=>{const direction=mobileWaMessageDirection(message),text=mobileWaMessageText(message),media=renderMobileWaMedia(message),fallback=mobileWaFallbackMessage(message);if(!text&&!media&&!fallback)return '';
      return `<div class="m-wa-msg ${direction}"><div class="m-wa-bubble">${media}${text?`<div class="m-wa-text">${esc(text)}</div>`:fallback?`<div class="m-wa-text m-wa-placeholder">${esc(fallback)}</div>`:''}<time>${esc(mobileWaTime(mobileWaMessageTimestamp(message)))}</time></div></div>`;
    }).join('')||empty('Sin mensajes','No hay mensajes de texto o archivos disponibles.');
  }
  function mobileWaSelectedChat(chatId=state.whatsapp.selectedId){return state.whatsapp.chats.find(chat=>String(chat.id)===String(chatId))||{id:chatId,name:mobileWaNormalizePhone(chatId)||'WhatsApp'};}
  function renderMobileWaContactAction(chat){
    const id=String(chat.id||''),group=id.includes('@g.us'),lid=id.includes('@lid');if(group)return '<span>Los grupos no se vinculan a una ficha.</span>';if(lid)return '<span>Este chat no muestra un teléfono verificable.</span>';
    const contact=mobileWaFindContact(chat.id);
    if(contact)return `<span>Contacto sincronizado</span><button class="m-secondary" data-action="route" data-route="contact/${esc(contact.id)}" type="button">Ver ficha</button>`;
    if(has('can_create_database')&&has('can_view_database'))return `<span>No está en Contactos</span><button class="m-secondary" data-action="wa-create-contact" data-chat-id="${esc(chat.id)}" type="button">Crear contacto</button>`;
    return '<span>No está vinculado a Contactos.</span>';
  }
  function renderMobileWhatsAppChat(chatId){
    if(!has('can_use_whatsapp'))return `<div class="m-page">${pageHead('WhatsApp','home')}${empty('Acceso restringido','No tienes permiso para utilizar WhatsApp.')}</div>`;
    if(!chatId)return `<div class="m-page">${pageHead('WhatsApp','whatsapp')}${empty('Chat no encontrado','Vuelve a la lista de conversaciones.')}</div>`;
    const chat=mobileWaSelectedChat(chatId),id=String(chat.id||''),phone=id.includes('@g.us')?'Grupo':id.includes('@lid')?'Contacto de WhatsApp':`+${mobileWaNormalizePhone(id)}`,sameChat=String(state.whatsapp.selectedId)===String(chatId),busy=state.whatsapp.sending?' disabled':'',busyText=state.whatsapp.sending?'Hay un envío en curso…':'';
    return `<div class="m-page m-wa-chat-page"><div class="m-wa-chat-head"><button class="m-back" data-action="wa-back-list" type="button" aria-label="Volver a conversaciones">‹</button><span class="m-avatar m-wa-avatar">${esc(mobileWaInitials(chat))}</span><span class="m-wa-chat-title"><strong>${esc(mobileWaChatName(chat))}</strong><small>${esc(phone)}</small></span><button class="m-back m-wa-refresh" data-action="wa-refresh-chat" type="button" aria-label="Actualizar chat">↻</button></div><div class="m-wa-contact-link">${renderMobileWaContactAction(chat)}</div><div id="mobileWaMessages" class="m-wa-messages" aria-live="polite">${sameChat?renderMobileWaMessages():skeleton()}</div><div class="m-wa-composer"><button class="m-secondary m-wa-attach" data-action="wa-attach" type="button" aria-label="Adjuntar foto o archivo"${busy}>＋</button><textarea id="mobileWaComposer" class="m-textarea" rows="1" maxlength="4096" placeholder="Escribe un mensaje"${busy}></textarea><button id="mobileWaSend" class="m-primary" data-action="wa-send" type="button"${busy}>Enviar</button><small id="mobileWaComposerMsg" class="m-form-msg">${esc(busyText)}</small></div></div>`;
  }
  function updateMobileWaMessagesDom({scrollBottom=false}={}){
    const box=byId('mobileWaMessages');if(!box)return;const previousTop=box.scrollTop,nearBottom=box.scrollHeight-box.scrollTop-box.clientHeight<90;box.innerHTML=renderMobileWaMessages();if(scrollBottom||nearBottom)setTimeout(()=>{box.scrollTop=box.scrollHeight;},20);else box.scrollTop=previousTop;
    const refresh=document.querySelector('[data-action="wa-refresh-chat"]');if(refresh)refresh.disabled=state.whatsapp.loadingHistory;
  }
  const mobileWaHistorySignature=messages=>(messages||[]).map(message=>{const media=mobileWaMediaInfo(message);return `${message?.idMessage||''}:${mobileWaMessageTimestamp(message)}:${mobileWaMessageDirection(message)}:${mobileWaMessageText(message)}:${media.kind}:${media.url}`;}).join('|');
  async function loadMobileWaHistory(chatId,{silent=false,scrollBottom=false}={}){
    if(!chatId||!has('can_use_whatsapp'))return;if(state.whatsapp.loadingHistory&&String(chatId)===String(state.whatsapp.historyLoadingId))return;
    const requestId=Number(state.whatsapp.historyRequestId||0)+1;state.whatsapp.historyRequestId=requestId;state.whatsapp.loadingHistory=true;state.whatsapp.historyLoadingId=chatId;state.whatsapp.historyError='';if(!silent)updateMobileWaMessagesDom();
    try{
      const result=await mobileWaApi('history',{chatId,count:100}),providerMessages=Array.isArray(result?.messages)?result.messages:[],providerIds=new Set(providerMessages.map(message=>String(message?.idMessage||'')).filter(Boolean));
      if(Number(state.whatsapp.historyRequestId)!==requestId||String(state.whatsapp.selectedId)!==String(chatId))return;
      const recentLocal=state.whatsapp.messages.filter(message=>message?.__mobilePending&&!providerIds.has(String(message?.idMessage||''))&&Date.now()-Number(mobileWaMessageTimestamp(message)||0)*1000<120000),messages=[...providerMessages,...recentLocal];
      const changed=mobileWaHistorySignature(messages)!==mobileWaHistorySignature(state.whatsapp.messages);state.whatsapp.messages=messages;if(changed||!silent)updateMobileWaMessagesDom({scrollBottom:scrollBottom||!silent});
    }catch(error){if(Number(state.whatsapp.historyRequestId)===requestId&&String(state.whatsapp.selectedId)===String(chatId)){state.whatsapp.historyError=error?.message||'No se pudo cargar el historial.';updateMobileWaMessagesDom();}}
    finally{if(Number(state.whatsapp.historyRequestId)!==requestId)return;state.whatsapp.loadingHistory=false;state.whatsapp.historyLoadingId='';const refresh=document.querySelector('[data-action="wa-refresh-chat"]');if(refresh)refresh.disabled=false;scheduleMobileWaRefresh();}
  }
  function scrollMobileWaBottom(){const box=byId('mobileWaMessages');if(box)setTimeout(()=>{box.scrollTop=box.scrollHeight;},20);}
  function markMobileWaRead(chatId){
    const now=Date.now(),last=Number(state.whatsapp.readAt?.[chatId]||0);if(!chatId||now-last<60000)return;
    state.whatsapp.readAt[chatId]=now;mobileWaApi('read',{chatId}).catch(()=>{});
  }
  function initMobileWhatsAppChat(chatId){
    if(!has('can_use_whatsapp')){stopMobileWaRefresh();return;}if(!chatId){go('whatsapp',true);return;}
    const changed=String(state.whatsapp.selectedId)!==String(chatId);state.whatsapp.selectedId=chatId;
    if(changed){state.whatsapp.messages=[];state.whatsapp.historyError='';updateMobileWaMessagesDom();}
    const chat=state.whatsapp.chats.find(row=>String(row.id)===String(chatId));if(chat)chat.unreadCount=0;
    const composer=byId('mobileWaComposer');if(composer)composer.onkeydown=event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendMobileWaMessage();}};
    if(changed||!state.whatsapp.messages.length)loadMobileWaHistory(chatId,{scrollBottom:true});else{scrollMobileWaBottom();scheduleMobileWaRefresh();}
    markMobileWaRead(chatId);
  }
  function setMobileWaSending(value,message='',chatId=''){
    state.whatsapp.sending=value;state.whatsapp.sendingChatId=value?(chatId||state.whatsapp.sendingChatId):'';const send=byId('mobileWaSend'),attach=document.querySelector('[data-action="wa-attach"]'),composer=byId('mobileWaComposer'),status=byId('mobileWaComposerMsg');
    if(send)send.disabled=value;if(attach)attach.disabled=value;if(composer)composer.disabled=value;if(status)status.textContent=message;
  }
  async function sendMobileWaMessage(){
    if(state.whatsapp.sending)return;const chatId=state.whatsapp.selectedId,input=byId('mobileWaComposer'),message=clean(input?.value);if(!chatId||!message)return;
    setMobileWaSending(true,'Enviando…',chatId);
    try{
      const result=await mobileWaApi('send',{chatId,message});if(input)input.value='';
      const local={type:'outgoing',outgoing:true,__mobilePending:true,idMessage:result?.idMessage||`local-${Date.now()}`,timestamp:Math.floor(Date.now()/1000),messageData:{typeMessage:'textMessage',textMessageData:{textMessage:message}}};
      if(String(state.whatsapp.selectedId)===String(chatId)){state.whatsapp.messages.push(local);updateMobileWaMessagesDom({scrollBottom:true});}const chat=state.whatsapp.chats.find(row=>String(row.id)===String(chatId));if(chat)chat._lastMessage=local;toast('Mensaje enviado.','success');
    }catch(error){const ambiguous=!error?.status;toast(ambiguous?'No se pudo confirmar el envío. Revisa el chat antes de volver a enviarlo.':(error?.message||'No se pudo enviar.'),'error');}
    finally{setMobileWaSending(false,'');scheduleMobileWaRefresh();}
  }
  const mobileWaFileDataUrl=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(new Error('No se pudo leer el archivo.'));reader.readAsDataURL(file);});
  async function sendMobileWaFile(file){
    if(!file||state.whatsapp.sending)return;if(file.size>2500000){toast('El archivo supera el límite de 2,5 MB.','error');return;}
    const chatId=state.whatsapp.selectedId;if(!chatId)return;setMobileWaSending(true,'Enviando archivo…',chatId);
    try{const dataUrl=await mobileWaFileDataUrl(file);await mobileWaApi('sendfile',{chatId,fileName:file.name||'archivo',mimeType:file.type||'application/octet-stream',dataUrl});toast('Archivo enviado.','success');await loadMobileWaHistory(chatId,{silent:true,scrollBottom:true});}
    catch(error){const ambiguous=!error?.status;toast(ambiguous?'No se pudo confirmar el archivo. Revisa el chat antes de volver a enviarlo.':(error?.message||'No se pudo enviar el archivo.'),'error');}
    finally{setMobileWaSending(false,'');scheduleMobileWaRefresh();}
  }
  async function loadMobileWaMedia(idMessage){
    const message=state.whatsapp.messages.find(row=>String(row?.idMessage)===String(idMessage));if(!message||!state.whatsapp.selectedId)return;
    try{const result=await mobileWaApi('file',{chatId:state.whatsapp.selectedId,idMessage});if(result?.downloadUrl){message.downloadUrl=result.downloadUrl;updateMobileWaMessagesDom();}else toast('El archivo ya no está disponible.','error');}catch(error){toast(error?.message||'No se pudo cargar el archivo.','error');}
  }
  function startContactFromMobileWa(chatId){
    if(!has('can_create_database')||!has('can_view_database')||!/@c\.us$/i.test(String(chatId||'')))return;const chat=mobileWaSelectedChat(chatId),phone=mobileWaNormalizePhone(chat.id),shownPhone=phone.startsWith('34')&&phone.length===11?phone.slice(2):phone;
    const rawName=clean(chat.name)&&!/^\+?\d+$/.test(clean(chat.name))?chat.name:'',name=splitFullName(rawName);resetDraft();state.draft.contact={...state.draft.contact,first:name.first,last:name.last,phone:shownPhone};go('detected');
  }
  function stopMobileWaRefresh(){if(mobileWaRefreshTimer){clearTimeout(mobileWaRefreshTimer);mobileWaRefreshTimer=null;}}
  function scheduleMobileWaRefresh(){
    stopMobileWaRefresh();const current=route(),page=current.parts[0];if(!has('can_use_whatsapp')||!['whatsapp','whatsapp-chat'].includes(page)||document.hidden)return;
    mobileWaRefreshTimer=setTimeout(async()=>{mobileWaRefreshTimer=null;const latest=route();if(latest.parts[0]==='whatsapp')await loadMobileWaChats({silent:true,light:true});else if(latest.parts[0]==='whatsapp-chat')await loadMobileWaHistory(safeDecode(latest.parts[1]),{silent:true});scheduleMobileWaRefresh();},page==='whatsapp-chat'?20000:180000);
  }

  function renderMore(){
    return `<div class="m-page">${pageHead('Más','home')}<div class="m-info-card">${infoRow('Usuario',state.perms?.display_name||state.user?.email)}${infoRow('Sincronización','Mismo CRM y misma base de datos')}${infoRow('Última actualización',state.lastRefresh?dateTime(state.lastRefresh):'—')}</div><div class="m-action-stack" style="margin-top:14px"><button class="m-secondary" data-action="refresh">↻ Actualizar datos</button><button class="m-secondary" data-action="open-desktop">Abrir CRM completo</button><button class="m-danger" data-action="logout">Cerrar sesión</button></div></div>`;
  }

  function bindStaticEvents(){
    byId('mobileLoginForm').addEventListener('submit',signIn);
    byId('mobileBrand').onclick=()=>go('home');byId('mobileAlerts').onclick=()=>go('alerts');byId('mobileMenu').onclick=()=>go('more');byId('mobileAdd').onclick=()=>{resetDraft();go('scan');};
    document.querySelectorAll('[data-mobile-route]').forEach(button=>button.onclick=()=>go(button.dataset.mobileRoute));
    byId('mobileCameraInput').onchange=event=>{handleImage(event.target.files?.[0]);event.target.value='';};
    byId('mobileGalleryInput').onchange=event=>{handleImage(event.target.files?.[0]);event.target.value='';};
    byId('mobileWhatsAppFileInput').onchange=event=>{sendMobileWaFile(event.target.files?.[0]);event.target.value='';};
    byId('mobileView').addEventListener('click',handleViewClick);
    addEventListener('hashchange',render);
    addEventListener('pageshow',()=>{if(state.user&&Date.now()-state.lastRefresh>30000)refreshData({silent:true}).then(render);});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){stopMobileWaRefresh();return;}if(state.user&&Date.now()-state.lastRefresh>30000)refreshData({silent:true}).then(render);const current=route();if(current.parts[0]==='whatsapp')loadMobileWaChats({silent:true,light:true});else if(current.parts[0]==='whatsapp-chat')loadMobileWaHistory(safeDecode(current.parts[1]),{silent:true});});
    addEventListener('pagehide',stopMobileWaRefresh);
  }
  async function handleViewClick(event){
    const target=event.target.closest('[data-action]');if(!target)return;event.preventDefault();const action=target.dataset.action;
    if(action==='route'){
      const destination=String(target.dataset.route||''),current=route().parts[0];
      if(destination.startsWith('whatsapp-chat/'))state.whatsapp.listScroll=Number(byId('mobileView')?.scrollTop||0);
      else if(destination==='whatsapp'&&current!=='whatsapp-chat')state.whatsapp.listScroll=0;
      go(destination);
    }
    if(action==='back')goBack(target.dataset.fallback||'home');
    if(action==='start-scan'){resetDraft();go('scan');}
    if(action==='manual-contact'){resetDraft();go('detected');}
    if(action==='camera')byId('mobileCameraInput').click();
    if(action==='gallery')byId('mobileGalleryInput').click();
    if(action==='analyse-scan')analyseScan();
    if(action==='check-duplicates')checkDuplicates();
    if(action==='continue-detected')continueDetected();
    if(action==='toggle-reminder'){target.classList.toggle('on');target.setAttribute('aria-pressed',target.classList.contains('on'));}
    if(action==='continue-opportunity')continueOpportunity();
    if(action==='skip-opportunity')skipOpportunity();
    if(action==='create-all')performCreation();
    if(action==='retry-creation')performCreation();
    if(action==='finish-flow'){resetDraft();go('home');}
    if(action==='profile-tab'){state.profileTab=target.dataset.tab;render();}
    if(action==='task-filter'){state.taskFilter=TASK_FILTERS.includes(target.dataset.filter)?target.dataset.filter:'all';render();}
    if(action==='wa-filter'){state.whatsapp.filter=MOBILE_WA_FILTERS.includes(target.dataset.filter)?target.dataset.filter:'all';state.whatsapp.limit=MOBILE_WA_PAGE_SIZE;updateMobileWaListDom();}
    if(action==='wa-more'){state.whatsapp.limit+=MOBILE_WA_PAGE_SIZE;updateMobileWaListDom();}
    if(action==='wa-refresh')loadMobileWaChats();
    if(action==='wa-back-home')go('home',true);
    if(action==='wa-back-list')go('whatsapp',true);
    if(action==='wa-refresh-chat')loadMobileWaHistory(state.whatsapp.selectedId,{scrollBottom:false});
    if(action==='wa-send')sendMobileWaMessage();
    if(action==='wa-attach')byId('mobileWhatsAppFileInput').click();
    if(action==='wa-load-media')loadMobileWaMedia(target.dataset.id);
    if(action==='wa-create-contact')startContactFromMobileWa(target.dataset.chatId);
    if(action==='save-contact')saveContact(target.dataset.id);
    if(action==='save-task')saveTask(target.dataset.contactId);
    if(action==='complete-task')completeTask(target.dataset.id);
    if(action==='refresh')refreshData();
    if(action==='logout')signOut();
    if(action==='open-desktop')location.href='/';
  }

  boot();
})();
