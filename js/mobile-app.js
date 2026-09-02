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
    loading:false,lastRefresh:0,profileTab:'summary',scanFile:null,scanUrl:'',
    draft:null,createdContactId:null,createdOpportunityId:null,creationError:null,creating:false
  };

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
  const todayKey=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};

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
    await client.auth.signOut();state.user=null;state.perms=null;state.contacts=[];state.tasks=[];state.board={stages:[],opportunities:[],fields:[]};location.hash='';showLogin();
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
      view.scrollTop=0;
    }catch(error){view.innerHTML=`<div class="m-page">${pageHead('CRM móvil')} ${empty('No se pudo abrir esta pantalla',error?.message||'Vuelve a intentarlo.')}</div>`;}
  }
  function setActiveNav(name){
    const group=name==='contact'||name==='edit-contact'?'contacts':name==='opportunity'?'opportunities':['scan','detected','new-opportunity','review','creating','success'].includes(name)?'add':name;
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
        <button class="m-quick" data-action="open-desktop"><span>◉</span><small>WhatsApp</small></button>
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
    return `<article class="m-list-card"><div class="m-list-row"><span class="m-avatar">▣</span><span class="m-list-main"><strong>${esc(task.title||'Tarea')}</strong><small>${esc(task.customer_name||'Sin contacto')} · ${esc(dateTime(task.starts_at))}</small></span><span class="m-badge ${String(task.status)==='completed'?'':overdue?'red':'amber'}">${String(task.status)==='completed'?'Completada':overdue?'Vencida':'Pendiente'}</span></div>${task.description?`<p class="m-muted" style="font-size:.75rem;margin:10px 0 0">${esc(task.description)}</p>`:''}${String(task.status)==='pending'&&has('can_manage_agenda')?`<div class="m-task-actions"><button class="m-secondary" data-action="complete-task" data-id="${esc(task.id)}">Marcar completada</button>${task.related_record_id?`<button class="m-secondary" data-action="route" data-route="contact/${esc(task.related_record_id)}">Ver contacto</button>`:''}</div>`:''}</article>`;
  }
  function renderTasks(){
    if(!has('can_view_agenda')&&!has('can_manage_agenda'))return `<div class="m-page">${pageHead('Tareas')}${empty('Acceso restringido','No tienes permiso para ver tareas.')}</div>`;
    const rows=[...state.tasks].sort((a,b)=>String(a.starts_at||'').localeCompare(String(b.starts_at||'')));
    return `<div class="m-page">${pageHead('Tareas','home')}${rows.length?`<div class="m-list">${rows.map(taskCard).join('')}</div>`:empty('Sin tareas','No hay tareas pendientes ni completadas.')}</div>`;
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
    state.draft={contact:{first:'',last:'',dni:'',phone:'',email:'',bank:'',observations:'',notes:''},opportunity:{title:'',stageId:firstStage?.id||'',expectedDate:'',amount:'',notes:'',reminder:true},duplicates:[]};
  }
  function resetDraft(){
    if(state.scanUrl)URL.revokeObjectURL(state.scanUrl);
    state.scanFile=null;state.scanUrl='';state.draft=null;state.createdContactId=null;state.createdOpportunityId=null;state.creationError=null;state.creating=false;ensureDraft();
  }
  function renderScan(){
    return `<div class="m-page">${pageHead('Escanear contacto','home')}<div class="m-camera-stage">${state.scanUrl?`<img src="${esc(state.scanUrl)}" alt="Documento seleccionado">`:'<div class="m-camera-placeholder"><span>▧</span><strong>Fotografía el documento o la pantalla</strong><p>La imagen se procesa en el teléfono y no se guarda en el CRM.</p></div>'}</div><div class="m-camera-actions"><button class="m-primary" data-action="camera">Cámara</button><button class="m-secondary" data-action="gallery">Fototeca</button></div>${state.scanFile?'<button class="m-primary" style="width:100%;margin-top:12px" data-action="analyse-scan">Detectar datos</button>':'<button class="m-ghost" style="width:100%;margin-top:8px" data-action="manual-contact">Escribir datos manualmente</button>'}<div id="mobileOcrProgress"></div></div>`;
  }
  async function handleImage(file){
    if(!file)return;if(state.scanUrl)URL.revokeObjectURL(state.scanUrl);state.scanFile=file;state.scanUrl=URL.createObjectURL(file);go('scan');
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
        'initializing api':'Preparando el reconocimiento…','recognizing text':'Leyendo DNI, teléfono y nombre…'
      };
      const result=await window.TPFMobileOCR.recognize(state.scanFile,event=>{label.textContent=labels[event.status]||'Preparando el documento…';bar.style.width=`${Math.max(5,Math.round(event.progress*100))}%`;});
      ensureDraft();state.draft.contact={...state.draft.contact,first:result.first||'',last:result.last||'',dni:result.dni||'',phone:result.phone||''};go('detected');
      if(!result.first&&!result.dni&&!result.phone)toast('No se pudieron reconocer los datos. Puedes escribirlos manualmente.','error');
    }catch(error){progress.innerHTML=`<div class="m-duplicate warn">${esc(error?.message||'No se pudo leer la imagen.')} Puedes continuar escribiendo los datos.</div><button class="m-secondary" style="width:100%" data-action="manual-contact">Continuar manualmente</button>`;}
    finally{button.disabled=false;}
  }
  function renderDetected(){
    const contact=state.draft.contact;const duplicate=state.draft.duplicates||[];
    const duplicateHtml=duplicate.length?`<div class="m-duplicate warn">Se han encontrado ${duplicate.length} posibles duplicados. Revisa el DNI o el teléfono antes de continuar.</div>`:'<div class="m-duplicate">✓ No se ha encontrado ningún contacto duplicado.</div>';
    return `<div class="m-page">${pageHead('Datos detectados','scan')}<p class="m-muted">Comprueba la información antes de continuar. Todos los campos se pueden corregir.</p>${duplicateHtml}${contactFields(contact,'draft')}<button class="m-primary" style="width:100%;margin-top:18px" data-action="continue-detected">Continuar</button><button class="m-ghost" style="width:100%;margin-top:5px" data-action="check-duplicates">Comprobar duplicados</button><p id="mobileDetectedMsg" class="m-form-msg"></p></div>`;
  }
  async function captureDraftContact(){state.draft.contact=readContactFields('draft');return state.draft.contact;}
  async function checkDuplicates(){
    const contact=await captureDraftContact();
    try{const {data,error}=await client.rpc('find_possible_duplicate_contact',{phone_text:contact.phone||null,dni_text:contact.dni||null,email_text:contact.email||null});if(error)throw error;state.draft.duplicates=data||[];render();return state.draft.duplicates;}catch(error){byId('mobileDetectedMsg').textContent=error?.message||'No se pudo comprobar.';return [];}
  }
  async function continueDetected(){
    const contact=await captureDraftContact();if(!contact.first&&!contact.last){byId('mobileDetectedMsg').textContent='Escribe el nombre o los apellidos.';return;}
    if(!has('can_create_database')||!has('can_view_database')){byId('mobileDetectedMsg').textContent='No tienes permiso para crear y consultar contactos.';return;}
    if(!has('can_edit_sales')||!has('can_view_sales')){byId('mobileDetectedMsg').textContent='No tienes permiso para crear y consultar oportunidades.';return;}
    await checkDuplicates();go('new-opportunity');
  }
  function renderOpportunityForm(){
    const contact=state.draft.contact,opp=state.draft.opportunity;if(!opp.title)opp.title=`Oportunidad - ${[contact.first,contact.last].filter(Boolean).join(' ')}`;
    return `<div class="m-page">${pageHead('Nueva oportunidad','detected')}<p class="m-muted">El contacto se creará y quedará vinculado a esta oportunidad.</p><div class="m-form-grid"><label class="m-field"><span>Nombre de oportunidad</span><input id="draftOppTitle" class="m-input" value="${esc(opp.title)}"></label><label class="m-field"><span>Columna / Estado</span><select id="draftOppStage" class="m-select">${state.board.stages.map(stage=>`<option value="${esc(stage.id)}" ${String(stage.id)===String(opp.stageId)?'selected':''}>${esc(stage.name)}</option>`).join('')}</select></label><label class="m-field"><span>Fecha de cierre prevista</span><input id="draftOppDate" class="m-input" type="date" value="${esc(opp.expectedDate)}"></label><label class="m-field"><span>Importe (opcional)</span><input id="draftOppAmount" class="m-input" inputmode="decimal" value="${esc(opp.amount)}" placeholder="0,00"></label><label class="m-field"><span>Notas</span><textarea id="draftOppNotes" class="m-textarea">${esc(opp.notes)}</textarea></label><div class="m-toggle-row"><span><strong>Recordatorio</strong><small style="display:block;color:var(--m-muted);margin-top:3px">2 días antes del cierre</small></span><button id="draftOppReminder" class="m-toggle ${opp.reminder?'on':''}" data-action="toggle-reminder" type="button" aria-pressed="${opp.reminder}"></button></div></div><button class="m-primary" style="width:100%;margin-top:18px" data-action="continue-opportunity">Continuar</button><p id="mobileOpportunityMsg" class="m-form-msg"></p></div>`;
  }
  function captureDraftOpportunity(){
    state.draft.opportunity={...state.draft.opportunity,title:clean(byId('draftOppTitle').value),stageId:byId('draftOppStage').value,expectedDate:byId('draftOppDate').value,amount:clean(byId('draftOppAmount').value),notes:clean(byId('draftOppNotes').value),reminder:byId('draftOppReminder').classList.contains('on')};return state.draft.opportunity;
  }
  function continueOpportunity(){const opp=captureDraftOpportunity();if(!opp.title){byId('mobileOpportunityMsg').textContent='Escribe el nombre de la oportunidad.';return;}if(!opp.stageId){byId('mobileOpportunityMsg').textContent='Selecciona una columna.';return;}go('review');}
  function renderReview(){
    const contact=state.draft.contact,opp=state.draft.opportunity,fullName=[contact.first,contact.last].filter(Boolean).join(' '),stage=state.board.stages.find(row=>String(row.id)===String(opp.stageId));
    return `<div class="m-page">${pageHead('Confirmar creación','new-opportunity')}<div class="m-review-section"><h2>Contacto</h2><div class="m-review-card"><div class="m-review-person"><div class="m-avatar">${esc(initials({fullName}))}</div><div><strong>${esc(fullName)}</strong><div class="m-muted" style="font-size:.75rem;margin-top:4px">DNI / NIF: ${esc(contact.dni||'—')}<br>Teléfono: ${esc(contact.phone||'—')}</div></div></div></div></div><div class="m-review-section"><h2>Oportunidad</h2><div class="m-review-card"><div class="m-review-lines"><div class="m-review-line"><span>Nombre</span><b>${esc(opp.title)}</b></div><div class="m-review-line"><span>Estado</span><b>${esc(stage?.name||'—')}</b></div><div class="m-review-line"><span>Cierre previsto</span><b>${esc(opp.expectedDate?date(opp.expectedDate):'—')}</b></div><div class="m-review-line"><span>Importe</span><b>${esc(opp.amount?money(Number(opp.amount.replace(',','.'))):'—')}</b></div><div class="m-review-line"><span>Responsable</span><b>${esc(state.perms?.display_name||state.user?.email||'Usuario')}</b></div></div></div></div><button class="m-primary" style="width:100%" data-action="create-all">Confirmar y crear</button><button class="m-secondary" style="width:100%;margin-top:10px" data-action="route" data-route="detected">Editar datos</button></div>`;
  }
  function renderCreating(){
    const error=state.creationError;
    return `<div class="m-page"><div class="m-create-progress"><div><div class="m-create-visual"><div class="m-avatar">${esc(initials({fullName:[state.draft?.contact?.first,state.draft?.contact?.last].filter(Boolean).join(' ')}))}</div></div><h1>${error?'Falta terminar':'Creando…'}</h1><div class="m-step-list"><div id="createContactStep" class="m-step ${state.createdContactId?'done':'active'}"><i>${state.createdContactId?'✓':'1'}</i><span>Creando contacto</span></div><div id="createOpportunityStep" class="m-step ${state.createdOpportunityId?'done':state.createdContactId&&!error?'active':error?'error':''}"><i>${state.createdOpportunityId?'✓':'2'}</i><span>Creando oportunidad</span></div><div id="createSyncStep" class="m-step ${state.createdOpportunityId?'done':''}"><i>${state.createdOpportunityId?'✓':'3'}</i><span>Sincronizando con el CRM</span></div></div>${error?`<p class="m-form-msg" style="margin-top:18px">${esc(error)}</p><button class="m-primary" style="width:100%;margin-top:8px" data-action="retry-creation">Reintentar oportunidad</button>${state.createdContactId?`<button class="m-secondary" style="width:100%;margin-top:8px" data-action="route" data-route="contact/${esc(state.createdContactId)}">Ver contacto creado</button>`:''}`:''}</div></div></div>`;
  }
  function setCreationStep(id,status){const node=byId(id);if(!node)return;node.className=`m-step ${status}`;const icon=node.querySelector('i');icon.textContent=status==='done'?'✓':status==='error'?'!':'•';}
  async function performCreation(){
    if(state.creating)return;state.creating=true;state.creationError=null;go('creating');await new Promise(resolve=>setTimeout(resolve,80));
    const contact=state.draft.contact,opp=state.draft.opportunity,fullName=[contact.first,contact.last].filter(Boolean).join(' ');
    try{
      if(!state.createdContactId){
        setCreationStep('createContactStep','active');
        const data={'NOMBRE':contact.first,'APELLIDOS':contact.last,'NOMBRE Y APELLIDOS':fullName,'TELÉFONO':contact.phone,'DNI / NIF':contact.dni,'DNI':contact.dni,'EMAIL':contact.email,'BANCO':contact.bank,'NOTAS':contact.notes,'OBSERVACIONES':contact.observations};
        const result=await client.from('records').insert({source_sheet:CONTACT_SOURCE,data}).select('id').single();if(result.error)throw result.error;state.createdContactId=result.data.id;setCreationStep('createContactStep','done');
      }
      if(!state.createdOpportunityId){
        setCreationStep('createOpportunityStep','active');const stage=state.board.stages.find(row=>String(row.id)===String(opp.stageId));if(!stage)throw new Error('La columna seleccionada ya no existe.');
        const amount=opp.amount===''?null:Number(String(opp.amount).replace(',','.'));if(amount!==null&&!Number.isFinite(amount))throw new Error('El importe no es válido.');
        const result=await client.from('sales_opportunities').insert({pipeline_id:stage.pipeline_id,stage_id:stage.id,record_id:state.createdContactId,title:opp.title,client_name:fullName||null,phone:contact.phone||null,amount,expected_date:opp.expectedDate||null,owner_user_id:state.user.id,notes:opp.notes||null}).select('id').single();if(result.error)throw result.error;state.createdOpportunityId=result.data.id;setCreationStep('createOpportunityStep','done');
      }
      setCreationStep('createSyncStep','active');
      if(opp.reminder&&opp.expectedDate&&has('can_manage_agenda')){
        const remind=new Date(`${opp.expectedDate}T09:00:00`);remind.setDate(remind.getDate()-2);
        const task={title:`Seguimiento · ${opp.title}`,description:`Recordatorio previo al cierre de la oportunidad ${opp.title}`,customer_name:fullName||null,customer_phone:contact.phone||null,starts_at:remind.toISOString(),reminder_at:null,assigned_to:state.user.id,related_record_id:state.createdContactId,status:'pending',reminder_minutes:[],notify_in_app:true,notify_email:false,sync_google_calendar:false,whatsapp_enabled:false};
        const result=await client.from('agenda_items').insert(task);if(result.error)toast('Contacto y oportunidad creados; el recordatorio no pudo guardarse.','error');
      }
      await refreshData({silent:true});setCreationStep('createSyncStep','done');state.creating=false;setTimeout(()=>go('success'),280);
    }catch(error){
      state.creationError=state.createdContactId&&!state.createdOpportunityId?`El contacto está creado, pero falta la oportunidad: ${error?.message||'error desconocido'}`:(error?.message||'No se pudo completar la creación.');
      if(state.createdContactId){setCreationStep('createContactStep','done');await refreshData({silent:true});}
      setCreationStep(state.createdContactId?'createOpportunityStep':'createContactStep','error');state.creating=false;render();
    }
  }
  function renderSuccess(){
    return `<div class="m-page"><div class="m-success"><div class="m-success-check">✓</div><h1>Contacto y oportunidad creados</h1><p>Ya están vinculados y disponibles en el CRM del ordenador y en el móvil.</p><div class="m-success-actions"><button class="m-primary" data-action="route" data-route="contact/${esc(state.createdContactId||'')}">Ver contacto</button><button class="m-secondary" data-action="route" data-route="opportunity/${esc(state.createdOpportunityId||'')}">Ver oportunidad</button><button class="m-ghost" data-action="finish-flow">Ir al inicio</button></div></div></div>`;
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
    byId('mobileView').addEventListener('click',handleViewClick);
    addEventListener('hashchange',render);
    addEventListener('pageshow',()=>{if(state.user&&Date.now()-state.lastRefresh>30000)refreshData({silent:true}).then(render);});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.user&&Date.now()-state.lastRefresh>30000)refreshData({silent:true}).then(render);});
  }
  async function handleViewClick(event){
    const target=event.target.closest('[data-action]');if(!target)return;event.preventDefault();const action=target.dataset.action;
    if(action==='route')go(target.dataset.route);
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
    if(action==='create-all')performCreation();
    if(action==='retry-creation')performCreation();
    if(action==='finish-flow'){resetDraft();go('home');}
    if(action==='profile-tab'){state.profileTab=target.dataset.tab;render();}
    if(action==='save-contact')saveContact(target.dataset.id);
    if(action==='save-task')saveTask(target.dataset.contactId);
    if(action==='complete-task')completeTask(target.dataset.id);
    if(action==='refresh')refreshData();
    if(action==='logout')signOut();
    if(action==='open-desktop')location.href='/';
  }

  boot();
})();
