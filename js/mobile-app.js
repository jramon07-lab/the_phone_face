(function(){
  'use strict';

  // iOS home-screen apps may expose navigator.standalone without matching the media query.
  document.documentElement?.classList.toggle('m-installed',window.navigator?.standalone===true||window.matchMedia?.('(display-mode:standalone)')?.matches===true);

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
    loading:false,lastRefresh:0,profileTab:'summary',taskFilter:'all',alertFilter:'all',alertLimit:40,contactQuery:'',contactFilter:'all',contactLimit:60,opportunityQuery:'',opportunityFilter:'all',opportunityStage:'',scanFile:null,scanUrl:'',ocrDebugText:'',cameraError:'',cameraPaused:false,
    agenda:{date:'',rows:[],loading:false,loaded:false,error:'',requestId:0},
    draft:null,createdContactId:null,createdOpportunityId:null,creationError:null,creating:false,
    library:{templates:[],templatesLoaded:false,templatesLoading:false,templatesError:'',templateQuery:'',templateCategory:'',labels:[],labelCounts:{},labelCategories:{},labelsLoaded:false,labelsLoading:false,labelsError:'',labelQuery:'',labelCategory:'',contactQuery:'',contactLimit:60},
    whatsapp:{chats:[],messages:[],selectedId:'',query:'',filter:'all',limit:60,loaded:false,loadingChats:false,loadingHistory:false,historyLoadingId:'',historyRequestId:0,sending:false,sendingChatId:'',pendingFileChatId:'',readAt:{},listScroll:0,lastSync:0,providerState:'',error:'',historyError:'',templates:[],templateQuery:'',templateCategory:'',templatesLoading:false,templatesError:'',labels:[],labelIds:[],labelQuery:'',labelCategory:'',labelsLoading:false,labelsSaving:false,labelsError:''}
  };
  let profileLabels={contactId:'',loaded:false,loading:false,saving:false,error:'',labels:[],initial:[],selected:new Set()};
  const deletingProfileOpportunities=new Set();
  const savingMobileOpportunities=new Set();
  let taskDetail={id:'',row:null,loading:false,error:''};
  const taskWrites=new Set();
  let mobileWaRefreshTimer=null;
  let contactSearchTimer=null;
  let opportunitySearchTimer=null;
  let mobileWaSheetTrigger=null;
  let mobileCameraStream=null;
  let mobileCameraRequestId=0;
  let mobileCameraStarting=false;
  let mobileCameraCapturing=false;
  let mobileTemplateRequestId=0;
  let mobileLabelRequestId=0;

  const field=(data,...names)=>{
    for(const name of names){const value=data?.[name];if(value!==undefined&&value!==null&&clean(value)!=='')return value;}
    return '';
  };
  function splitFullName(value){
    const parts=clean(value).replace(/\s+/g,' ').split(' ').filter(Boolean);
    return {first:parts.shift()||'',last:parts.join(' ')};
  }
  function contactPhoneNumber(value){
    let number=String(value||'').trim().replace(/[^+0-9]/g,'');
    if(number.startsWith('00'))number='+'+number.slice(2);
    let raw=number.replace(/\D/g,'');
    if(!number.startsWith('+')&&raw.length===9)raw='34'+raw;
    return raw.length>=7&&raw.length<=15?raw:'';
  }
  function contactPhones(contact){
    const values=[contact?.phone],data=contact?.data||{};
    Object.entries(data).forEach(([key,value])=>{const name=key.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();if(/^(TELEFONOS?|PHONE|MOVIL)(?:[ _]?[0-9]+)?$/.test(name))values.push(value);});
    const seen=new Set(),result=[];
    values.flatMap(value=>Array.isArray(value)?value:String(value||'').split(/[;,\n|/]+/)).forEach(value=>{const number=contactPhoneNumber(value);if(number&&!seen.has(number)){seen.add(number);result.push({label:clean(value),number});}});
    return result;
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
  const ALERT_FILTERS=['all','overdue','today','upcoming','tasks','opportunities'];
  const ALERT_PAGE_SIZE=40;
  const MADRID_DATE_FORMATTER=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'});
  const CONTACT_FILTERS=['all','opportunities','tasks','untracked','incomplete'];
  const CONTACT_PAGE_SIZE=60;
  const OPPORTUNITY_FILTERS=['all','today','overdue','upcoming','month','closed'];
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
  const foldText=value=>clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const opportunityDateKey=opp=>{const value=clean(opp?.expected_date).slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(value)?value:'';};
  const opportunityStageLooksClosed=stage=>/(ganad|perdid|cerrad|cancelad|rechazad|finalizad|completad|won|lost|closed|completed)/.test(foldText(stage?.name||stage));
  function opportunityIsClosed(opp,stage=null){
    const status=foldText(opp?.status||'open');
    return ['won','lost','closed','completed','canceled','cancelled','rejected','ganada','ganado','perdida','perdido','cerrada','cerrado','completada','completado','cancelada','cancelado','rechazada','rechazado'].includes(status)||opportunityStageLooksClosed(stage);
  }
  function opportunityMatchesFilter(opp,filter='all',now=Date.now(),stage=null){
    const active=OPPORTUNITY_FILTERS.includes(filter)?filter:'all';
    if(active==='all')return true;
    const closed=opportunityIsClosed(opp,stage);
    if(active==='closed')return closed;
    if(closed)return false;
    const key=opportunityDateKey(opp),today=todayKey(now);
    if(active==='today')return key===today;
    if(active==='overdue')return !!key&&key<today;
    if(active==='upcoming')return !!key&&key>today;
    if(active==='month')return !!key&&key.slice(0,7)===today.slice(0,7);
    return true;
  }
  const filterOpportunities=(opportunities,filter='all',now=Date.now(),stages=null)=>(opportunities||[]).filter(opp=>opportunityMatchesFilter(opp,filter,now,stages?.get?.(String(opp?.stage_id))));
  function opportunityFilterCounts(opportunities,now=Date.now(),stages=null){
    const rows=opportunities||[];
    return {all:rows.length,today:filterOpportunities(rows,'today',now,stages).length,overdue:filterOpportunities(rows,'overdue',now,stages).length,upcoming:filterOpportunities(rows,'upcoming',now,stages).length,month:filterOpportunities(rows,'month',now,stages).length,closed:filterOpportunities(rows,'closed',now,stages).length};
  }
  function opportunityContactIndex(contacts=state.contacts){
    const byId=new Map(),byPhone=new Map(),byName=new Map();
    const addUnique=(map,key,contact)=>{if(!key)return;if(!map.has(key))map.set(key,contact);else map.set(key,null);};
    (contacts||[]).forEach(contact=>{
      if(contact?.id)byId.set(String(contact.id),contact);
      addUnique(byPhone,digits(contact?.phone).slice(-9),contact);
      addUnique(byName,foldText(contact?.fullName),contact);
    });
    return {byId,byPhone,byName};
  }
  function opportunityContact(opp,index=opportunityContactIndex()){
    const id=clean(opp?.record_id||opp?.contact_id);if(id&&index.byId.has(id))return index.byId.get(id);
    const phone=digits(opp?.phone).slice(-9);if(phone&&index.byPhone.get(phone))return index.byPhone.get(phone);
    const name=foldText(opp?.client_name);return name&&index.byName.get(name)||null;
  }
  function opportunityMatchesSearch(opp,query='',context={}){
    const term=foldText(query);if(!term)return true;
    const contact=opportunityContact(opp,context.contacts||opportunityContactIndex());
    const stage=context.stages?.get(String(opp?.stage_id));
    const hay=foldText([opp?.title,opp?.client_name,opp?.phone,opp?.notes,stage?.name,contact?.fullName,contact?.dni,...contactPhones(contact).map(p=>p.label),contact?.email].filter(Boolean).join(' '));
    const termDigits=digits(query),hayDigits=digits(hay);
    return hay.includes(term)||(termDigits.length>=3&&hayDigits.includes(termDigits));
  }
  function opportunityListModel(query=state.opportunityQuery,stageId=state.opportunityStage,filter=state.opportunityFilter,now=Date.now()){
    const context={contacts:opportunityContactIndex(),stages:new Map((state.board.stages||[]).map(stage=>[String(stage.id),stage]))};
    const base=(state.board.opportunities||[]).filter(opp=>(!stageId||String(opp.stage_id)===String(stageId))&&opportunityMatchesSearch(opp,query,context));
    const active=OPPORTUNITY_FILTERS.includes(filter)?filter:'all';
    const rows=filterOpportunities(base,active,now,context.stages).sort((a,b)=>String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||'')));
    return {context,base,rows,counts:opportunityFilterCounts(base,now,context.stages),active};
  }

  function toast(message,type=''){
    const node=byId('mobileToast');node.textContent=message;node.className=`m-toast ${type}`.trim();
    clearTimeout(toast.timer);toast.timer=setTimeout(()=>node.classList.add('hidden'),3600);
  }
  window.TPFMobileToast=toast;
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
      state.perms=data||{};window.TPFMobileSystem?.start(client,state.perms);showApp();
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
    contactHistory={id:'',rows:[],loading:false,error:'',limit:50};
    taskDetail={id:'',row:null,loading:false,error:''};
    profileLabels={contactId:'',loaded:false,loading:false,saving:false,error:'',labels:[],initial:[],selected:new Set()};
    stopMobileWaRefresh();stopGuidedCamera();mobileTemplateRequestId+=1;mobileLabelRequestId+=1;if(state.scanUrl)URL.revokeObjectURL(state.scanUrl);state.scanFile=null;state.scanUrl='';state.draft=null;
    clearTimeout(contactSearchTimer);clearTimeout(opportunitySearchTimer);closeMobileWaSheet(false);window.TPFMobileSystem?.stop();await client.auth.signOut();state.user=null;state.perms=null;state.contacts=[];state.tasks=[];state.board={stages:[],opportunities:[],fields:[]};state.agenda={date:'',rows:[],loading:false,loaded:false,error:'',requestId:0};state.alertFilter='all';state.alertLimit=ALERT_PAGE_SIZE;state.contactQuery='';state.contactFilter='all';state.contactLimit=CONTACT_PAGE_SIZE;state.opportunityQuery='';state.opportunityFilter='all';state.opportunityStage='';state.ocrDebugText='';state.cameraError='';state.cameraPaused=false;state.library={templates:[],templatesLoaded:false,templatesLoading:false,templatesError:'',templateQuery:'',templateCategory:'',labels:[],labelCounts:{},labelCategories:{},labelsLoaded:false,labelsLoading:false,labelsError:'',labelQuery:'',labelCategory:'',contactQuery:'',contactLimit:CONTACT_PAGE_SIZE};state.whatsapp={chats:[],messages:[],selectedId:'',query:'',filter:'all',limit:60,loaded:false,loadingChats:false,loadingHistory:false,historyLoadingId:'',historyRequestId:0,sending:false,sendingChatId:'',pendingFileChatId:'',readAt:{},listScroll:0,lastSync:0,providerState:'',error:'',historyError:'',templates:[],templateQuery:'',templateCategory:'',templatesLoading:false,templatesError:'',labels:[],labelIds:[],labelQuery:'',labelCategory:'',labelsLoading:false,labelsSaving:false,labelsError:''};location.hash='';showLogin();
  }

  async function fetchAllMobileContacts(){
    const rows=[],pageSize=1000;
    for(let from=0;;from+=pageSize){
      const {data,error}=await client.from('records')
        .select('id,source_sheet,source_row,data,created_at,updated_at')
        .eq('source_sheet',CONTACT_SOURCE)
        .order('updated_at',{ascending:false}).order('id',{ascending:true})
        .range(from,from+pageSize-1);
      if(error)return {data:null,error};
      const page=data||[];rows.push(...page);
      if(page.length<pageSize)return {data:rows,error:null};
    }
  }

  async function refreshData({silent=false}={}){
    if(!state.user||state.loading)return;
    state.loading=true;if(!silent)renderLoading();
    try{
      const jobs=[];
      jobs.push(has('can_view_database')
        ?fetchAllMobileContacts()
        :Promise.resolve({data:[],error:null}));
      jobs.push((has('can_view_sales')||has('can_edit_sales'))?client.rpc('sales_board'):Promise.resolve({data:{stages:[],opportunities:[],fields:[]},error:null}));
      jobs.push((has('can_view_agenda')||has('can_manage_agenda'))
        ?client.from('agenda_items').select('id,title,description,customer_name,customer_phone,starts_at,reminder_at,assigned_to,related_record_id,status,whatsapp_enabled,created_at').or('whatsapp_enabled.is.null,whatsapp_enabled.eq.false').order('starts_at',{ascending:true}).limit(1000)
        :Promise.resolve({data:[],error:null}));
      jobs.push((has('can_view_agenda')||has('can_manage_agenda'))?loadMobileTaskTypes():Promise.resolve());
      const [contacts,board,tasks]=await Promise.all(jobs);
      if(contacts.error)throw contacts.error;if(board.error)throw board.error;if(tasks.error)throw tasks.error;
      state.contacts=(contacts.data||[]).map(mapContact);
      state.board={stages:board.data?.stages||[],opportunities:board.data?.opportunities||[],fields:board.data?.fields||[]};
      state.tasks=tasks.data||[];state.agenda.loaded=false;state.lastRefresh=Date.now();updateAlertDot();
    }catch(error){toast(error?.message||'No se pudieron actualizar los datos.','error');}
    finally{state.loading=false;if(!silent)render();}
  }
  function renderLoading(){const view=byId('mobileView');if(view)view.innerHTML=`<div class="m-page">${skeleton()}</div>`;}
  function pendingTasks(){return state.tasks.filter(task=>taskIsPending(task));}
  function madridDateKey(value=Date.now()){
    const parsed=new Date(value);if(Number.isNaN(parsed.getTime()))return '';
    const parts=Object.fromEntries(MADRID_DATE_FORMATTER.formatToParts(parsed).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }
  function noticeItems(now=Date.now()){
    const today=madridDateKey(now),stages=new Map((state.board.stages||[]).map(stage=>[String(stage.id),stage])),items=[];
    pendingTasks().forEach(task=>{
      const dueAt=new Date(task?.starts_at||'').getTime(),dueKey=madridDateKey(task?.starts_at);if(!Number.isFinite(dueAt)||!dueKey)return;
      const category=dueAt<Number(now)?'overdue':dueKey===today?'today':'upcoming';
      items.push({key:`task:${task.id}`,type:'task',category,dueAt,row:task});
    });
    (state.board.opportunities||[]).forEach(opp=>{
      const stage=stages.get(String(opp?.stage_id)),dueKey=opportunityDateKey(opp);if(!dueKey||opportunityIsClosed(opp,stage))return;
      const category=dueKey<today?'overdue':dueKey===today?'today':'upcoming';
      items.push({key:`opportunity:${opp.id}`,type:'opportunity',category,dueAt:Date.parse(`${dueKey}T12:00:00Z`),row:opp,stage});
    });
    const priority={overdue:0,today:1,upcoming:2};
    return items.sort((a,b)=>priority[a.category]-priority[b.category]||a.dueAt-b.dueAt||String(a.key).localeCompare(String(b.key)));
  }
  function noticeMatchesFilter(item,filter='all'){
    const active=ALERT_FILTERS.includes(filter)?filter:'all';
    if(active==='tasks')return item?.type==='task';
    if(active==='opportunities')return item?.type==='opportunity';
    if(['overdue','today','upcoming'].includes(active))return item?.category===active;
    return true;
  }
  function noticeFilterCounts(items){
    const rows=items||[];
    return {all:rows.length,overdue:rows.filter(item=>item.category==='overdue').length,today:rows.filter(item=>item.category==='today').length,upcoming:rows.filter(item=>item.category==='upcoming').length,tasks:rows.filter(item=>item.type==='task').length,opportunities:rows.filter(item=>item.type==='opportunity').length};
  }
  function noticeListModel(filter=state.alertFilter,now=Date.now()){
    const items=noticeItems(now),active=ALERT_FILTERS.includes(filter)?filter:'all';
    return {items,rows:items.filter(item=>noticeMatchesFilter(item,active)),counts:noticeFilterCounts(items),active};
  }
  function noticeStats(now=Date.now(),model=null){
    const current=model||noticeListModel('all',now),counts=current.counts;
    return {...counts,expired:counts.overdue,pending:pendingTasks().length,soon:counts.upcoming,urgent:counts.overdue+counts.today};
  }
  function homeDashboardStats(now=Date.now()){
    const stages=new Map((state.board.stages||[]).map(stage=>[String(stage.id),stage])),opportunities=state.board.opportunities||[],month=filterOpportunities(opportunities,'month',now,stages);
    return {contacts:(state.contacts||[]).length,opportunities:opportunities.length,month:month.length,monthAmount:month.reduce((total,opp)=>{const amount=Number(opp?.amount);return total+(Number.isFinite(amount)?amount:0);},0),tasks:pendingTasks().length};
  }
  function updateAlertDot(){byId('mobileAlertDot')?.classList.toggle('hidden',noticeStats().urgent===0);}

  function render(){
    if(!state.user||byId('mobileApp').classList.contains('hidden'))return;
    const current=route();if(current.parts[0]!=='scan')stopGuidedCamera();setActiveNav(current.parts[0]);
    const view=byId('mobileView');
    try{
      switch(current.parts[0]){
        case 'home':view.innerHTML=renderHome();break;
        case 'contacts':view.innerHTML=renderContacts();bindContactFilters();break;
        case 'contact':view.innerHTML=renderContact(current.parts[1]);if(state.profileTab==='history')ensureContactHistory(current.parts[1]);break;
        case 'contact-text':view.innerHTML=renderContactText(current.parts[1],current.parts[2]);break;
        case 'edit-contact':view.innerHTML=renderEditContact(current.parts[1]);break;
        case 'contact-labels':view.innerHTML=renderProfileLabels(current.parts[1]);ensureProfileLabels(current.parts[1]);break;
        case 'opportunities':view.innerHTML=renderOpportunities();bindOpportunityFilters();break;
        case 'edit-opportunity':view.innerHTML=renderEditOpportunity(current.parts[1]);break;
        case 'opportunity':view.innerHTML=renderOpportunity(current.parts[1]);break;
        case 'task':view.innerHTML=renderTaskDetail(current.parts[1]);ensureTaskDetail(current.parts[1]);break;
        case 'tasks':view.innerHTML=renderTasks();break;
        case 'agenda':view.innerHTML=renderAgenda();bindAgendaDate();ensureAgendaDayLoaded(agendaSelectedDate());break;
        case 'new-task':view.innerHTML=renderNewTask(current.parts[1]);break;
        case 'new-contact-opportunity':view.innerHTML=renderContactOpportunity(current.parts[1]);break;
        case 'choose-contact':view.innerHTML=renderContactChooser(current.parts[1]);bindContactChooser();break;
        case 'assign-label':view.innerHTML=renderContactChooser('label',current.parts[1]);bindContactChooser();ensureMobileLabelsLoaded();break;
        case 'templates':view.innerHTML=renderMobileTemplateLibrary();bindMobileLibraryFilters();ensureMobileTemplatesLoaded();break;
        case 'template-edit':view.innerHTML=renderMobileTemplateEditor(current.parts[1]);ensureMobileTemplatesLoaded();break;
        case 'labels':view.innerHTML=renderMobileLabelLibrary();bindMobileLibraryFilters();ensureMobileLabelsLoaded();break;
        case 'label-edit':view.innerHTML=renderMobileLabelEditor(current.parts[1]);ensureMobileLabelsLoaded();break;
        case 'whatsapp':view.innerHTML=renderMobileWhatsApp();initMobileWhatsAppList();break;
        case 'whatsapp-chat':view.innerHTML=renderMobileWhatsAppChat(safeDecode(current.parts[1]));initMobileWhatsAppChat(safeDecode(current.parts[1]));break;
        case 'alerts':view.innerHTML=renderAlerts();break;
        case 'scan':stopGuidedCamera();view.innerHTML=renderScan();initGuidedCamera();break;
        case 'detected':ensureDraft();view.innerHTML=renderDetected();break;
        case 'new-opportunity':ensureDraft();view.innerHTML=renderOpportunityForm();break;
        case 'review':ensureDraft();view.innerHTML=renderReview();break;
        case 'creating':view.innerHTML=renderCreating();break;
        case 'success':view.innerHTML=renderSuccess();break;
        case 'screen-check':view.innerHTML=renderScreenCheck();break;
        case 'more':view.innerHTML=renderMore();break;
        case 'system':if(!state.perms?.is_admin){go('more',true);break}view.innerHTML=window.TPFMobileSystem?.render?.()||empty('Estado no disponible','Recarga la aplicación.');window.TPFMobileSystem?.refresh();break;
        default:view.innerHTML=renderHome();
      }
      updateMobileWhatsAppNav();
      if(!['whatsapp','whatsapp-chat'].includes(current.parts[0]))stopMobileWaRefresh();
      view.scrollTop=current.parts[0]==='whatsapp'?Number(state.whatsapp.listScroll||0):0;
    }catch(error){window.TPFMobileSystem?.report?.({type:'JavaScript',module:'Interfaz móvil',message:'No se pudo abrir una pantalla',detail:error?.message||''});view.innerHTML=`<div class="m-page">${pageHead('CRM móvil')} ${empty('No se pudo abrir esta pantalla',error?.message||'Vuelve a intentarlo.')}</div>`;}
  }
  window.TPFMobileRerender=render;
  function setActiveNav(name){
    const quickOrigin=route().query.get('origin')==='quick',group=['contact','edit-contact','contact-labels'].includes(name)?'contacts':['opportunity','edit-opportunity'].includes(name)||(name==='new-contact-opportunity'&&!quickOrigin)?'opportunities':name==='new-task'?(quickOrigin?'add':''):['scan','detected','new-opportunity','new-contact-opportunity','choose-contact','assign-label','templates','template-edit','labels','label-edit','review','creating','success'].includes(name)?'add':['whatsapp','whatsapp-chat'].includes(name)?'whatsapp':name==='system'?'more':name;
    document.querySelectorAll('[data-mobile-route]').forEach(button=>button.classList.toggle('active',button.dataset.mobileRoute===group));
    byId('mobileAdd').classList.toggle('active',group==='add');
    byId('mobileMenu').setAttribute('aria-current',group==='more'?'page':'false');
  }
  function updateMobileWhatsAppNav(){
    const button=byId('mobileNavWhatsApp'),badge=byId('mobileNavWhatsAppBadge');
    if(!button||!badge)return;
    const unread=has('can_use_whatsapp')&&state.whatsapp.loaded
      ?state.whatsapp.chats.filter(chat=>mobileWaUnread(chat)>0).length:0;
    badge.textContent=unread>99?'99+':String(unread);
    badge.classList.toggle('hidden',unread===0);
    button.setAttribute('aria-label',unread?`WhatsApp, ${unread} conversaciones no leídas`:'WhatsApp');
  }

  function homePriorityRow(item){
    const row=item.row,isTask=item.type==='task',contact=isTask&&state.contacts.find(value=>String(value.id)===String(row.related_record_id));
    const action=isTask?(contact?`data-action="route" data-route="contact/${esc(contact.id)}"`:'data-action="open-tasks" data-filter="pending"'):`data-action="route" data-route="opportunity/${esc(row.id)}"`;
    const title=isTask?(row.title||'Tarea'):(row.title||'Oportunidad'),detail=isTask?`${row.customer_name||contact?.fullName||'Sin contacto'} · ${dateTime(row.starts_at)}`:`${row.client_name||'Sin contacto'} · ${opportunityDateLabel(row)}`;
    const label=item.category==='overdue'?'Vencido':item.category==='today'?'Hoy':'Próximo';
    return `<button class="m-home-priority-row" ${action} type="button"><span class="m-home-priority-icon">${isTask?'▣':'◇'}</span><span class="m-home-priority-main"><strong>${esc(title)}</strong><small>${esc(detail)}</small></span><span class="m-home-priority-badge ${item.category}">${label}</span></button>`;
  }
  function renderHome(){
    const now=Date.now(),notices=noticeListModel('all',now),stats=noticeStats(now,notices),dashboard=homeDashboardStats(now);const name=clean(state.perms?.display_name||state.user?.email?.split('@')[0]||'Ramón').split(' ')[0];
    const updated=state.lastRefresh?new Date(state.lastRefresh).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}):'—';
    const urgent=notices.items.filter(item=>item.category!=='upcoming').slice(0,3);
    return `<div class="m-page m-home-page">
      <div class="m-home-welcome"><div><h1 class="m-greeting">Hola, ${esc(name)}</h1><p class="m-subtitle">Actualizado a las ${esc(updated)}</p></div><button class="m-home-refresh" data-action="refresh" type="button" aria-label="Actualizar datos">↻</button></div>
      <h2 class="m-section-title m-home-section-title">Resumen</h2><div class="m-home-metrics">
        <button class="m-home-metric" data-action="route" data-route="contacts" type="button"><span>Contactos</span><b>${dashboard.contacts}</b><small>registrados</small><i>♙</i></button>
        <button class="m-home-metric" data-action="route" data-route="opportunities" type="button"><span>Oportunidades</span><b>${dashboard.opportunities}</b><small>en el CRM</small><i>◇</i></button>
        <button class="m-home-metric purple" data-action="open-opportunities" data-filter="month" type="button"><span>Este mes</span><b>${dashboard.month}</b><small>${esc(money(dashboard.monthAmount))}</small><i>◎</i></button>
        <button class="m-home-metric green" data-action="open-tasks" data-filter="pending" type="button"><span>Tareas pendientes</span><b>${dashboard.tasks}</b><small>sin completar</small><i>▣</i></button>
      </div>
      <section class="m-home-alerts"><div class="m-home-card-head"><div><h2>Centro de avisos</h2><p><b>${stats.urgent}</b> ${stats.urgent===1?'requiere':'requieren'} atención</p></div><button data-action="open-alerts" data-filter="all" type="button">Ver todos ›</button></div><div class="m-home-alert-filters">
        <button data-action="open-alerts" data-filter="overdue" type="button"><span>Vencidos</span><b>${stats.overdue}</b></button><button data-action="open-alerts" data-filter="today" type="button"><span>Hoy</span><b>${stats.today}</b></button><button data-action="open-alerts" data-filter="upcoming" type="button"><span>Próximos</span><b>${stats.upcoming}</b></button>
      </div><div class="m-home-priority">${urgent.length?urgent.map(homePriorityRow).join(''):'<p class="m-home-clear">✓ No tienes avisos urgentes.</p>'}</div></section>
      <h2 class="m-section-title">Accesos rápidos</h2>
      <div class="m-quick-grid">
        <button class="m-quick" data-action="route" data-route="contacts"><span>♙</span><small>Contactos</small></button>
        <button class="m-quick" data-action="route" data-route="opportunities"><span>◇</span><small>Oportunidades</small></button>
        <button class="m-quick" data-action="route" data-route="tasks"><span>▣</span><small>Tareas</small></button>
        <button class="m-quick" data-action="route" data-route="agenda"><span>◷</span><small>Agenda</small></button>
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

  function contactActivityIndex(){
    const rows=new Map(),stages=new Map((state.board.stages||[]).map(stage=>[String(stage.id),stage]));
    const activity=id=>{const key=String(id||'');if(!key)return null;if(!rows.has(key))rows.set(key,{opportunities:0,pendingTasks:0});return rows.get(key);};
    (state.board.opportunities||[]).forEach(opp=>{const item=activity(opp?.record_id||opp?.contact_id);if(item&&!opportunityIsClosed(opp,stages.get(String(opp?.stage_id))))item.opportunities+=1;});
    (state.tasks||[]).forEach(task=>{const item=activity(task?.related_record_id);if(item&&taskIsPending(task))item.pendingTasks+=1;});
    return rows;
  }
  function contactMatchesSearch(contact,query=''){
    const term=foldText(query);if(!term)return true;
    const termDigits=digits(query),text=foldText([contact?.fullName,contact?.dni,contact?.phone,contact?.email,window.TPFContactParty.search(contact)].filter(Boolean).join(' '));
    const numericMatch=termDigits.length>=3&&[contact?.dni,contact?.data?.TPF_TITULAR?.holder_dni,contact?.data?.TPF_TITULAR?.holder_phone,...contactPhones(contact).map(p=>p.number)].some(value=>digits(value).includes(termDigits));
    return text.includes(term)||numericMatch;
  }
  function contactMatchesFilter(contact,filter='all',activity=new Map()){
    const active=CONTACT_FILTERS.includes(filter)?filter:'all',stats=activity.get(String(contact?.id))||{opportunities:0,pendingTasks:0};
    if(active==='opportunities')return stats.opportunities>0;
    if(active==='tasks')return stats.pendingTasks>0;
    if(active==='untracked')return stats.opportunities===0&&stats.pendingTasks===0;
    if(active==='incomplete')return !clean(contact?.phone)||!clean(contact?.dni);
    return true;
  }
  function contactFilterCounts(contacts,activity){
    const rows=contacts||[];
    return {all:rows.length,opportunities:rows.filter(contact=>contactMatchesFilter(contact,'opportunities',activity)).length,tasks:rows.filter(contact=>contactMatchesFilter(contact,'tasks',activity)).length,untracked:rows.filter(contact=>contactMatchesFilter(contact,'untracked',activity)).length,incomplete:rows.filter(contact=>contactMatchesFilter(contact,'incomplete',activity)).length};
  }
  function contactListModel(query=state.contactQuery,filter=state.contactFilter){
    const activity=contactActivityIndex(),base=(state.contacts||[]).filter(contact=>contactMatchesSearch(contact,query));
    const active=CONTACT_FILTERS.includes(filter)?filter:'all',rows=base.filter(contact=>contactMatchesFilter(contact,active,activity));
    return {activity,base,rows,counts:contactFilterCounts(base,activity),active};
  }
  function contactCard(contact,activity=new Map()){
    const stats=activity.get(String(contact.id))||{opportunities:0,pendingTasks:0};
    return `<button class="m-list-card m-contact-card" data-action="route" data-route="contact/${esc(contact.id)}" type="button"><span class="m-list-row"><span class="m-avatar">${esc(initials(contact))}</span><span class="m-list-main"><strong>${esc(contact.fullName)}</strong>${contact.email?`<small>${esc(contact.email)}</small>`:'<small>Sin correo electrónico</small>'}</span><span class="m-chevron" aria-hidden="true">›</span></span><span class="m-contact-meta"><span><small>Teléfono</small><b>${esc(contact.phone||'—')}</b></span><span><small>DNI / NIF</small><b>${esc(contact.dni||'—')}</b></span></span><span class="m-contact-activity"><span>◇ ${stats.opportunities} ${stats.opportunities===1?'venta abierta':'ventas abiertas'}</span><span>▣ ${stats.pendingTasks} ${stats.pendingTasks===1?'tarea pendiente':'tareas pendientes'}</span></span></button>`;
  }
  function renderContactFilters(counts,active=state.contactFilter){
    const options=[['all','Todos'],['opportunities','Con ventas'],['tasks','Con tareas'],['untracked','Sin seguimiento'],['incomplete','Incompletos']];
    return options.map(([key,label])=>`<button class="m-contact-filter ${active===key?'active':''}" data-action="contact-filter" data-filter="${key}" type="button" aria-pressed="${active===key}"><span>${label}</span><b>${counts[key]||0}</b></button>`).join('');
  }
  function contactRowsHtml(model){
    const shown=model.rows.slice(0,Math.max(CONTACT_PAGE_SIZE,state.contactLimit||CONTACT_PAGE_SIZE));
    if(shown.length)return `<div class="m-list">${shown.map(contact=>contactCard(contact,model.activity)).join('')}</div>${shown.length<model.rows.length?`<button class="m-secondary m-contact-more" data-action="contact-more" type="button">Mostrar ${Math.min(CONTACT_PAGE_SIZE,model.rows.length-shown.length)} más</button>`:''}`;
    if(!(state.contacts||[]).length)return empty('No hay contactos','Crea el primero desde el botón +.');
    if(!model.base.length)return empty('Sin resultados','Prueba con otro nombre, DNI, teléfono o correo.');
    return empty('Sin contactos en este filtro','Prueba con otro filtro.');
  }
  function contactResultText(model){
    const shown=Math.min(model.rows.length,Math.max(CONTACT_PAGE_SIZE,state.contactLimit||CONTACT_PAGE_SIZE));
    return shown<model.rows.length?`Mostrando ${shown} de ${model.rows.length} contactos`:`${model.rows.length} ${model.rows.length===1?'contacto':'contactos'}`;
  }
  function renderContacts(){
    if(!has('can_view_database'))return `<div class="m-page">${pageHead('Contactos')}${empty('Acceso restringido','No tienes permiso para ver contactos.')}</div>`;
    const model=contactListModel();
    return `<div class="m-page m-contacts-page">${pageHead('Contactos','home','<button class="m-back" data-action="manual-contact" aria-label="Nuevo contacto">＋</button>')}<div class="m-search m-contact-search"><input id="mobileContactSearch" class="m-input" type="search" value="${esc(state.contactQuery)}" placeholder="Nombre, DNI, teléfono o correo" autocomplete="off" aria-label="Buscar contactos"></div><div id="mobileContactFilters" class="m-contact-filters" role="group" aria-label="Filtrar contactos">${renderContactFilters(model.counts,model.active)}</div><p id="mobileContactResultCount" class="m-contact-result-count" aria-live="polite" aria-atomic="true">${contactResultText(model)}</p><div id="mobileContactsList">${contactRowsHtml(model)}</div></div>`;
  }
  function updateContactResults(){
    const model=contactListModel(),filters=byId('mobileContactFilters'),count=byId('mobileContactResultCount'),list=byId('mobileContactsList');
    if(filters)filters.innerHTML=renderContactFilters(model.counts,model.active);
    if(count)count.textContent=contactResultText(model);
    if(list)list.innerHTML=contactRowsHtml(model);
  }
  function bindContactFilters(){
    const input=byId('mobileContactSearch');if(!input)return;
    input.oninput=()=>{state.contactQuery=input.value;state.contactLimit=CONTACT_PAGE_SIZE;clearTimeout(contactSearchTimer);contactSearchTimer=setTimeout(updateContactResults,120);};
  }

  function mobileTemplateCategory(template){return clean(template?.category)||'Sin categoría';}
  function mobileTemplateCategories(){return [...new Set(state.library.templates.map(mobileTemplateCategory))].sort((a,b)=>a.localeCompare(b,'es'));}
  function mobileFilteredTemplates(){const query=state.library.templateQuery,category=state.library.templateCategory;return state.library.templates.filter(template=>(!category||mobileTemplateCategory(template)===category)&&mobileWaMatchesFilter([template.name,template.text,template.shortcut,mobileTemplateCategory(template)],query));}
  function mobileTemplateById(id){return state.library.templates.find(template=>String(template.id)===String(id));}
  function renderMobileTemplateFilters(){return `<div class="m-library-filters"><label class="m-field"><span>Buscar</span><input id="mobileTemplateSearch" class="m-input" type="search" value="${esc(state.library.templateQuery)}" placeholder="Nombre, contenido o atajo" autocomplete="off"></label><label class="m-field"><span>Categoría</span><select id="mobileTemplateCategory" class="m-select"><option value="">Todas las categorías</option>${mobileTemplateCategories().map(category=>`<option value="${esc(category)}"${state.library.templateCategory===category?' selected':''}>${esc(category)}</option>`).join('')}</select></label></div>`;}
  function renderMobileTemplateRows(){
    const rows=mobileFilteredTemplates();
    if(state.library.templatesLoading&&!state.library.templatesLoaded)return skeleton();
    if(state.library.templatesError&&!state.library.templates.length)return `<div class="m-duplicate warn">${esc(state.library.templatesError)}</div><button class="m-secondary m-library-full" data-action="reload-templates" type="button">Reintentar</button>`;
    if(!rows.length)return empty(state.library.templates.length?'Sin resultados':'Todavía no hay plantillas',state.library.templates.length?'Prueba con otra búsqueda o categoría.':'Crea la primera plantilla desde el botón +.');
    return `<div class="m-library-list">${rows.map(template=>`<article class="m-library-card"><div class="m-library-card-head"><span class="m-library-badge">${esc(mobileTemplateCategory(template))}</span>${template.shortcut?`<small>${esc(template.shortcut)}</small>`:''}</div><h2>${esc(template.name||'Plantilla')}</h2><p>${esc(template.text||'')}</p><div class="m-library-actions"><button class="m-secondary" data-action="copy-template" data-id="${esc(template.id)}" type="button">Copiar</button><button class="m-secondary" data-action="edit-template" data-id="${esc(template.id)}" type="button">Editar</button><button class="m-danger" data-action="delete-template" data-id="${esc(template.id)}" type="button">Eliminar</button></div></article>`).join('')}</div>`;
  }
  function renderMobileTemplateLibrary(){
    if(!has('can_manage_templates'))return `<div class="m-page">${pageHead('Plantillas')}${empty('Acceso restringido','No tienes permiso para gestionar plantillas.')}</div>`;
    const count=mobileFilteredTemplates().length;
    return `<div class="m-page m-library-page">${pageHead('Plantillas','home','<button class="m-back" data-action="new-template" type="button" aria-label="Nueva plantilla">＋</button>')}<p class="m-subtitle m-library-subtitle">Biblioteca de WhatsApp sincronizada con el CRM.</p>${renderMobileTemplateFilters()}<p id="mobileTemplateResultCount" class="m-library-count" aria-live="polite">${count} ${count===1?'plantilla':'plantillas'}</p><div id="mobileTemplateResults">${renderMobileTemplateRows()}</div></div>`;
  }
  function updateMobileTemplateResults(){const count=mobileFilteredTemplates().length,countNode=byId('mobileTemplateResultCount'),list=byId('mobileTemplateResults');if(countNode)countNode.textContent=`${count} ${count===1?'plantilla':'plantillas'}`;if(list)list.innerHTML=renderMobileTemplateRows();}
  async function loadMobileTemplates(force=false){
    if(!has('can_manage_templates')||state.library.templatesLoading||(!force&&state.library.templatesLoaded))return;
    const requestId=++mobileTemplateRequestId;state.library.templatesLoading=true;state.library.templatesError='';
    try{const {data,error}=await client.rpc('wa_list_templates');if(requestId!==mobileTemplateRequestId)return;if(error)throw error;state.library.templates=Array.isArray(data)?data.map(row=>({id:row.id,name:clean(row.name)||'Plantilla',text:String(row.body||''),category:clean(row.category),shortcut:clean(row.shortcut)})):[];if(state.library.templateCategory&&!mobileTemplateCategories().includes(state.library.templateCategory))state.library.templateCategory='';state.library.templatesLoaded=true;}
    catch(error){if(requestId!==mobileTemplateRequestId)return;state.library.templatesError=error?.message||'No se pudieron cargar las plantillas.';state.library.templatesLoaded=true;}
    finally{if(requestId===mobileTemplateRequestId){state.library.templatesLoading=false;if(['templates','template-edit'].includes(route().parts[0]))render();}}
  }
  function ensureMobileTemplatesLoaded(){if(!state.library.templatesLoaded&&!state.library.templatesLoading)loadMobileTemplates();}
  function renderMobileTemplateEditor(id='new'){
    if(!has('can_manage_templates'))return `<div class="m-page">${pageHead('Plantilla','templates')}${empty('Acceso restringido','No tienes permiso para gestionar plantillas.')}</div>`;
    if(!state.library.templatesLoaded)return `<div class="m-page">${pageHead('Plantilla','templates')}${skeleton()}</div>`;
    const isNew=!id||id==='new',template=isNew?null:mobileTemplateById(id);if(!isNew&&!template)return `<div class="m-page">${pageHead('Plantilla no encontrada','templates')}${empty('No disponible','Actualiza la biblioteca y vuelve a intentarlo.')}</div>`;
    return `<div class="m-page m-library-editor">${pageHead(isNew?'Nueva plantilla':'Editar plantilla','templates')}<div class="m-form-grid"><label class="m-field"><span>Nombre</span><input id="mobileTemplateName" class="m-input" value="${esc(template?.name||'')}" placeholder="Ej.: Confirmación de cita"></label><label class="m-field"><span>Categoría</span><input id="mobileTemplateEditCategory" class="m-input" value="${esc(template?.category||'')}" placeholder="Ej.: Atención"></label><label class="m-field"><span>Atajo (opcional)</span><input id="mobileTemplateShortcut" class="m-input" value="${esc(template?.shortcut||'')}" placeholder="Ej.: /cita"></label><div class="m-library-vars"><strong>Insertar dato del contacto</strong><div><button class="m-secondary" data-action="insert-template-variable" data-token="{nombre}" type="button">Nombre</button><button class="m-secondary" data-action="insert-template-variable" data-token="{nombre_completo}" type="button">Nombre completo</button><button class="m-secondary" data-action="insert-template-variable" data-token="{dni}" type="button">DNI / NIF</button><button class="m-secondary" data-action="insert-template-variable" data-token="{telefono}" type="button">Teléfono</button></div></div><label class="m-field"><span>Contenido</span><textarea id="mobileTemplateBody" class="m-textarea m-library-body" placeholder="Escribe el mensaje…">${esc(template?.text||'')}</textarea></label></div><button class="m-primary m-library-full" data-action="save-template" data-id="${esc(template?.id||'')}" type="button">${isNew?'Guardar plantilla':'Guardar cambios'}</button><p id="mobileTemplateMsg" class="m-form-msg"></p></div>`;
  }
  function insertMobileTemplateVariable(token){const input=byId('mobileTemplateBody');if(!input)return;const start=Number.isFinite(input.selectionStart)?input.selectionStart:input.value.length,end=Number.isFinite(input.selectionEnd)?input.selectionEnd:start;input.setRangeText(String(token||''),start,end,'end');input.focus();}
  async function saveMobileTemplate(id=''){
    const msg=byId('mobileTemplateMsg');if(!has('can_manage_templates')){if(msg)msg.textContent='No tienes permiso para guardar plantillas.';return;}
    const name=clean(byId('mobileTemplateName')?.value),body=clean(byId('mobileTemplateBody')?.value),category=clean(byId('mobileTemplateEditCategory')?.value),shortcut=clean(byId('mobileTemplateShortcut')?.value),current=id?mobileTemplateById(id):null;
    if(!name||!body){if(msg)msg.textContent='Escribe el nombre y el contenido.';return;}
    const button=document.querySelector('[data-action="save-template"]');if(button)button.disabled=true;if(msg)msg.textContent='Guardando…';
    try{const returnToLibrary=route().query.get('from')==='templates'&&history.length>1,{error}=await client.rpc('wa_upsert_template',{p_id:current?.id||null,p_name:name,p_body:body,p_category:category||null,p_shortcut:shortcut||null});if(error)throw error;state.library.templatesLoaded=false;await loadMobileTemplates(true);if(returnToLibrary)history.back();else go('templates',true);toast('Plantilla guardada y sincronizada.','success');}
    catch(error){if(msg)msg.textContent=error?.message||'No se pudo guardar la plantilla.';}
    finally{if(button)button.disabled=false;}
  }
  async function deleteMobileTemplate(id){const template=mobileTemplateById(id);if(!template||!has('can_manage_templates')||!confirm(`¿Eliminar la plantilla "${template.name}"?`))return;try{const {error}=await client.rpc('wa_delete_template',{p_id:template.id});if(error)throw error;state.library.templates=state.library.templates.filter(row=>String(row.id)!==String(id));if(state.library.templateCategory&&!mobileTemplateCategories().includes(state.library.templateCategory))state.library.templateCategory='';render();toast('Plantilla eliminada.','success');}catch(error){toast(error?.message||'No se pudo eliminar la plantilla.','error');}}
  async function copyMobileTemplate(id){const template=mobileTemplateById(id);if(!template)return;try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(template.text);else{const input=document.createElement('textarea');input.value=template.text;input.className='m-visually-hidden';document.body.appendChild(input);input.select();if(!document.execCommand('copy'))throw new Error('No se pudo copiar.');input.remove();}toast('Plantilla copiada.','success');}catch(_){toast('No se pudo copiar la plantilla.','error');}}

  function mobileLabelCategory(label){return clean(state.library.labelCategories[String(label?.id)])||clean(label?.category)||mobileWaInferLabelCategory(label?.name);}
  function mobileLabelCategories(){return [...new Set(state.library.labels.map(mobileLabelCategory))].sort((a,b)=>a.localeCompare(b,'es'));}
  function mobileFilteredLabels(){const query=state.library.labelQuery,category=state.library.labelCategory;return state.library.labels.filter(label=>(!category||mobileLabelCategory(label)===category)&&mobileWaMatchesFilter([label.name,mobileLabelCategory(label)],query));}
  function mobileLabelById(id){return state.library.labels.find(label=>String(label.id)===String(id));}
  function renderMobileLabelFilters(){return `<div class="m-library-filters"><label class="m-field"><span>Buscar</span><input id="mobileLabelSearch" class="m-input" type="search" value="${esc(state.library.labelQuery)}" placeholder="Nombre de etiqueta" autocomplete="off"></label><label class="m-field"><span>Categoría</span><select id="mobileLabelCategory" class="m-select"><option value="">Todas las categorías</option>${mobileLabelCategories().map(category=>`<option value="${esc(category)}"${state.library.labelCategory===category?' selected':''}>${esc(category)}</option>`).join('')}</select></label></div>`;}
  function renderMobileLabelRows(){
    const rows=mobileFilteredLabels();
    if(state.library.labelsLoading&&!state.library.labelsLoaded)return skeleton();
    if(state.library.labelsError&&!state.library.labels.length)return `<div class="m-duplicate warn">${esc(state.library.labelsError)}</div><button class="m-secondary m-library-full" data-action="reload-labels" type="button">Reintentar</button>`;
    if(!rows.length)return empty(state.library.labels.length?'Sin resultados':'Todavía no hay etiquetas',state.library.labels.length?'Prueba con otra búsqueda o categoría.':'Crea la primera etiqueta desde el botón +.');
    return `<div class="m-library-list">${rows.map(label=>{const count=Number(state.library.labelCounts[String(label.id)]||0);return `<article class="m-library-card m-label-card"><div class="m-library-card-head"><span class="m-library-badge">${esc(mobileLabelCategory(label))}</span><small>${count} ${count===1?'contacto':'contactos'}</small></div><h2>${esc(label.name||'Etiqueta')}</h2><div class="m-library-actions"><button class="m-primary" data-action="assign-label" data-id="${esc(label.id)}" type="button"${has('can_view_database')&&state.contacts.length?'':' disabled'}>Asignar</button><button class="m-secondary" data-action="edit-label" data-id="${esc(label.id)}" type="button">Editar</button><button class="m-danger" data-action="delete-label" data-id="${esc(label.id)}" type="button">Eliminar</button></div></article>`;}).join('')}</div>`;
  }
  function renderMobileLabelLibrary(){
    if(!has('can_manage_labels'))return `<div class="m-page">${pageHead('Etiquetas')}${empty('Acceso restringido','No tienes permiso para gestionar etiquetas.')}</div>`;
    const count=mobileFilteredLabels().length;
    return `<div class="m-page m-library-page">${pageHead('Etiquetas','home','<button class="m-back" data-action="new-label" type="button" aria-label="Nueva etiqueta">＋</button>')}<p class="m-subtitle m-library-subtitle">Organiza y asigna etiquetas sin salir de la aplicación.</p>${renderMobileLabelFilters()}<p id="mobileLabelResultCount" class="m-library-count" aria-live="polite">${count} ${count===1?'etiqueta':'etiquetas'}</p><div id="mobileLabelResults">${renderMobileLabelRows()}</div></div>`;
  }
  function updateMobileLabelResults(){const count=mobileFilteredLabels().length,countNode=byId('mobileLabelResultCount'),list=byId('mobileLabelResults');if(countNode)countNode.textContent=`${count} ${count===1?'etiqueta':'etiquetas'}`;if(list)list.innerHTML=renderMobileLabelRows();}
  async function loadMobileLabels(force=false){
    if(!has('can_manage_labels')||state.library.labelsLoading||(!force&&state.library.labelsLoaded))return;
    const requestId=++mobileLabelRequestId;state.library.labelsLoading=true;state.library.labelsError='';
    try{const [labels,counts,categories]=await Promise.all([client.rpc('crm_list_labels'),client.from('crm_contact_labels').select('label_id'),loadMobileWaLabelCategories()]);if(requestId!==mobileLabelRequestId)return;if(labels.error)throw labels.error;state.library.labels=Array.isArray(labels.data)?labels.data.map(row=>({id:row.id,name:clean(row.name)||'Etiqueta',category:clean(row.category)})):[];state.library.labelCounts={};if(!counts.error)(counts.data||[]).forEach(row=>{const id=String(row.label_id||'');if(id)state.library.labelCounts[id]=(state.library.labelCounts[id]||0)+1;});state.library.labelCategories=categories||{};if(state.library.labelCategory&&!mobileLabelCategories().includes(state.library.labelCategory))state.library.labelCategory='';state.library.labelsLoaded=true;}
    catch(error){if(requestId!==mobileLabelRequestId)return;state.library.labelsError=error?.message||'No se pudieron cargar las etiquetas.';state.library.labelsLoaded=true;}
    finally{if(requestId===mobileLabelRequestId){state.library.labelsLoading=false;if(['labels','label-edit','assign-label'].includes(route().parts[0]))render();}}
  }
  function ensureMobileLabelsLoaded(){if(!state.library.labelsLoaded&&!state.library.labelsLoading)loadMobileLabels();}
  function renderMobileLabelEditor(id='new'){
    if(!has('can_manage_labels'))return `<div class="m-page">${pageHead('Etiqueta','labels')}${empty('Acceso restringido','No tienes permiso para gestionar etiquetas.')}</div>`;
    if(!state.library.labelsLoaded)return `<div class="m-page">${pageHead('Etiqueta','labels')}${skeleton()}</div>`;
    const isNew=!id||id==='new',label=isNew?null:mobileLabelById(id);if(!isNew&&!label)return `<div class="m-page">${pageHead('Etiqueta no encontrada','labels')}${empty('No disponible','Actualiza las etiquetas y vuelve a intentarlo.')}</div>`;
    const categories=['Vodafone','Orange','MásMóvil','Yoigo','Otras',...mobileLabelCategories()].filter((value,index,list)=>list.indexOf(value)===index);
    return `<div class="m-page m-library-editor">${pageHead(isNew?'Nueva etiqueta':'Editar etiqueta','labels')}<div class="m-form-grid"><label class="m-field"><span>Nombre</span><input id="mobileLabelName" class="m-input" value="${esc(label?.name||'')}" placeholder="Ej.: Renovación, VIP"></label><label class="m-field"><span>Categoría</span><input id="mobileLabelEditCategory" class="m-input" list="mobileLabelCategoryList" value="${esc(label?mobileLabelCategory(label):'')}" placeholder="Ej.: Vodafone"><datalist id="mobileLabelCategoryList">${categories.map(category=>`<option value="${esc(category)}"></option>`).join('')}</datalist></label></div><button class="m-primary m-library-full" data-action="save-label" data-id="${esc(label?.id||'')}" type="button">${isNew?'Crear etiqueta':'Guardar cambios'}</button><p id="mobileLabelMsg" class="m-form-msg"></p></div>`;
  }
  async function saveMobileLabelCategories(categories){const {error}=await client.from('app_settings').upsert({key:'crm_label_categories_v1',value:categories},{onConflict:'key'});if(error)throw error;}
  async function saveMobileLabel(id=''){
    const msg=byId('mobileLabelMsg');if(!has('can_manage_labels')){if(msg)msg.textContent='No tienes permiso para guardar etiquetas.';return;}
    const name=clean(byId('mobileLabelName')?.value),category=clean(byId('mobileLabelEditCategory')?.value)||'Otras',current=id?mobileLabelById(id):null;if(!name){if(msg)msg.textContent='Escribe el nombre de la etiqueta.';return;}
    const button=document.querySelector('[data-action="save-label"]');if(button)button.disabled=true;if(msg)msg.textContent='Guardando…';
    try{const returnToLibrary=route().query.get('from')==='labels'&&history.length>1;let labelId=current?.id||'';if(current){if(clean(current.name)!==name){const {error}=await client.rpc('crm_rename_label',{p_id:current.id,p_name:name});if(error)throw error;}}else{const created=await client.rpc('crm_create_label',{p_name:name});if(created.error)throw created.error;const listed=await client.rpc('crm_list_labels');if(listed.error)throw listed.error;labelId=(listed.data||[]).find(label=>foldText(label.name)===foldText(name))?.id||'';if(!labelId)throw new Error('La etiqueta se creó, pero no se pudo identificar para guardar su categoría.');}const categories={...state.library.labelCategories,[String(labelId)]:category};await saveMobileLabelCategories(categories);state.library.labelsLoaded=false;await loadMobileLabels(true);if(returnToLibrary)history.back();else go('labels',true);toast('Etiqueta guardada y sincronizada.','success');}
    catch(error){if(msg)msg.textContent=error?.message||'No se pudo guardar la etiqueta.';}
    finally{if(button)button.disabled=false;}
  }
  async function deleteMobileLabel(id){const label=mobileLabelById(id);if(!label||!has('can_manage_labels')||!confirm(`¿Eliminar la etiqueta "${label.name}"? Se quitará también de todos los contactos.`))return;try{const {error}=await client.rpc('crm_delete_label',{p_id:label.id});if(error)throw error;const categories={...state.library.labelCategories};delete categories[String(label.id)];await saveMobileLabelCategories(categories).catch(()=>{});state.library.labels=state.library.labels.filter(row=>String(row.id)!==String(id));state.library.labelCategories=categories;if(state.library.labelCategory&&!mobileLabelCategories().includes(state.library.labelCategory))state.library.labelCategory='';render();toast('Etiqueta eliminada.','success');}catch(error){toast(error?.message||'No se pudo eliminar la etiqueta.','error');}}
  function bindMobileLibraryFilters(){
    const current=route().parts[0];if(current==='templates'){const search=byId('mobileTemplateSearch'),category=byId('mobileTemplateCategory');if(search)search.oninput=()=>{state.library.templateQuery=search.value;updateMobileTemplateResults();};if(category)category.onchange=()=>{state.library.templateCategory=category.value;updateMobileTemplateResults();};}
    if(current==='labels'){const search=byId('mobileLabelSearch'),category=byId('mobileLabelCategory');if(search)search.oninput=()=>{state.library.labelQuery=search.value;updateMobileLabelResults();};if(category)category.onchange=()=>{state.library.labelCategory=category.value;updateMobileLabelResults();};}
  }

  function contactChooserPermission(kind){if(!has('can_view_database'))return false;if(kind==='task')return has('can_manage_agenda');if(kind==='opportunity')return has('can_view_sales')&&has('can_edit_sales')&&state.board.stages.length>0;if(kind==='label')return has('can_manage_labels');return false;}
  function contactChooserModel(){const rows=(state.contacts||[]).filter(contact=>contactMatchesSearch(contact,state.library.contactQuery));return {rows,shown:rows.slice(0,Math.max(CONTACT_PAGE_SIZE,state.library.contactLimit||CONTACT_PAGE_SIZE)),activity:contactActivityIndex()};}
  function contactChooserCard(contact,kind,labelId,activity){
    const stats=activity.get(String(contact.id))||{opportunities:0,pendingTasks:0},label=kind==='task'?'Crear tarea':kind==='opportunity'?'Crear oportunidad':'Asignar etiqueta';
    const action=kind==='label'?`data-action="assign-label-contact" data-contact-id="${esc(contact.id)}" data-label-id="${esc(labelId)}"`:`data-action="route" data-route="${kind==='task'?'new-task':'new-contact-opportunity'}/${esc(contact.id)}?origin=quick"`;
    return `<button class="m-list-card m-contact-card m-chooser-card" ${action} type="button" aria-label="${esc(label)} para ${esc(contact.fullName)}"><span class="m-list-row"><span class="m-avatar">${esc(initials(contact))}</span><span class="m-list-main"><strong>${esc(contact.fullName)}</strong><small>${esc(contact.email||'Sin correo electrónico')}</small></span><span class="m-chevron" aria-hidden="true">›</span></span><span class="m-contact-meta"><span><small>Teléfono</small><b>${esc(contact.phone||'—')}</b></span><span><small>DNI / NIF</small><b>${esc(contact.dni||'—')}</b></span></span><span class="m-contact-activity"><span>◇ ${stats.opportunities} ventas abiertas</span><span>▣ ${stats.pendingTasks} tareas pendientes</span></span></button>`;
  }
  function renderContactChooserRows(kind,labelId){const model=contactChooserModel();if(model.shown.length)return `<div class="m-list">${model.shown.map(contact=>contactChooserCard(contact,kind,labelId,model.activity)).join('')}</div>${model.shown.length<model.rows.length?`<button class="m-secondary m-contact-more" data-action="chooser-more" type="button">Mostrar ${Math.min(CONTACT_PAGE_SIZE,model.rows.length-model.shown.length)} más</button>`:''}`;if(!state.contacts.length)return `${empty('No hay contactos','Para continuar necesitas crear primero un contacto.')}${has('can_create_database')&&has('can_view_database')?'<button class="m-primary m-library-full" data-action="manual-contact" type="button">Crear contacto</button>':''}`;return empty('Sin resultados','Prueba con otro nombre, DNI, teléfono o correo.');}
  function renderContactChooser(kind,labelId=''){
    const valid=['task','opportunity','label'].includes(kind);if(!valid||!contactChooserPermission(kind)){const reason=kind==='opportunity'&&!state.board.stages.length?'No hay columnas de ventas configuradas.':'No tienes permiso o la acción ya no está disponible.';return `<div class="m-page">${pageHead('Elegir contacto','home')}${empty('No disponible',reason)}</div>`;}if(kind==='label'&&!state.library.labelsLoaded)return `<div class="m-page">${pageHead('Elegir contacto','labels')}${skeleton()}</div>`;
    const label=kind==='label'?mobileLabelById(labelId):null;if(kind==='label'&&!label)return `<div class="m-page">${pageHead('Elegir contacto','labels')}${empty('Etiqueta no encontrada','Actualiza las etiquetas y vuelve a intentarlo.')}</div>`;
    const model=contactChooserModel(),noun=kind==='task'?'una tarea':kind==='opportunity'?'una oportunidad':`la etiqueta “${label.name}”`;
    return `<div class="m-page m-contacts-page m-chooser-page">${pageHead('Elegir contacto',kind==='label'?'labels':'home')}<p class="m-subtitle m-library-subtitle">Selecciona el contacto para ${kind==='label'?'asignar':'crear'} ${esc(noun)}.</p><div class="m-search"><input id="mobileChooserSearch" class="m-input" type="search" value="${esc(state.library.contactQuery)}" placeholder="Nombre, DNI, teléfono o correo" autocomplete="off" aria-label="Buscar contacto"></div><p id="mobileChooserCount" class="m-contact-result-count" aria-live="polite">${model.rows.length} ${model.rows.length===1?'contacto':'contactos'}</p><div id="mobileChooserList">${renderContactChooserRows(kind,labelId)}</div></div>`;
  }
  function updateContactChooserResults(kind,labelId){const model=contactChooserModel(),count=byId('mobileChooserCount'),list=byId('mobileChooserList');if(count)count.textContent=`${model.rows.length} ${model.rows.length===1?'contacto':'contactos'}`;if(list)list.innerHTML=renderContactChooserRows(kind,labelId);}
  function bindContactChooser(){const input=byId('mobileChooserSearch'),current=route(),kind=current.parts[0]==='assign-label'?'label':current.parts[1],labelId=current.parts[0]==='assign-label'?current.parts[1]:'';if(!input)return;input.oninput=()=>{state.library.contactQuery=input.value;state.library.contactLimit=CONTACT_PAGE_SIZE;clearTimeout(contactSearchTimer);contactSearchTimer=setTimeout(()=>updateContactChooserResults(kind,labelId),120);};}
  async function assignMobileLabelContact(contactId,labelId,button){
    const contact=state.contacts.find(row=>String(row.id)===String(contactId)),label=mobileLabelById(labelId);if(!contact||!label||!contactChooserPermission('label')){toast('No se puede asignar esta etiqueta.','error');return;}const returnToLibrary=route().query.get('from')==='labels'&&history.length>1;if(button)button.disabled=true;
    try{const current=await client.rpc('crm_get_contact_labels',{p_contact_id:contact.id});if(current.error)throw current.error;const ids=[...new Set((current.data||[]).map(row=>String(row.id??row.label_id??row.value??'')).filter(Boolean).concat([String(label.id)]))];const save=await client.rpc('crm_set_contact_labels',{p_contact_id:contact.id,p_label_ids:ids});if(save.error)throw save.error;state.library.labelCounts[String(label.id)]=Number(state.library.labelCounts[String(label.id)]||0)+((current.data||[]).some(row=>String(row.id??row.label_id??row.value??'')===String(label.id))?0:1);if(returnToLibrary)history.back();else go('labels',true);toast(`Etiqueta asignada a ${contact.fullName}.`,'success');}catch(error){toast(error?.message||'No se pudo asignar la etiqueta.','error');if(button)button.disabled=false;}
  }

  function relatedOpportunities(id){return state.board.opportunities.filter(opp=>String(opp.record_id||opp.contact_id||'')===String(id));}
  function relatedTasks(id){return state.tasks.filter(task=>String(task.related_record_id||'')===String(id));}
  function renderContact(id){
    const contact=state.contacts.find(row=>String(row.id)===String(id));
    if(!contact)return `<div class="m-page">${pageHead('Ficha del contacto','contacts')}${empty('Contacto no encontrado','Actualiza los datos e inténtalo de nuevo.')}</div>`;
    const opps=relatedOpportunities(id),tasks=relatedTasks(id);const tab=state.profileTab;
    let body='';
    if(tab==='summary')body=`<div class="m-info-card">
      ${infoRow('Teléfonos',contactPhones(contact).map(p=>p.label).join('\n'))}${infoRow('DNI / NIF',contact.dni)}${contactTextCard(contact,'observations')}${contactTextCard(contact,'notes')}${infoRow('Banco / IBAN',contact.bank)}${infoRow('Correo electrónico',contact.email)}
    </div>${window.TPFContactParty.summary(contact.data?.TPF_TITULAR,contact)}`;
    if(tab==='opportunities')body=opps.length?`<div class="m-list">${opps.map(opportunityCard).join('')}</div>`:empty('Sin oportunidades','Este contacto todavía no tiene oportunidades.');
    if(tab==='tasks')body=`${has('can_manage_agenda')?'<button class="m-primary" style="width:100%;margin-bottom:12px" data-action="route" data-route="new-task/'+esc(id)+'">＋ Nueva tarea</button>':''}${tasks.length?`<div class="m-list">${tasks.map(taskCard).join('')}</div>`:empty('Sin tareas','Este contacto todavía no tiene tareas.')}`;
    if(tab==='history')body=renderContactHistory(id);
    if(tab==='more')body=`<div class="m-info-card">${infoRow('Origen',contact.source)}${infoRow('Última actualización',dateTime(contact.updatedAt))}</div><div class="m-inline-actions"><button class="m-secondary full" data-action="open-desktop">Abrir en el CRM completo</button></div>`;
    return `<div class="m-page">${pageHead('Ficha del contacto','contacts',has('can_edit_records')?`<button class="m-back" data-action="route" data-route="edit-contact/${esc(id)}" aria-label="Editar">✎</button>`:'')}
      <div class="m-profile-hero"><div class="m-avatar">${esc(initials(contact))}</div><h1>${esc(contact.fullName)}</h1><p>${esc(contact.dni||'Sin DNI')}</p><p>${esc(contact.phone||'Sin teléfono')}</p></div>
      ${contactPhoneActions(contact)}<div class="m-profile-actions">${has('can_view_sales')&&has('can_edit_sales')?`<button class="m-primary" data-action="route" data-route="new-contact-opportunity/${esc(id)}" type="button">＋ Nueva oportunidad</button>`:''}${has('can_manage_labels')?`<button class="m-secondary" data-action="profile-labels" data-contact-id="${esc(id)}" type="button">Gestionar etiquetas</button>`:''}</div>
      <div class="m-tabs"><button class="${tab==='summary'?'active':''}" data-action="profile-tab" data-tab="summary">Resumen</button><button class="${tab==='opportunities'?'active':''}" data-action="profile-tab" data-tab="opportunities">Oportunidades (${opps.length})</button><button class="${tab==='tasks'?'active':''}" data-action="profile-tab" data-tab="tasks">Tareas (${tasks.length})</button><button class="${tab==='history'?'active':''}" data-action="profile-tab" data-tab="history">Historial</button><button class="${tab==='more'?'active':''}" data-action="profile-tab" data-tab="more">Más</button></div>${body}
    </div>`;
  }
  let contactHistory={id:'',rows:[],loading:false,error:'',limit:50},contactTextSaving=false;
  function contactPhoneActions(contact){
    const phones=contactPhones(contact);if(!phones.length)return '';
    return `<div class="m-contact-phone-actions">${phones.length>1?`<label class="m-field"><span>Elegir teléfono</span><select id="mobileContactPhone" class="m-select" data-contact-phone="${esc(contact.id)}">${phones.map(p=>`<option value="${p.number}">${esc(p.label)}</option>`).join('')}</select></label>`:''}<div class="m-inline-actions"><a id="mobileContactCall" class="m-secondary" href="tel:+${phones[0].number}">☎ Llamar</a>${has('can_use_whatsapp')?`<button class="m-secondary" data-action="contact-whatsapp" data-id="${esc(contact.id)}">WhatsApp</button>`:''}</div></div>`;
  }
  function selectedContactPhone(id){const contact=state.contacts.find(c=>String(c.id)===String(id));const phones=contactPhones(contact);return phones.find(p=>p.number===byId('mobileContactPhone')?.value)||phones[0];}
  function openContactWhatsApp(id){if(!has('can_use_whatsapp')||!has('can_view_database'))return;const phone=selectedContactPhone(id);if(phone)go(mobileWaChatPath(phone.number+'@c.us')+'?fromContact='+encodeURIComponent(id));}
  function mobileWaBackTarget(){
    const id=route().query.get('fromContact');
    return id&&has('can_view_database')&&state.contacts.some(contact=>String(contact.id)===id)?'contact/'+encodeURIComponent(id):'whatsapp';
  }
  function contactTextCard(contact,kind){const label=kind==='notes'?'Notas':'Observaciones';return `<div class="m-info-row"><div class="m-contact-text-head"><span>${label}</span>${has('can_edit_records')?`<button class="m-ghost" data-action="route" data-route="contact-text/${esc(contact.id)}/${kind}">Editar ${label.toLowerCase()}</button>`:''}</div><b>${esc(contact[kind]||'—')}</b></div>`;}
  function renderContactText(id,kind){
    const contact=state.contacts.find(c=>String(c.id)===String(id));if(!contact||!has('can_edit_records')||!['notes','observations'].includes(kind))return empty('No disponible','No tienes permiso para editar este contacto.');
    const label=kind==='notes'?'Notas':'Observaciones';
    return `<div class="m-page">${pageHead('Editar '+label.toLowerCase(),'contact/'+id)}<p class="m-subtitle">${esc(contact.fullName)}</p><label class="m-field"><span>${label}</span><textarea id="mobileContactText" class="m-textarea m-contact-text-editor">${esc(contact[kind]||'')}</textarea></label><button class="m-primary m-library-full" data-action="contact-text-save" data-id="${esc(id)}" data-kind="${kind}">Guardar ${label.toLowerCase()}</button><p id="mobileContactTextMsg" class="m-form-msg"></p></div>`;
  }
  async function saveContactText(id,kind,button){
    const contact=state.contacts.find(c=>String(c.id)===String(id)),msg=byId('mobileContactTextMsg');
    if(!contact||!has('can_edit_records')||!['notes','observations'].includes(kind)||contactTextSaving)return;
    const value=byId('mobileContactText')?.value??'',previous=contact[kind]||'';
    if(previous&& !value.trim()&&!confirm('¿Vaciar '+(kind==='notes'?'las notas':'las observaciones')+' de este contacto?'))return;
    contactTextSaving=true;if(button)button.disabled=true;if(msg)msg.textContent='Guardando…';
    try{
      const latest=await client.from('records').select('id,data,source_sheet,created_at,updated_at').eq('id',id).eq('source_sheet',CONTACT_SOURCE).single();if(latest.error)throw latest.error;
      if(mapContact(latest.data)[kind]!==previous)throw new Error('Este texto ha cambiado en el CRM. Vuelve a la ficha, actualiza y revisa antes de guardar.');
      const data={...latest.data.data};const aliases=kind==='notes'?['NOTAS','NOTES']:['OBSERVACIONES','OBSERVACION','Observaciones'];
      aliases.forEach((key,index)=>{if(index===0||Object.hasOwn(data,key))data[key]=value;});
      let query=client.from('records').update({data}).eq('id',id).eq('source_sheet',CONTACT_SOURCE);
      query=latest.data.updated_at?query.eq('updated_at',latest.data.updated_at):query.is('updated_at',null);
      const saved=await query.select('id,data,source_sheet,created_at,updated_at').single();if(saved.error)throw saved.error;
      const index=state.contacts.findIndex(c=>String(c.id)===String(id));if(index>=0)state.contacts[index]=mapContact(saved.data);
      let warning=false;try{const log=await client.from('contact_activity').insert({contact_id:id,activity_type:kind==='notes'?'note':'update',title:kind==='notes'?'Notas actualizadas':'Observaciones actualizadas',description:value.trim()||'Texto eliminado',created_by:state.user.id});if(log.error)warning=true;}catch(_){warning=true;}
      contactHistory={id:'',rows:[],loading:false,error:'',limit:50};
      if(route().parts[0]==='contact-text'&&route().parts[1]===String(id)){state.profileTab='summary';go('contact/'+id,true);}
      toast(warning?'Texto guardado. No se pudo añadir al historial.':'Texto guardado en el CRM.',warning?'error':'success');
    }catch(error){if(msg)msg.textContent=error?.message||'No se pudo guardar.';}
    finally{contactTextSaving=false;if(button)button.disabled=false;}
  }
  function ensureContactHistory(id){if(contactHistory.id!==String(id))loadContactHistory(id);}
  async function loadContactHistory(id,limit=50){
    if(!has('can_view_database')||!state.contacts.some(c=>String(c.id)===String(id)))return;
    const model={id:String(id),rows:[],loading:true,error:'',limit};contactHistory=model;
    try{
      const results=await Promise.all([
        client.from('contact_activity').select('id,activity_type,title,description,created_at').eq('contact_id',id).order('created_at',{ascending:false}).limit(limit),
        (has('can_view_agenda')||has('can_manage_agenda'))?client.from('agenda_items').select('id,title,description,status,created_at,updated_at').eq('related_record_id',id).or('whatsapp_enabled.is.null,whatsapp_enabled.eq.false').order('updated_at',{ascending:false}).limit(limit):Promise.resolve({data:[]}),
        has('can_view_sales')?client.from('sales_opportunities').select('id,title,status,stage_id,created_at,updated_at').eq('record_id',id).order('updated_at',{ascending:false}).limit(limit):Promise.resolve({data:[]})
      ]);
      const failed=results.find(r=>r.error);if(failed)throw failed.error;
      const [activity,tasks,opps]=results;
      model.more=results.some(r=>(r.data||[]).length===limit);
      model.rows=[...(activity.data||[]).map(a=>({at:a.created_at,title:a.title||'Actividad',text:a.description||'',path:''})),...(tasks.data||[]).map(t=>({at:t.updated_at||t.created_at,title:(t.status==='completed'?'Tarea completada · ':'Tarea · ')+(t.title||''),text:t.description||'',path:'task/'+t.id})),...(opps.data||[]).map(o=>({at:o.updated_at||o.created_at,title:(['won','lost'].includes(o.status)?'Oportunidad cerrada · ':'Oportunidad · ')+(o.title||''),text:state.board.stages.find(s=>String(s.id)===String(o.stage_id))?.name||'',path:'opportunity/'+o.id}))].sort((a,b)=>(Date.parse(b.at)||0)-(Date.parse(a.at)||0));
    }catch(error){model.error=error?.message||'No se pudo cargar el historial.';}
    finally{model.loading=false;if(contactHistory===model&&route().parts[0]==='contact'&&route().parts[1]===String(id)&&state.profileTab==='history')render();}
  }
  function renderContactHistory(id){
    const model=contactHistory;if(model.id!==String(id)||model.loading)return skeleton();
    if(model.error)return `${empty('No se pudo cargar',model.error)}<button class="m-secondary" data-action="contact-history-reload" data-id="${esc(id)}">Reintentar</button>`;
    return `<div class="m-contact-history"><button class="m-secondary" data-action="contact-history-reload" data-id="${esc(id)}">Actualizar historial</button><p class="m-subtitle">Actividad registrada y última actualización de tareas y oportunidades.</p>${model.rows.length?model.rows.map(row=>`<article class="m-info-card"><small>${esc(dateTime(row.at))}</small><h3>${esc(row.title)}</h3><p>${esc(row.text)}</p>${row.path?`<button class="m-ghost" data-action="route" data-route="${esc(row.path)}">Ver detalle ›</button>`:''}</article>`).join(''):empty('Sin actividad','Todavía no hay actividad registrada para este contacto.')}${model.more?`<button class="m-secondary" data-action="contact-history-more" data-id="${esc(id)}">Cargar más actividad</button>`:''}</div>`;
  }
  function infoRow(label,value){return `<div class="m-info-row"><span>${esc(label)}</span><b>${esc(value||'—')}</b></div>`;}

  async function deleteProfileOpportunity(id,contactId,button){
    const opp=(contactId?relatedOpportunities(contactId):state.board.opportunities).find(row=>String(row.id)===String(id));
    if(!opp||!has('can_edit_sales')||deletingProfileOpportunities.has(String(id))||savingMobileOpportunities.has(String(id)))return;
    if(!confirm(`¿Eliminar la oportunidad "${opp.title||'Sin título'}"?`))return;
    deletingProfileOpportunities.add(String(id));if(button)button.disabled=true;
    try{
      const removed=await client.rpc('delete_sales_opportunity',{opportunity_id:opp.id});
      if(removed.error)throw removed.error;
      const check=await client.from('sales_opportunities').select('id').eq('id',opp.id).maybeSingle();
      if(check.error)throw check.error;
      if(check.data)throw new Error('La oportunidad sigue existiendo. Actualiza los datos antes de intentarlo de nuevo.');
      state.board.opportunities=state.board.opportunities.filter(row=>String(row.id)!==String(id));
      updateAlertDot();if(['opportunity','edit-opportunity'].includes(route().parts[0])&&route().parts[1]===String(id)){state.profileTab='opportunities';go(opp.record_id?`contact/${opp.record_id}`:'opportunities',true);}else render();toast('Oportunidad eliminada.','success');
    }catch(error){toast(error?.message||'No se pudo eliminar la oportunidad.','error');}
    finally{deletingProfileOpportunities.delete(String(id));if(button)button.disabled=false;}
  }

  function profileLabelId(label){return String(label.id??label.label_id??label.value??'');}
  function profileLabelsVisible(contactId){const current=route();return current.parts[0]==='contact-labels'&&String(current.parts[1])===String(contactId);}
  function openProfileLabels(contactId){
    if(!has('can_manage_labels')||!state.contacts.some(row=>String(row.id)===String(contactId)))return;
    profileLabels={contactId:String(contactId),loaded:false,loading:false,saving:false,error:'',labels:[],initial:[],selected:new Set()};
    go(`contact-labels/${contactId}`);
  }
  function ensureProfileLabels(contactId){
    if(!has('can_manage_labels')||!state.contacts.some(row=>String(row.id)===String(contactId)))return;
    if(profileLabels.contactId!==String(contactId))profileLabels={contactId:String(contactId),loaded:false,loading:false,saving:false,error:'',labels:[],initial:[],selected:new Set()};
    if(!profileLabels.loaded&&!profileLabels.loading&&!profileLabels.error)loadProfileLabels(contactId);
  }
  async function loadProfileLabels(contactId){
    if(!has('can_manage_labels')||profileLabels.contactId!==String(contactId)||profileLabels.loading)return;
    const editor=profileLabels;editor.loading=true;editor.error='';
    try{
      const [all,assigned,categories]=await Promise.all([client.rpc('crm_list_labels'),client.rpc('crm_get_contact_labels',{p_contact_id:contactId}),client.from('app_settings').select('value').eq('key','crm_label_categories_v1').maybeSingle()]);
      if(all.error)throw all.error;if(assigned.error)throw assigned.error;if(categories.error)throw categories.error;
      if(editor!==profileLabels)return;
      editor.labels=[...new Map([...(all.data||[]),...(assigned.data||[])].map(label=>[profileLabelId(label),label])).values()].filter(label=>profileLabelId(label)).sort((a,b)=>String(a.name||a.label_name||'').localeCompare(String(b.name||b.label_name||''),'es'));
      editor.categories=categories.data?.value||{};
      editor.initial=(assigned.data||[]).map(profileLabelId).filter(Boolean);editor.selected=new Set(editor.initial);editor.loaded=true;
    }catch(error){if(editor===profileLabels)editor.error=error?.message||'No se pudieron cargar las etiquetas.';}
    finally{editor.loading=false;if(editor===profileLabels&&profileLabelsVisible(contactId))render();}
  }
  function renderProfileLabels(contactId){
    const contact=state.contacts.find(row=>String(row.id)===String(contactId)),head=pageHead('Etiquetas del contacto',`contact/${contactId}`);
    if(!contact||!has('can_manage_labels'))return `<div class="m-page">${head}${empty('No disponible','No tienes permiso o el contacto ya no existe.')}</div>`;
    const editor=profileLabels;
    if(editor.contactId!==String(contactId)||editor.loading||!editor.loaded&&!editor.error)return `<div class="m-page">${head}${skeleton()}</div>`;
    if(editor.error&&!editor.loaded)return `<div class="m-page">${head}<p class="m-form-msg">${esc(editor.error)}</p><button class="m-secondary" data-action="profile-labels-retry" data-contact-id="${esc(contactId)}">Reintentar</button></div>`;
    const labels=editor.labels.map(label=>{const id=profileLabelId(label);const category=clean(editor.categories?.[id])||clean(label.category)||mobileWaInferLabelCategory(label.name);return `<label class="m-profile-label" data-category="${esc(category)}"><input type="checkbox" data-profile-label-id="${esc(id)}" ${editor.selected.has(id)?'checked':''} ${editor.saving?'disabled':''}><span>${esc(label.name||label.label_name||'Etiqueta')}<small class="m-label-category">${esc(category)}</small></span></label>`;}).join('');
    return `<div class="m-page">${head}<p class="m-subtitle">${esc(contact.fullName)}</p><p class="m-muted">Marca para añadir y desmarca para quitar de este contacto.</p><input id="mobileProfileLabelSearch" class="m-input" type="search" placeholder="Buscar etiqueta" aria-label="Buscar etiqueta"><label class="m-field" style="margin-top:12px"><span>Categoría</span><select id="mobileProfileLabelCategory" class="m-select"><option value="">Todas las categorías</option>${[...new Set(editor.labels.map(label=>clean(editor.categories?.[profileLabelId(label)])||clean(label.category)||mobileWaInferLabelCategory(label.name)))].sort((a,b)=>a.localeCompare(b,'es')).map(category=>`<option value="${esc(category)}">${esc(category)}</option>`).join('')}</select></label><p id="mobileProfileLabelEmpty" class="m-muted hidden">No hay etiquetas que coincidan con los filtros.</p><div class="m-profile-labels">${labels||empty('Sin etiquetas','Todavía no hay etiquetas creadas en el CRM.')}</div><button class="m-primary m-library-full" data-action="profile-labels-save" data-contact-id="${esc(contactId)}" ${editor.saving||!editor.labels.length?'disabled':''}>${editor.saving?'Guardando…':'Guardar etiquetas'}</button><p class="m-form-msg">${esc(editor.error)}</p></div>`;
  }
  function filterProfileLabels(){
    const query=foldText(byId('mobileProfileLabelSearch')?.value),category=byId('mobileProfileLabelCategory')?.value||'';let count=0;
    document.querySelectorAll('.m-profile-label').forEach(label=>{const visible=(!category||label.dataset.category===category)&&foldText(label.textContent).includes(query);label.classList.toggle('hidden',!visible);if(visible)count++;});
    byId('mobileProfileLabelEmpty')?.classList.toggle('hidden',count>0);
  }
  async function saveProfileLabels(contactId){
    const editor=profileLabels;
    if(!has('can_manage_labels')||!editor.loaded||editor.saving||editor.contactId!==String(contactId)||!state.contacts.some(row=>String(row.id)===String(contactId)))return;
    const added=[...editor.selected].filter(id=>!editor.initial.includes(id)),removed=new Set(editor.initial.filter(id=>!editor.selected.has(id)));
    if(!added.length&&!removed.size){go(`contact/${contactId}`,true);return;}
    editor.saving=true;editor.error='';render();
    try{
      const current=await client.rpc('crm_get_contact_labels',{p_contact_id:contactId});if(current.error)throw current.error;
      const ids=[...new Set((current.data||[]).map(profileLabelId).filter(id=>id&&!removed.has(id)).concat(added))];
      const saved=await client.rpc('crm_set_contact_labels',{p_contact_id:contactId,p_label_ids:ids});if(saved.error)throw saved.error;
      editor.initial=ids;editor.selected=new Set(ids);state.library.labelsLoaded=false;
      if(editor===profileLabels&&profileLabelsVisible(contactId)){state.profileTab='summary';go(`contact/${contactId}`,true);toast('Etiquetas guardadas en el contacto.','success');}
    }catch(error){editor.error=error?.message||'No se pudieron guardar las etiquetas.';}
    finally{editor.saving=false;if(editor===profileLabels&&profileLabelsVisible(contactId))render();}
  }

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
    </div>${window.TPFContactParty.html(prefix+'Party',contact.data?.TPF_TITULAR||contact.party)}`;
  }
  function readContactFields(prefix){
    const value=id=>clean(byId(`${prefix}${id}`)?.value);
    return {party:window.TPFContactParty.read(prefix+'Party'),first:value('First'),last:value('Last'),dni:value('Dni').toUpperCase(),phone:value('Phone'),email:value('Email'),bank:value('Bank'),observations:value('Observations'),notes:value('Notes')};
  }
  function renderEditContact(id){
    const contact=state.contacts.find(row=>String(row.id)===String(id));
    if(!contact||!has('can_edit_records'))return `<div class="m-page">${pageHead('Editar contacto',`contact/${id}`)}${empty('No disponible','No tienes permiso o el contacto ya no existe.')}</div>`;
    return `<div class="m-page">${pageHead('Editar contacto',`contact/${id}`)}${contactFields(contact,'edit')}<button class="m-primary" style="width:100%;margin-top:18px" data-action="save-contact" data-id="${esc(id)}">Guardar cambios</button><p id="mobileEditMsg" class="m-form-msg"></p></div>`;
  }
  async function saveContact(id){
    const contact=state.contacts.find(row=>String(row.id)===String(id));if(!contact||!has('can_edit_records'))return;
    let values;try{values=readContactFields('edit');}catch(error){byId('mobileEditMsg').textContent=error.message;return;}if(!values.first&&!values.last){byId('mobileEditMsg').textContent='Escribe el nombre o los apellidos.';return;}
    const fullName=[values.first,values.last].filter(Boolean).join(' ');const data={...contact.data,'TPF_TITULAR':values.party,'NOMBRE':values.first,'APELLIDOS':values.last,'NOMBRE Y APELLIDOS':fullName,'TELÉFONO':values.phone,'DNI / NIF':values.dni,'DNI':values.dni,'EMAIL':values.email,'BANCO':values.bank,'OBSERVACIONES':values.observations,'NOTAS':values.notes};
    const button=document.querySelector('[data-action="save-contact"]');button.disabled=true;byId('mobileEditMsg').textContent='Guardando…';
    try{
      const {error}=await client.from('records').update({data}).eq('id',id).eq('source_sheet',CONTACT_SOURCE).select('id').single();if(error)throw error;
      await refreshData({silent:true});toast('Contacto actualizado en todo el CRM.','success');go(`contact/${id}`);
    }catch(error){byId('mobileEditMsg').textContent=error?.message||'No se pudo guardar.';}
    finally{button.disabled=false;}
  }

  function opportunityCard(opp){
    const stage=state.board.stages.find(row=>String(row.id)===String(opp.stage_id));
    return `<button class="m-list-card" data-action="route" data-route="opportunity/${esc(opp.id)}"><span class="m-list-row"><span class="m-avatar">◇</span><span class="m-list-main"><strong>${esc(opp.title||'Oportunidad')}</strong>${window.TPFContactParty.hint(opp)}<small>${esc(opp.client_name||'Sin contacto')} · ${esc(stage?.name||'Sin columna')}</small></span><span class="m-chevron">›</span></span></button>`;
  }
  function opportunityDisplayState(opp,now=Date.now(),stage=null){
    const status=foldText(opp?.status||'open'),stageName=foldText(stage?.name||stage);
    if(opportunityIsClosed(opp,stage)){
      if(['won','ganada','ganado'].includes(status)||/ganad|won/.test(stageName))return {label:'Ganada',tone:'green'};
      if(['lost','perdida','perdido','canceled','cancelled','rejected','cancelada','cancelado','rechazada','rechazado'].includes(status)||/perdid|cancelad|rechazad|lost/.test(stageName))return {label:'Perdida',tone:'red'};
      return {label:'Cerrada',tone:'green'};
    }
    const key=opportunityDateKey(opp),today=todayKey(now);
    if(!key)return {label:'Sin fecha',tone:'neutral'};
    if(key<today)return {label:'Vencida',tone:'red'};
    if(key===today)return {label:'Hoy',tone:'amber'};
    return {label:'Próxima',tone:'purple'};
  }
  function opportunityDateLabel(opp){
    const key=opportunityDateKey(opp);if(!key)return 'Sin fecha';
    const [year,month,day]=key.split('-');return `${day}/${month}/${year}`;
  }
  function opportunityListCard(opp,context,now=Date.now()){
    const stage=context.stages.get(String(opp.stage_id));
    const contact=opportunityContact(opp,context.contacts);
    const clientName=clean(opp.client_name)||clean(contact?.fullName)||'Sin contacto';
    const phone=clean(opp.phone)||clean(contact?.phone);
    const display=opportunityDisplayState(opp,now,stage);
    return `<button class="m-list-card m-opportunity-card" data-action="route" data-route="opportunity/${esc(opp.id)}" type="button"><span class="m-list-row"><span class="m-avatar">◇</span><span class="m-list-main"><strong>${esc(opp.title||'Oportunidad')}</strong><small>${esc(clientName)}${phone?` · ${esc(phone)}`:''}</small></span><span class="m-badge ${display.tone}">${display.label}</span></span><span class="m-opportunity-meta"><span><small>Cierre</small><b>${esc(opportunityDateLabel(opp))}</b></span><span><small>Importe</small><b>${opp.amount!=null?esc(money(opp.amount)):'Sin importe'}</b></span><span class="wide"><small>Columna / estado</small><b>${esc(stage?.name||'Sin columna')}</b></span></span></button>`;
  }
  function renderOpportunityFilters(counts,active=state.opportunityFilter){
    const options=[['all','Todas'],['today','Hoy'],['overdue','Vencidas'],['upcoming','Próximas'],['month','Este mes'],['closed','Cerradas']];
    return options.map(([key,label])=>`<button class="m-opportunity-filter ${active===key?'active':''}" data-action="opportunity-filter" data-filter="${key}" type="button" aria-pressed="${active===key}"><span>${label}</span><b>${counts[key]||0}</b></button>`).join('');
  }
  function opportunityRowsHtml(model){
    if(model.rows.length)return model.rows.map(opp=>opportunityListCard(opp,model.context)).join('');
    if(!(state.board.opportunities||[]).length)return empty('Sin oportunidades','Todavía no hay oportunidades creadas.');
    if(!model.base.length)return empty('Sin resultados','Prueba con otra búsqueda o columna.');
    return empty('Sin oportunidades en este filtro','Prueba con otro filtro de fecha o estado.');
  }
  function renderOpportunities(){
    if(!has('can_view_sales')&&!has('can_edit_sales'))return `<div class="m-page">${pageHead('Oportunidades')}${empty('Acceso restringido','No tienes permiso para ver ventas.')}</div>`;
    const model=opportunityListModel();
    const stageOptions=(state.board.stages||[]).map(stage=>`<option value="${esc(stage.id)}" ${String(state.opportunityStage)===String(stage.id)?'selected':''}>${esc(stage.name)}</option>`).join('');
    return `<div class="m-page m-opportunities-page">${pageHead('Oportunidades','home')}<div class="m-search m-opportunity-search"><input id="mobileOpportunitySearch" class="m-input" type="search" value="${esc(state.opportunityQuery)}" placeholder="Oportunidad, contacto, DNI o teléfono" autocomplete="off" aria-label="Buscar oportunidades"></div><label class="m-opportunity-stage"><span>Columna / estado</span><select id="mobileOpportunityStage" class="m-select" aria-label="Filtrar por columna"><option value="">Todas las columnas</option>${stageOptions}</select></label><div id="mobileOpportunityFilters" class="m-opportunity-filters" role="group" aria-label="Filtrar oportunidades">${renderOpportunityFilters(model.counts,model.active)}</div><p id="mobileOpportunityResultCount" class="m-opportunity-result-count" aria-live="polite" aria-atomic="true">${model.rows.length} ${model.rows.length===1?'oportunidad':'oportunidades'}</p><div id="mobileOpportunitiesList" class="m-list">${opportunityRowsHtml(model)}</div></div>`;
  }
  function updateOpportunityResults(){
    const model=opportunityListModel();
    const filters=byId('mobileOpportunityFilters'),count=byId('mobileOpportunityResultCount'),list=byId('mobileOpportunitiesList');
    if(filters)filters.innerHTML=renderOpportunityFilters(model.counts,model.active);
    if(count)count.textContent=`${model.rows.length} ${model.rows.length===1?'oportunidad':'oportunidades'}`;
    if(list)list.innerHTML=opportunityRowsHtml(model);
  }
  function bindOpportunityFilters(){
    const search=byId('mobileOpportunitySearch'),stage=byId('mobileOpportunityStage');
    if(search)search.oninput=()=>{state.opportunityQuery=search.value;clearTimeout(opportunitySearchTimer);opportunitySearchTimer=setTimeout(updateOpportunityResults,120);};
    if(stage)stage.onchange=()=>{state.opportunityStage=stage.value;updateOpportunityResults();};
  }
  function renderOpportunity(id){
    const opp=state.board.opportunities.find(row=>String(row.id)===String(id));if(!opp)return `<div class="m-page">${pageHead('Oportunidad','opportunities')}${empty('No encontrada','Actualiza e inténtalo de nuevo.')}</div>`;
    if(!has('can_view_sales')&&!has('can_edit_sales'))return empty('Acceso restringido','No tienes permiso para ver oportunidades.');
    const stage=state.board.stages.find(row=>String(row.id)===String(opp.stage_id));
    return `<div class="m-page">${pageHead('Oportunidad','opportunities')}<div class="m-profile-hero"><div class="m-avatar">◇</div><h1>${esc(opp.title||'Oportunidad')}</h1><p>${esc(opp.client_name||'Sin contacto')}</p></div><div class="m-info-card">${infoRow('Columna / Estado',stage?.name||'—')}${infoRow('Importe',opp.amount!=null?money(opp.amount):'—')}${infoRow('Cierre previsto',date(opp.expected_date))}${infoRow('Teléfono',opp.phone)}${infoRow('Notas',opp.notes)}</div>${has('can_edit_sales')?`<div class="m-detail-actions"><button class="m-primary" data-action="route" data-route="edit-opportunity/${esc(id)}">Editar oportunidad</button><button class="m-danger" data-action="profile-delete-opportunity" data-id="${esc(id)}">Eliminar oportunidad</button></div>`:''}${opp.record_id?`<button class="m-secondary" style="width:100%;margin-top:12px" data-action="route" data-route="contact/${esc(opp.record_id)}">Ver contacto</button>`:''}</div>`;
  }

  function renderEditOpportunity(id){
    const opp=state.board.opportunities.find(row=>String(row.id)===String(id)),head=pageHead('Editar oportunidad',`opportunity/${id}`);
    if(!opp||!has('can_edit_sales'))return `<div class="m-page">${head}${empty('No disponible','No tienes permiso o la oportunidad ya no existe.')}</div>`;
    const stages=state.board.stages.filter(stage=>!opp.pipeline_id||String(stage.pipeline_id)===String(opp.pipeline_id));
    const options=stages.map(stage=>`<option value="${esc(stage.id)}" ${String(stage.id)===String(opp.stage_id)?'selected':''}>${esc(stage.name)}</option>`).join('');
    return `<div class="m-page">${head}<p class="m-subtitle" style="margin-bottom:16px">${esc(opp.client_name||'Sin contacto')}</p><div class="m-form-grid"><label class="m-field"><span>Nombre de oportunidad</span><input id="editOppTitle" class="m-input" value="${esc(opp.title||'')}"></label><label class="m-field"><span>Columna / Estado</span><select id="editOppStage" class="m-select">${stages.some(stage=>String(stage.id)===String(opp.stage_id))?'':`<option value="${esc(opp.stage_id||'')}">Columna actual</option>`}${options}</select></label><label class="m-field"><span>Fecha de cierre prevista</span><input id="editOppDate" class="m-input" type="date" value="${esc(String(opp.expected_date||'').slice(0,10))}"></label><label class="m-field"><span>Importe (opcional)</span><input id="editOppAmount" class="m-input" inputmode="decimal" value="${esc(opp.amount??'')}"></label><label class="m-field"><span>Notas</span><textarea id="editOppNotes" class="m-textarea">${esc(opp.notes||'')}</textarea></label></div>${window.TPFContactParty.html('editOppParty',opp.contract_party,true)}<div class="m-detail-actions"><button class="m-primary" data-action="save-opportunity-detail" data-id="${esc(id)}">Guardar cambios</button><button class="m-secondary" data-action="route" data-route="opportunity/${esc(id)}">Cancelar</button></div><p id="mobileOppDetailMsg" class="m-form-msg"></p></div>`;
  }
  async function saveOpportunityDetail(id,button){
    const opp=state.board.opportunities.find(row=>String(row.id)===String(id)),msg=byId('mobileOppDetailMsg');
    if(!opp||!has('can_edit_sales')||savingMobileOpportunities.has(String(id))||deletingProfileOpportunities.has(String(id)))return;
    const title=clean(byId('editOppTitle')?.value),stageId=byId('editOppStage')?.value,stage=state.board.stages.find(row=>String(row.id)===String(stageId)),raw=clean(byId('editOppAmount')?.value).replace(',','.'),amount=raw===''?null:Number(raw),expected=byId('editOppDate')?.value||null;
    if(!title||!stageId||(!stage&&String(stageId)!==String(opp.stage_id))||(stage&&opp.pipeline_id&&String(stage.pipeline_id)!==String(opp.pipeline_id))||(amount!==null&&!Number.isFinite(amount))||(expected&&!validAgendaDateKey(expected))){if(msg)msg.textContent='Revisa el nombre, la columna, la fecha y el importe.';return;}
    const patch={title,stage_id:stageId,amount,expected_date:expected,notes:clean(byId('editOppNotes')?.value)||null};
    if(String(stageId)!==String(opp.stage_id))patch.position=0;
    savingMobileOpportunities.add(String(id));if(button)button.disabled=true;if(msg)msg.textContent='Guardando…';
    try{patch.contract_party=window.TPFContactParty.snapshot(window.TPFContactParty.read('editOppParty'),{name:opp.contract_party?.contact_name||opp.client_name,phone:opp.contract_party?.contact_phone||opp.phone,dni:opp.contract_party?.contact_dni});const result=await client.from('sales_opportunities').update(patch).eq('id',id).select('*').single();if(result.error)throw result.error;const index=state.board.opportunities.findIndex(row=>String(row.id)===String(id));if(index>=0)state.board.opportunities[index]={...opp,...result.data};updateAlertDot();if(route().parts[0]==='edit-opportunity'&&route().parts[1]===String(id)){go(`opportunity/${id}`,true);toast('Oportunidad guardada.','success');}}
    catch(error){if(msg)msg.textContent=error?.message||'No se pudo guardar la oportunidad.';}
    finally{savingMobileOpportunities.delete(String(id));if(button)button.disabled=false;}
  }

  function taskCard(task){
    const overdue=String(task.status)==='pending'&&task.starts_at&&new Date(task.starts_at).getTime()<Date.now();
    return `<article class="m-list-card m-task-card"><button class="m-task-open" data-action="route" data-route="task/${esc(task.id)}" type="button"><span class="m-list-row"><span class="m-avatar">▣</span><span class="m-list-main"><strong>${esc(task.title||'Tarea')}</strong><small>${esc(task.customer_name||'Sin contacto')} · ${esc(dateTime(task.starts_at))}</small></span><span class="m-badge ${String(task.status)==='completed'?'':overdue?'red':'amber'}">${String(task.status)==='completed'?'Completada':overdue?'Vencida':String(task.status)==='cancelled'?'Cancelada':'Pendiente'}</span></span>${task.description?`<span class="m-task-description">${esc(task.description)}</span>`:''}</button>${has('can_manage_agenda')?`<div class="m-task-actions">${String(task.status)==='pending'?`<button class="m-secondary" data-action="complete-task" data-id="${esc(task.id)}">Marcar completada</button>`:''}<button class="m-danger" data-action="delete-task" data-id="${esc(task.id)}">Eliminar tarea</button></div>`:''}</article>`;
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
  function validAgendaDateKey(value){
    const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(clean(value));if(!match)return false;
    const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]),parsed=new Date(Date.UTC(year,month-1,day,12));
    return parsed.getUTCFullYear()===year&&parsed.getUTCMonth()===month-1&&parsed.getUTCDate()===day;
  }
  function shiftAgendaDateKey(value,days){
    const base=validAgendaDateKey(value)?value:madridDateKey(),[year,month,day]=base.split('-').map(Number),parsed=new Date(Date.UTC(year,month-1,day+Number(days||0),12));
    return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth()+1).padStart(2,'0')}-${String(parsed.getUTCDate()).padStart(2,'0')}`;
  }
  function agendaSelectedDate(current=route(),now=Date.now()){
    const requested=clean(current?.query?.get?.('date'));return validAgendaDateKey(requested)?requested:madridDateKey(now);
  }
  function agendaDateLabel(value){
    const parsed=new Date(`${value}T12:00:00Z`),label=parsed.toLocaleDateString('es-ES',{timeZone:'Europe/Madrid',weekday:'long',day:'numeric',month:'long',year:'numeric'});
    return label.charAt(0).toUpperCase()+label.slice(1);
  }
  function madridOffsetAt(value){
    const parsed=new Date(value),formatter=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
    const parts=Object.fromEntries(formatter.formatToParts(parsed).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
    return Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour),Number(parts.minute),Number(parts.second))-parsed.getTime();
  }
  function madridMidnight(value){
    const [year,month,day]=value.split('-').map(Number),wallTime=Date.UTC(year,month-1,day),first=wallTime-madridOffsetAt(wallTime);
    return new Date(wallTime-madridOffsetAt(first));
  }
  function agendaDayUtcRange(value){
    const selected=validAgendaDateKey(value)?value:madridDateKey(),next=shiftAgendaDateKey(selected,1);
    return {start:madridMidnight(selected).toISOString(),end:madridMidnight(next).toISOString()};
  }
  const agendaDateTime=value=>{if(!value)return 'Sin fecha';const parsed=new Date(value);return Number.isNaN(parsed.getTime())?'Sin fecha':parsed.toLocaleString('es-ES',{timeZone:'Europe/Madrid',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});};
  function agendaListModel(value=agendaSelectedDate(),tasks=state.tasks){
    const selected=validAgendaDateKey(value)?value:madridDateKey(),rows=(tasks||[]).filter(task=>madridDateKey(task?.starts_at)===selected).sort((a,b)=>String(a.starts_at||'').localeCompare(String(b.starts_at||'')));
    return {selected,rows,pending:rows.filter(task=>taskIsPending(task)).length,completed:rows.filter(task=>taskIsCompleted(task)).length,cancelled:rows.filter(task=>taskStatus(task)==='cancelled').length};
  }
  function agendaTaskCard(task){return taskCard(task);}
  async function loadAgendaDay(value){
    if(!client||(!has('can_view_agenda')&&!has('can_manage_agenda'))||!validAgendaDateKey(value))return;
    const requestId=state.agenda.requestId+1;state.agenda={date:value,rows:[],loading:true,loaded:false,error:'',requestId};
    try{
      const range=agendaDayUtcRange(value),result=await client.from('agenda_items').select('id,title,description,customer_name,customer_phone,starts_at,reminder_at,assigned_to,related_record_id,status,whatsapp_enabled,created_at').or('whatsapp_enabled.is.null,whatsapp_enabled.eq.false').gte('starts_at',range.start).lt('starts_at',range.end).order('starts_at',{ascending:true}).limit(1000);
      if(result.error)throw result.error;if(state.agenda.requestId!==requestId)return;state.agenda.rows=result.data||[];
    }catch(error){
      if(state.agenda.requestId!==requestId)return;state.agenda.rows=agendaListModel(value,state.tasks).rows;state.agenda.error=error?.message||'No se pudo actualizar este día.';
    }finally{
      if(state.agenda.requestId!==requestId)return;state.agenda.loading=false;state.agenda.loaded=true;const current=route();if(current.parts[0]==='agenda'&&agendaSelectedDate(current)===value)render();
    }
  }
  function ensureAgendaDayLoaded(value){
    if(state.agenda.date===value&&(state.agenda.loading||state.agenda.loaded))return;
    loadAgendaDay(value);
  }
  function renderAgenda(){
    if(!has('can_view_agenda')&&!has('can_manage_agenda'))return `<div class="m-page m-agenda-page">${pageHead('Agenda')}${empty('Acceso restringido','No tienes permiso para ver la agenda.')}</div>`;
    const selected=agendaSelectedDate(),ready=state.agenda.date===selected&&state.agenda.loaded,model=agendaListModel(selected,ready?state.agenda.rows:[]),today=madridDateKey(),previous=shiftAgendaDateKey(model.selected,-1),next=shiftAgendaDateKey(model.selected,1),isToday=model.selected===today;
    const content=!ready?skeleton():model.rows.length?`<div class="m-list m-agenda-list">${model.rows.map(agendaTaskCard).join('')}</div>`:empty('Día libre','No hay tareas ni recordatorios para este día.');
    const warning=ready&&state.agenda.error?`<div class="m-duplicate warn">${esc(state.agenda.error)} Se muestran los datos disponibles.</div>`:'';
    return `<div class="m-page m-agenda-page">${pageHead('Agenda','home','<button class="m-back" data-action="refresh" type="button" aria-label="Actualizar agenda">↻</button>')}
      <section class="m-agenda-picker" aria-label="Seleccionar día de la agenda">
        <button class="m-agenda-arrow" data-action="agenda-day" data-date="${previous}" type="button" aria-label="Día anterior">‹</button>
        <label class="m-agenda-date"><span>Fecha</span><input id="mobileAgendaDate" type="date" value="${model.selected}" aria-label="Fecha de la agenda"></label>
        <button class="m-agenda-arrow" data-action="agenda-day" data-date="${next}" type="button" aria-label="Día siguiente">›</button>
      </section>
      <div class="m-agenda-day-head"><div><small>${isToday?'Hoy':'Día seleccionado'}</small><h2>${esc(agendaDateLabel(model.selected))}</h2></div>${isToday?'':`<button class="m-secondary" data-action="agenda-day" data-date="${today}" type="button">Hoy</button>`}</div>
      <div class="m-agenda-summary"><span><small>Recordatorios</small><b>${model.rows.length}</b></span><span><small>Pendientes</small><b>${model.pending}</b></span><span><small>Completados</small><b>${model.completed}</b></span><span><small>Cancelados</small><b>${model.cancelled}</b></span></div>
      ${warning}${content}
      <button class="m-secondary m-agenda-all" data-action="route" data-route="tasks" type="button">Ver todas las tareas</button>
    </div>`;
  }
  function bindAgendaDate(){
    const input=byId('mobileAgendaDate');if(!input)return;
    input.onchange=()=>{if(validAgendaDateKey(input.value))go(`agenda?date=${input.value}`,true);};
  }
  async function completeTask(id){
    if(!has('can_manage_agenda')||!confirm('¿Marcar esta tarea como completada?'))return;
    try{const {error}=await client.from('agenda_items').update({status:'completed'}).eq('id',id).select('id').single();if(error)throw error;await refreshData({silent:true});render();toast('Tarea completada.','success');}catch(error){toast(error?.message||'No se pudo completar.','error');}
  }
  function taskLocalValue(value){if(!value)return '';const date=new Date(value);if(Number.isNaN(date.getTime()))return '';date.setMinutes(date.getMinutes()-date.getTimezoneOffset());return date.toISOString().slice(0,16);}
  const MOBILE_TASK_DEFAULT_TYPES=['Tarea','Llamada','Cita','WhatsApp'];
  let mobileTaskTypes=[...MOBILE_TASK_DEFAULT_TYPES];
  async function loadMobileTaskTypes(){
    try{
      const {data,error}=await client.from('app_settings').select('value').eq('key','agenda_types').maybeSingle();
      if(error)throw error;
      const types=Array.isArray(data?.value)?data.value.filter(t=>t?.name&&t?.icon&&t?.color).slice(0,30).map(t=>String(t.name)):[];
      mobileTaskTypes=types.length?[...new Set(types)]:[...MOBILE_TASK_DEFAULT_TYPES];
    }catch(_){mobileTaskTypes=[...MOBILE_TASK_DEFAULT_TYPES];}
  }
  function taskTypeOptions(selected){return [...new Set([...mobileTaskTypes,selected])].filter(Boolean).map(name=>`<option value="${esc(name)}" ${name===selected?'selected':''}>${esc(name)}</option>`).join('');}
  function taskTypeFields(prefix,type,meta={}){
    const key=String(type).toLowerCase();
    const select=(suffix,label,options,value)=>`<label class="m-field"><span>${label}</span><select id="${prefix}${suffix}" class="m-select">${options.map(([id,text])=>`<option value="${id}" ${String(value)===id?'selected':''}>${text}</option>`).join('')}</select></label>`;
    const input=(suffix,label,value)=>`<label class="m-field"><span>${label}</span><input id="${prefix}${suffix}" class="m-input" value="${esc(value||'')}"></label>`;
    if(key==='tarea')return select('Priority','Prioridad',[['normal','Normal'],['high','Alta'],['urgent','Urgente']],meta.priority||'normal');
    if(key==='llamada')return select('Duration','Duración',[['15','15 minutos'],['30','30 minutos'],['45','45 minutos'],['60','1 hora']],meta.duration||'30')+select('Result','Resultado',[['','Sin indicar'],['pending','Pendiente de llamar'],['answered','Atendida'],['no_answer','No contesta'],['callback','Volver a llamar']],meta.result||'');
    if(key==='cita')return select('Duration','Duración',[['30','30 minutos'],['60','1 hora'],['90','90 minutos'],['120','2 horas']],meta.duration||'30')+input('Location','Lugar',meta.location);
    if(key==='whatsapp')return `<label class="m-field"><span>Mensaje de referencia</span><textarea id="${prefix}WhatsappMessage" class="m-textarea">${esc(meta.whatsapp_message||'')}</textarea></label><p class="m-subtitle">Este recordatorio no programa un envío de WhatsApp.</p>`;
    return input('Custom','Detalle',meta.custom);
  }
  function readTaskTypeFields(prefix){
    const original=prefix==='editTask'?taskDetail.row:null,type=clean(byId(prefix+'Type')?.value)||original?.agenda_type||'Tarea';
    const meta={...(original?.agenda_meta||{})},keys={tarea:[['priority','Priority']],llamada:[['duration','Duration'],['result','Result']],cita:[['duration','Duration'],['location','Location']],whatsapp:[['whatsapp_message','WhatsappMessage']]};
    for(const key of ['priority','duration','result','location','whatsapp_message','custom'])delete meta[key];
    for(const [key,suffix] of keys[type.toLowerCase()]||[['custom','Custom']]){const value=clean(byId(prefix+suffix)?.value);if(value)meta[key]=value;}
    return {agenda_type:type,agenda_meta:meta};
  }
  function taskFields(prefix,row={}){
    const type=row.agenda_type||'Tarea';
    return `<div class="m-form-grid"><label class="m-field"><span>Tipo de recordatorio</span><select id="${prefix}Type" data-task-type-prefix="${prefix}" class="m-select">${taskTypeOptions(type)}</select></label><div id="${prefix}TypeFields" class="m-form-grid">${taskTypeFields(prefix,type,row.agenda_meta||{})}</div><label class="m-field"><span>Asunto</span><input id="${prefix}Title" class="m-input" value="${esc(row.title||'')}" placeholder="Llamar al cliente"></label><label class="m-field"><span>Fecha y hora</span><input id="${prefix}Starts" class="m-input" type="datetime-local" value="${esc(taskLocalValue(row.starts_at))}"></label><label class="m-field"><span>Recordatorio (opcional)</span><input id="${prefix}Reminder" class="m-input" type="datetime-local" value="${esc(taskLocalValue(row.reminder_at))}"></label><label class="m-field"><span>Notas</span><textarea id="${prefix}Notes" class="m-textarea">${esc(row.description||'')}</textarea></label><label class="m-task-option"><input id="${prefix}NotifyApp" type="checkbox" ${row.notify_in_app!==false?'checked':''}> Aviso en The Phone Face</label><label class="m-task-option"><input id="${prefix}NotifyEmail" type="checkbox" ${row.notify_email?'checked':''}> Email</label><label class="m-task-option"><input id="${prefix}Google" type="checkbox" ${row.sync_google_calendar?'checked':''}> Añadir a Google Calendar</label></div>`;
  }
  function readTaskFields(prefix){
    const title=clean(byId(prefix+'Title')?.value),starts=byId(prefix+'Starts')?.value,reminder=byId(prefix+'Reminder')?.value;
    if(!title||!starts)throw new Error('Escribe un asunto y una fecha/hora.');
    if(!Number.isFinite(new Date(starts).getTime())||(reminder&&!Number.isFinite(new Date(reminder).getTime())))throw new Error('La fecha no es válida.');
    return {...readTaskTypeFields(prefix),title,description:clean(byId(prefix+'Notes')?.value)||null,starts_at:new Date(starts).toISOString(),reminder_at:reminder?new Date(reminder).toISOString():null,notify_in_app:!!byId(prefix+'NotifyApp')?.checked,notify_email:!!byId(prefix+'NotifyEmail')?.checked,sync_google_calendar:!!byId(prefix+'Google')?.checked};
  }
  function renderNewTask(contactId){
    const contact=state.contacts.find(row=>String(row.id)===String(contactId));if(!contact||!has('can_manage_agenda'))return `<div class="m-page">${pageHead('Nueva tarea',mobileWaReturnPath(contactId,'task'))}${empty('No disponible','No tienes permiso o el contacto no existe.')}</div>`;
    const back=mobileWaReturnPath(contactId,'task');
    return `<div class="m-page">${pageHead('Nueva tarea',back)}<p class="m-subtitle" style="margin-bottom:16px">Tarea para ${esc(contact.fullName)} · ${esc(contact.phone||'Sin teléfono')}</p>${taskFields('newTask',{title:'Llamar a '+contact.fullName,starts_at:new Date(Date.now()+3600000)})}<button class="m-primary m-library-full" data-action="save-task" data-contact-id="${esc(contactId)}">Crear tarea</button><p id="mobileTaskMsg" class="m-form-msg"></p></div>`;
  }
  function ensureTaskDetail(id){if(!has('can_view_agenda')&&!has('can_manage_agenda'))return;if(taskDetail.id!==String(id))loadTaskDetail(id);}
  async function loadTaskDetail(id){
    if(!has('can_view_agenda')&&!has('can_manage_agenda'))return;
    const editor={id:String(id),row:null,loading:true,error:''};taskDetail=editor;
    try{const result=await client.from('agenda_items').select('*').eq('id',id).or('whatsapp_enabled.is.null,whatsapp_enabled.eq.false').single();if(result.error)throw result.error;editor.row=result.data;}
    catch(error){editor.error=error?.message||'No se pudo cargar la tarea.';}
    finally{editor.loading=false;if(taskDetail===editor&&route().parts[0]==='task'&&route().parts[1]===String(id))render();}
  }
  function renderTaskDetail(id){
    const head=pageHead('Detalle de tarea','tasks');
    if(!has('can_view_agenda')&&!has('can_manage_agenda'))return `<div class="m-page">${head}${empty('Acceso restringido','No tienes permiso para ver tareas.')}</div>`;
    const editor=taskDetail;if(editor.id!==String(id)||editor.loading)return `<div class="m-page">${head}${skeleton()}</div>`;
    if(!editor.row)return `<div class="m-page">${head}${empty('No disponible',editor.error||'La tarea ya no existe.')}<button class="m-secondary" data-action="reload-task" data-id="${esc(id)}">Reintentar</button></div>`;
    const row=editor.row,canEdit=has('can_manage_agenda');
    return `<div class="m-page">${head}<p class="m-subtitle" style="margin-bottom:16px">${esc(row.customer_name||'Sin contacto')} · ${esc(row.customer_phone||'Sin teléfono')} · ${row.status==='completed'?'Completada':row.status==='cancelled'?'Cancelada':'Pendiente'}</p><fieldset class="m-edit-fields" ${canEdit?'':'disabled'}>${taskFields('editTask',row)}</fieldset>${canEdit?`<div class="m-detail-actions"><button class="m-primary" data-action="save-task-detail" data-id="${esc(id)}">Guardar cambios</button><button class="m-secondary" data-action="task-status" data-id="${esc(id)}">${row.status==='completed'?'Reabrir tarea':'Marcar completada'}</button><button class="m-danger" data-action="delete-task" data-id="${esc(id)}">Eliminar tarea</button></div>`:''}<p id="mobileTaskDetailMsg" class="m-form-msg"></p></div>`;
  }
  function mergeTaskChange(id,row){
    if(row){const index=state.tasks.findIndex(item=>String(item.id)===String(id));if(index>=0)state.tasks[index]=row;else state.tasks.push(row);}
    else state.tasks=state.tasks.filter(item=>String(item.id)!==String(id));
    state.agenda.requestId++;state.agenda.loaded=false;state.agenda.loading=false;
    updateAlertDot();
  }
  async function saveTaskDetail(id,statusOnly=false){
    const editor=taskDetail;if(!has('can_manage_agenda')||editor.id!==String(id)||!editor.row||taskWrites.has(String(id)))return;
    const msg=byId('mobileTaskDetailMsg');let patch;
    try{patch=statusOnly?{status:editor.row.status==='completed'?'pending':'completed'}:readTaskFields('editTask');}catch(error){if(msg)msg.textContent=error.message;return;}
    taskWrites.add(String(id));if(msg)msg.textContent='Guardando…';
    try{const result=await client.from('agenda_items').update(patch).eq('id',id).or('whatsapp_enabled.is.null,whatsapp_enabled.eq.false').select('*').single();if(result.error)throw result.error;editor.row=result.data;mergeTaskChange(id,result.data);if(taskDetail===editor&&route().parts[0]==='task'&&route().parts[1]===String(id)){render();toast('Tarea guardada.','success');}}
    catch(error){if(msg)msg.textContent=error?.message||'No se pudo guardar.';}
    finally{taskWrites.delete(String(id));}
  }
  async function deleteTask(id){
    const row=(taskDetail.id===String(id)&&taskDetail.row)||state.tasks.find(item=>String(item.id)===String(id))||state.agenda.rows.find(item=>String(item.id)===String(id));
    if(!row||row.whatsapp_enabled||!has('can_manage_agenda')||taskWrites.has(String(id))||!confirm(`¿Eliminar la tarea "${row.title||'Sin título'}"?`))return;
    taskWrites.add(String(id));
    try{const result=await client.from('agenda_items').delete().eq('id',id).or('whatsapp_enabled.is.null,whatsapp_enabled.eq.false').select('id').single();if(result.error)throw result.error;mergeTaskChange(id,null);if(taskDetail.id===String(id))taskDetail={id:'',row:null,loading:false,error:''};if(route().parts[0]==='task'&&route().parts[1]===String(id)){state.profileTab='tasks';go(row.related_record_id?`contact/${row.related_record_id}`:'tasks',true);}else render();toast('Tarea eliminada.','success');}
    catch(error){toast(error?.message||'No se pudo eliminar la tarea.','error');}
    finally{taskWrites.delete(String(id));}
  }
  async function saveTask(contactId){
    const contact=state.contacts.find(row=>String(row.id)===String(contactId)),msg=byId('mobileTaskMsg');if(!contact||!has('can_manage_agenda')){if(msg)msg.textContent='No tienes permiso o el contacto ya no existe.';return;}const title=clean(byId('newTaskTitle')?.value),starts=byId('newTaskStarts')?.value;
    if(!title||!starts){if(msg)msg.textContent='Escribe un asunto y una fecha.';return;}
    const back=mobileWaReturnPath(contact.id,'task');
    const button=document.querySelector('[data-action="save-task"]');button.disabled=true;byId('mobileTaskMsg').textContent='Guardando…';
    try{
      const row={title,description:clean(byId('newTaskNotes').value)||null,customer_name:contact.fullName||null,customer_phone:contact.phone||null,starts_at:new Date(starts).toISOString(),reminder_at:null,assigned_to:state.user.id,related_record_id:contact.id,status:'pending',reminder_minutes:[],notify_in_app:true,notify_email:false,sync_google_calendar:false,whatsapp_enabled:false,...readTaskFields('newTask')};
      const {error}=await client.from('agenda_items').insert(row).select('id').single();if(error)throw error;await refreshData({silent:true});if(back.startsWith('whatsapp-chat/'))go(back,true);else{state.profileTab='tasks';go(`contact/${contact.id}`,back==='choose-contact/task');}toast('Tarea creada y sincronizada.','success');
    }catch(error){byId('mobileTaskMsg').textContent=error?.message||'No se pudo crear la tarea.';}
    finally{button.disabled=false;}
  }

  function mobileWaQueryChatId(){
    const chatId=clean(route().query.get('chat'));return /^[^/?#]+@(c\.us|g\.us|lid)$/i.test(chatId)?chatId:'';
  }
  function mobileWaChatPath(chatId){return `whatsapp-chat/${encodeURIComponent(String(chatId||''))}`;}
  function mobileWaReturnPath(contactId,kind=''){const chatId=mobileWaQueryChatId();if(chatId)return mobileWaChatPath(chatId);if(route().query.get('origin')==='quick'&&['task','opportunity'].includes(kind))return `choose-contact/${kind}`;return `contact/${contactId}`;}
  function renderContactOpportunity(contactId){
    const contact=state.contacts.find(row=>String(row.id)===String(contactId)),back=mobileWaReturnPath(contactId,'opportunity');
    if(!contact||!has('can_view_sales')||!has('can_edit_sales'))return `<div class="m-page">${pageHead('Nueva oportunidad',back)}${empty('No disponible','No tienes permiso o el contacto no existe.')}</div>`;
    if(!state.board.stages.length)return `<div class="m-page">${pageHead('Nueva oportunidad',back)}${empty('Sin columnas','Crea primero una columna en el Panel de ventas del CRM.')}</div>`;
    return `<div class="m-page">${pageHead('Nueva oportunidad',back)}<p class="m-subtitle" style="margin-bottom:16px">Oportunidad para ${esc(contact.fullName)}</p><div class="m-form-grid"><label class="m-field"><span>Nombre de oportunidad</span><input id="contactOppTitle" class="m-input" value="${esc(`Oportunidad - ${contact.fullName}`)}"></label><label class="m-field"><span>Columna / Estado</span><select id="contactOppStage" class="m-select">${state.board.stages.map(stage=>`<option value="${esc(stage.id)}">${esc(stage.name)}</option>`).join('')}</select></label><label class="m-field"><span>Fecha de cierre prevista</span><input id="contactOppDate" class="m-input" type="date"></label><label class="m-field"><span>Importe (opcional)</span><input id="contactOppAmount" class="m-input" inputmode="decimal" placeholder="0,00"></label><label class="m-field"><span>Notas</span><textarea id="contactOppNotes" class="m-textarea"></textarea></label></div>${window.TPFContactParty.html('contactOppParty',contact.data?.TPF_TITULAR,true)}<button class="m-primary" style="width:100%;margin-top:18px" data-action="save-contact-opportunity" data-contact-id="${esc(contactId)}">Crear oportunidad</button><p id="mobileContactOppMsg" class="m-form-msg"></p></div>`;
  }
  async function saveContactOpportunity(contactId){
    const contact=state.contacts.find(row=>String(row.id)===String(contactId)),title=clean(byId('contactOppTitle')?.value),stageId=byId('contactOppStage')?.value,stage=state.board.stages.find(row=>String(row.id)===String(stageId)),msg=byId('mobileContactOppMsg');
    if(!contact||!has('can_view_sales')||!has('can_edit_sales')){if(msg)msg.textContent='No tienes permiso o el contacto ya no existe.';return;}
    if(!title||!stage){if(msg)msg.textContent='Escribe un nombre y selecciona una columna.';return;}
    const rawAmount=clean(byId('contactOppAmount')?.value).replace(',','.'),amount=rawAmount===''?0:Number(rawAmount);if(!Number.isFinite(amount)){if(msg)msg.textContent='El importe no es válido.';return;}
    const back=mobileWaReturnPath(contact.id,'opportunity'),button=document.querySelector('[data-action="save-contact-opportunity"]');if(button)button.disabled=true;if(msg)msg.textContent='Guardando…';
    try{
      const row={contract_party:window.TPFContactParty.snapshot(window.TPFContactParty.read('contactOppParty'),contact),pipeline_id:stage.pipeline_id,stage_id:stage.id,record_id:contact.id,title,client_name:contact.fullName||null,phone:contact.phone||null,amount,expected_date:byId('contactOppDate')?.value||null,owner_user_id:state.user.id,notes:clean(byId('contactOppNotes')?.value)||null};
      const {error}=await client.from('sales_opportunities').insert(row).select('id').single();if(error)throw error;await refreshData({silent:true});if(back.startsWith('whatsapp-chat/'))go(back,true);else{state.profileTab='opportunities';go(`contact/${contact.id}`,back==='choose-contact/opportunity');}toast('Oportunidad creada y sincronizada.','success');
    }catch(error){if(msg)msg.textContent=error?.message||'No se pudo crear la oportunidad.';}
    finally{if(button)button.disabled=false;}
  }

  function renderAlertFilters(counts,active=state.alertFilter){
    const options=[['all','Todos'],['overdue','Vencidos'],['today','Hoy'],['upcoming','Próximos'],['tasks','Tareas'],['opportunities','Ventas']];
    return options.map(([key,label])=>`<button class="m-alert-filter ${active===key?'active':''}" data-action="alert-filter" data-filter="${key}" type="button" aria-pressed="${active===key}"><span>${label}</span><b>${counts[key]||0}</b></button>`).join('');
  }
  function alertCard(item){
    const row=item.row,label=item.category==='overdue'?'Vencida':item.category==='today'?'Hoy':'Próxima';
    if(item.type==='task'){
      const contact=state.contacts.find(value=>String(value.id)===String(row.related_record_id));
      return `<article class="m-alert-card m-alert-task"><div class="m-alert-card-head"><span class="m-avatar">▣</span><span class="m-alert-main"><strong>${esc(row.title||'Tarea')}</strong><small>${esc(row.customer_name||contact?.fullName||'Sin contacto')} · ${esc(dateTime(row.starts_at))}</small></span><span class="m-alert-badge ${item.category}">${label}</span></div>${row.description?`<p class="m-alert-description">${esc(row.description)}</p>`:''}<div class="m-alert-actions">${has('can_manage_agenda')?`<button class="m-secondary" data-action="complete-task" data-id="${esc(row.id)}" type="button">Completar</button>`:''}${contact?`<button class="m-secondary" data-action="route" data-route="contact/${esc(contact.id)}" type="button">Ver contacto</button>`:'<button class="m-secondary" data-action="open-tasks" data-filter="pending" type="button">Ver tareas</button>'}</div></article>`;
    }
    return `<button class="m-alert-card m-alert-opportunity" data-action="route" data-route="opportunity/${esc(row.id)}" type="button"><span class="m-alert-card-head"><span class="m-avatar">◇</span><span class="m-alert-main"><strong>${esc(row.title||'Oportunidad')}</strong><small>${esc(row.client_name||'Sin contacto')} · cierre ${esc(opportunityDateLabel(row))}</small></span><span class="m-alert-badge ${item.category}">${label}</span></span><span class="m-alert-meta"><span><small>Importe</small><b>${row.amount!=null?esc(money(row.amount)):'Sin importe'}</b></span><span><small>Columna</small><b>${esc(item.stage?.name||'Sin columna')}</b></span></span></button>`;
  }
  function alertResultText(model){
    const shown=Math.min(model.rows.length,Math.max(ALERT_PAGE_SIZE,state.alertLimit||ALERT_PAGE_SIZE));
    return shown<model.rows.length?`Mostrando ${shown} de ${model.rows.length} avisos`:`${model.rows.length} ${model.rows.length===1?'aviso':'avisos'}`;
  }
  function alertRowsHtml(model){
    const shown=model.rows.slice(0,Math.max(ALERT_PAGE_SIZE,state.alertLimit||ALERT_PAGE_SIZE));
    if(shown.length)return `<div class="m-alert-list">${shown.map(alertCard).join('')}</div>${shown.length<model.rows.length?`<button class="m-secondary m-alert-more" data-action="alert-more" type="button">Mostrar ${Math.min(ALERT_PAGE_SIZE,model.rows.length-shown.length)} más</button>`:''}`;
    if(!model.items.length)return empty('Todo al día','No hay tareas ni oportunidades con fecha pendiente.');
    return empty('Sin avisos en este filtro','Prueba con otro filtro.');
  }
  function renderAlerts(){
    const model=noticeListModel();
    return `<div class="m-page m-alerts-page">${pageHead('Centro de avisos','home','<button class="m-back" data-action="refresh" type="button" aria-label="Actualizar avisos">↻</button>')}<div id="mobileAlertFilters" class="m-alert-filters" role="group" aria-label="Filtrar avisos">${renderAlertFilters(model.counts,model.active)}</div><p id="mobileAlertResultCount" class="m-alert-result-count" aria-live="polite" aria-atomic="true">${alertResultText(model)}</p><div id="mobileAlertsList">${alertRowsHtml(model)}</div></div>`;
  }
  function updateAlertResults(){
    const model=noticeListModel(),filters=byId('mobileAlertFilters'),count=byId('mobileAlertResultCount'),list=byId('mobileAlertsList');
    if(filters)filters.innerHTML=renderAlertFilters(model.counts,model.active);
    if(count)count.textContent=alertResultText(model);
    if(list)list.innerHTML=alertRowsHtml(model);
  }

  function ensureDraft(){
    if(state.draft)return;
    const firstStage=state.board.stages[0];
    state.draft={contact:{first:'',last:'',dni:'',phone:'',email:'',bank:'',observations:'',notes:''},opportunity:{title:'',stageId:firstStage?.id||'',expectedDate:'',amount:'',notes:'',reminder:true},includeOpportunity:true,duplicates:[]};
  }
  function resetDraft(){
    stopGuidedCamera();
    if(state.scanUrl)URL.revokeObjectURL(state.scanUrl);
    state.scanFile=null;state.scanUrl='';state.ocrDebugText='';state.cameraError='';state.cameraPaused=false;state.draft=null;state.createdContactId=null;state.createdOpportunityId=null;state.creationError=null;state.creating=false;ensureDraft();
  }
  function stopGuidedCamera(){
    mobileCameraRequestId+=1;mobileCameraStarting=false;mobileCameraCapturing=false;
    if(mobileCameraStream){mobileCameraStream.getTracks?.().forEach(track=>track.stop());mobileCameraStream=null;}
    const video=byId('mobileCameraPreview');if(video){video.onloadedmetadata=null;video.srcObject=null;}
  }
  function guidedCameraCrop(videoWidth,videoHeight,stageWidth,stageHeight,frame){
    const vw=Math.max(1,Number(videoWidth)||1),vh=Math.max(1,Number(videoHeight)||1),sw=Math.max(1,Number(stageWidth)||1),sh=Math.max(1,Number(stageHeight)||1),scale=Math.max(sw/vw,sh/vh),shownWidth=vw*scale,shownHeight=vh*scale,offsetX=(shownWidth-sw)/2,offsetY=(shownHeight-sh)/2;
    const x=Math.max(0,Math.min(vw-1,(Number(frame?.x||0)+offsetX)/scale)),y=Math.max(0,Math.min(vh-1,(Number(frame?.y||0)+offsetY)/scale));
    const width=Math.max(1,Math.min(vw-x,Number(frame?.width||sw)/scale)),height=Math.max(1,Math.min(vh-y,Number(frame?.height||sh)/scale));
    return {x,y,width,height};
  }
  function setGuidedCameraStatus(message,ready=false){
    const status=byId('mobileCameraStatus'),button=byId('mobileCapturePhoto');if(status)status.textContent=message;if(button)button.disabled=!ready;
  }
  function guidedCameraErrorMessage(error){const name=String(error?.name||'');if(name==='NotAllowedError'||name==='SecurityError')return 'No se ha permitido usar la cámara.';if(name==='NotFoundError'||name==='OverconstrainedError')return 'No se ha encontrado una cámara disponible.';if(name==='NotReadableError'||name==='AbortError')return 'La cámara está ocupada por otra aplicación.';return error?.message||'No se pudo abrir la cámara.';}
  async function startGuidedCamera(){
    if(!has('can_create_database')||!has('can_view_database')||state.scanFile||route().parts[0]!=='scan'||document.hidden)return;
    const video=byId('mobileCameraPreview');if(!video)return;
    if(mobileCameraStream){video.srcObject=mobileCameraStream;const retryPlayback=video.play?.();if(retryPlayback?.catch)await retryPlayback.catch(()=>{});if(video.videoWidth&&video.videoHeight)setGuidedCameraStatus('Coloca los datos dentro del recuadro y pulsa “Hacer foto”.',true);return;}if(mobileCameraStarting)return;
    if(typeof navigator==='undefined'||!navigator.mediaDevices?.getUserMedia){state.cameraError='La cámara integrada no está disponible en este navegador.';setGuidedCameraStatus(`${state.cameraError} Usa “Cámara del móvil”.`);return;}
    const requestId=++mobileCameraRequestId;mobileCameraStarting=true;state.cameraError='';setGuidedCameraStatus('Abriendo la cámara trasera…');
    try{
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false});
      if(requestId!==mobileCameraRequestId||route().parts[0]!=='scan'||state.scanFile){stream.getTracks?.().forEach(track=>track.stop());return;}
      mobileCameraStream=stream;video.srcObject=stream;stream.getTracks?.().forEach(track=>track.addEventListener?.('ended',()=>{if(mobileCameraStream===stream){mobileCameraStream=null;setGuidedCameraStatus('La cámara se ha detenido. Pulsa “Activar cámara” para continuar.');}}));const playback=video.play?.();if(playback?.catch)await playback.catch(()=>{});
      const ready=()=>{if(requestId===mobileCameraRequestId&&mobileCameraStream===stream&&byId('mobileCameraPreview')===video)setGuidedCameraStatus('Coloca los datos dentro del recuadro y pulsa “Hacer foto”.',true);};
      if(video.videoWidth&&video.videoHeight)ready();else video.onloadedmetadata=ready;
    }catch(error){
      if(requestId!==mobileCameraRequestId)return;state.cameraError=guidedCameraErrorMessage(error);setGuidedCameraStatus(`${state.cameraError} Puedes reintentar o usar “Cámara del móvil”.`);
    }finally{if(requestId===mobileCameraRequestId)mobileCameraStarting=false;}
  }
  function initGuidedCamera(){if(!has('can_create_database')||!has('can_view_database')||state.scanFile||state.cameraPaused){stopGuidedCamera();return;}startGuidedCamera();}
  async function captureGuidedPhoto(){
    if(mobileCameraCapturing)return;const video=byId('mobileCameraPreview'),stage=byId('mobileCameraStage'),guide=byId('mobileCameraGuide');
    if(!mobileCameraStream||!video?.videoWidth||!video?.videoHeight||!stage||!guide){toast('La cámara todavía no está preparada.','error');return;}
    const requestId=mobileCameraRequestId,button=byId('mobileCapturePhoto');mobileCameraCapturing=true;if(button)button.disabled=true;
    try{const stageRect=stage.getBoundingClientRect(),guideRect=guide.getBoundingClientRect(),crop=guidedCameraCrop(video.videoWidth,video.videoHeight,stageRect.width,stageRect.height,{x:guideRect.left-stageRect.left,y:guideRect.top-stageRect.top,width:guideRect.width,height:guideRect.height});const canvas=document.createElement('canvas'),resize=Math.min(1,1800/Math.max(crop.width,crop.height));canvas.width=Math.max(1,Math.round(crop.width*resize));canvas.height=Math.max(1,Math.round(crop.height*resize));const context=canvas.getContext('2d');if(!context)throw new Error('No se pudo preparar la foto.');context.drawImage(video,crop.x,crop.y,crop.width,crop.height,0,0,canvas.width,canvas.height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.92));if(requestId!==mobileCameraRequestId)return;if(!blob)throw new Error('No se pudo capturar la foto.');const file=typeof File==='function'?new File([blob],`contacto-${Date.now()}.jpg`,{type:'image/jpeg'}):blob;stopGuidedCamera();await handleImage(file);}catch(error){toast(error?.message||'No se pudo capturar la foto.','error');}
    finally{mobileCameraCapturing=false;if(route().parts[0]==='scan'&&!state.scanFile&&mobileCameraStream&&button)button.disabled=false;}
  }
  function repeatGuidedPhoto(){
    if(state.scanUrl)URL.revokeObjectURL(state.scanUrl);state.scanFile=null;state.scanUrl='';state.ocrDebugText='';state.cameraError='';state.cameraPaused=false;go('scan');
  }
  function renderScan(){
    if(!has('can_create_database')||!has('can_view_database'))return `<div class="m-page">${pageHead('Escanear contacto','home')}${empty('Acceso restringido','No tienes permiso para crear contactos.')}</div>`;
    const targets='<div class="m-camera-targets"><strong>Incluye dentro del recuadro</strong><div><span>Nombre y apellidos</span><span>DNI / NIF</span><span>Teléfono</span></div><small>La foto se procesa en este dispositivo y no se guarda en el CRM.</small></div>';
    if(state.scanFile)return `<div class="m-page m-scan-page">${pageHead('Revisar foto','home')}<div class="m-camera-stage m-camera-review"><img src="${esc(state.scanUrl)}" alt="Foto del contacto preparada para revisar"></div>${targets}<div class="m-camera-actions"><button class="m-secondary" data-action="repeat-photo" type="button">Repetir foto</button><button class="m-primary" data-action="analyse-scan" type="button">Usar foto</button></div><button class="m-ghost m-camera-gallery" data-action="gallery" type="button">Elegir otra de Fototeca</button><div id="mobileOcrProgress"></div></div>`;
    return `<div class="m-page m-scan-page">${pageHead('Escanear contacto','home')}<p class="m-subtitle m-camera-intro">Coloca dentro del recuadro el documento o la pantalla completa donde aparecen estos datos.</p><div id="mobileCameraStage" class="m-camera-stage m-camera-live"><video id="mobileCameraPreview" autoplay playsinline muted aria-label="Vista previa de la cámara"></video><div id="mobileCameraGuide" class="m-camera-guide" aria-hidden="true"><i></i><i></i><i></i><i></i><span>Datos del contacto</span></div></div>${targets}<p id="mobileCameraStatus" class="m-camera-status" role="status" aria-live="polite">${esc(state.cameraPaused?'La cámara se ha detenido. Pulsa “Activar cámara” para continuar.':state.cameraError||'Abriendo la cámara trasera…')}</p><div class="m-camera-actions"><button id="mobileCapturePhoto" class="m-primary" data-action="capture-photo" type="button" disabled>Hacer foto</button><button class="m-secondary" data-action="start-camera" type="button">Activar cámara</button></div><div class="m-camera-fallbacks"><button class="m-secondary" data-action="camera" type="button">Cámara del móvil</button><button class="m-secondary" data-action="gallery" type="button">Fototeca</button></div><button class="m-ghost m-camera-gallery" data-action="manual-contact" type="button">Escribir datos manualmente</button></div>`;
  }
  async function handleImage(file){
    if(!file)return;stopGuidedCamera();if(state.scanUrl)URL.revokeObjectURL(state.scanUrl);state.ocrDebugText='';state.cameraError='';state.cameraPaused=false;state.scanFile=file;state.scanUrl=URL.createObjectURL(file);go('scan');
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
    let contact;try{contact=await captureDraftContact();}catch(error){byId('mobileDetectedMsg').textContent=error.message;return;}
    try{const {data,error}=await client.rpc('find_possible_duplicate_contact',{phone_text:contact.phone||null,dni_text:contact.dni||null,email_text:contact.email||null});if(error)throw error;state.draft.duplicates=data||[];render();return state.draft.duplicates;}catch(error){byId('mobileDetectedMsg').textContent=error?.message||'No se pudo comprobar.';return [];}
  }
  async function continueDetected(){
    let contact;try{contact=await captureDraftContact();}catch(error){byId('mobileDetectedMsg').textContent=error.message;return;}if(!contact.first&&!contact.last){byId('mobileDetectedMsg').textContent='Escribe el nombre o los apellidos.';return;}
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
        const data={'TPF_TITULAR':contact.party,'NOMBRE':contact.first,'APELLIDOS':contact.last,'NOMBRE Y APELLIDOS':fullName,'TELÉFONO':contact.phone,'DNI / NIF':contact.dni,'DNI':contact.dni,'EMAIL':contact.email,'BANCO':contact.bank,'NOTAS':contact.notes,'OBSERVACIONES':contact.observations};
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
    const number=contactPhoneNumber(mobileWaNormalizePhone(chatId));if(!number)return null;
    const matches=state.contacts.filter(contact=>contactPhones(contact).some(phone=>phone.number===number));
    const current=route(),origin=current.query.get('fromContact');
    if(current.parts[0]==='whatsapp-chat'&&safeDecode(current.parts[1])===String(chatId)&&origin){const selected=matches.find(contact=>String(contact.id)===origin);if(selected)return selected;}
    return matches.length===1?matches[0]:null;
  }
  function mobileWaContactChat(chatId){
    const chat=mobileWaSelectedChat(chatId),contact=mobileWaFindContact(chatId);
    return contact?{...chat,name:contact.fullName}:chat;
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
    const timer=controller?setTimeout(()=>controller.abort(),action==='summary'?65000:['state','chats','history'].includes(action)?35000:20000):null;
    try{
      const response=await fetch(`/api/mobile-green?action=${encodeURIComponent(action)}`,{method,headers:{Authorization:`Bearer ${token}`,...(method==='POST'?{'Content-Type':'application/json'}:{})},body:method==='POST'?JSON.stringify(payload||{}):undefined,cache:'no-store',signal:controller?.signal});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||result?.ok===false){const requestError=new Error(result?.error||`WhatsApp no respondió (${response.status}).`);requestError.status=response.status;throw requestError;}
      return result;
    }catch(error){if(error?.name==='AbortError')throw new Error('WhatsApp está tardando demasiado. Pulsa Actualizar para volver a intentarlo.');throw error;}
    finally{if(timer)clearTimeout(timer);}
  }
  function updateMobileWaListDom(){
    updateMobileWhatsAppNav();
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
    if(contact)return `<span>${esc(contact.fullName)}${contact.dni?` · DNI: ${esc(contact.dni)}`:''}</span><button class="m-secondary" data-action="route" data-route="contact/${esc(contact.id)}" type="button">Ver ficha</button>`;
    if(has('can_create_database')&&has('can_view_database'))return `<span>No está en Contactos</span><button class="m-secondary" data-action="wa-create-contact" data-chat-id="${esc(chat.id)}" type="button">Crear contacto</button>`;
    return '<span>No está vinculado a Contactos.</span>';
  }
  function mobileWaSheetFrame(title,body){
    return `<button class="m-wa-sheet-backdrop" data-action="wa-close-sheet" type="button" aria-label="Cerrar acciones"></button><section class="m-wa-sheet" role="dialog" aria-modal="true" aria-labelledby="mobileWaSheetTitle"><div class="m-wa-sheet-head"><h2 id="mobileWaSheetTitle">${esc(title)}</h2><button class="m-wa-sheet-close" data-action="wa-close-sheet" type="button" aria-label="Cerrar">×</button></div>${body}</section>`;
  }
  function setMobileWaSheet(kind,title,body,chatId=state.whatsapp.selectedId){
    const root=byId('mobileWaActionSheet');if(!root)return;root.dataset.kind=kind;root.dataset.chatId=String(chatId||'');root.innerHTML=mobileWaSheetFrame(title,body);root.classList.remove('hidden');root.setAttribute('aria-hidden','false');applyMobileWaSheetFilters(root);const app=byId('mobileApp');if(app)app.inert=true;setTimeout(()=>root.querySelector('.m-wa-sheet-close,[data-action]:not(:disabled)')?.focus(),0);
  }
  function closeMobileWaSheet(restoreFocus=true){
    const root=byId('mobileWaActionSheet');if(!root)return;root.classList.add('hidden');root.setAttribute('aria-hidden','true');root.innerHTML='';delete root.dataset.kind;delete root.dataset.chatId;const app=byId('mobileApp');if(app)app.inert=false;const trigger=mobileWaSheetTrigger;mobileWaSheetTrigger=null;if(trigger)trigger.setAttribute('aria-expanded','false');if(restoreFocus&&trigger?.focus)setTimeout(()=>trigger.focus(),0);
  }
  function mobileWaSheetChatId(){const root=byId('mobileWaActionSheet'),chatId=clean(root?.dataset?.chatId);return chatId&&chatId===String(state.whatsapp.selectedId||'')?chatId:'';}
  function mobileWaActionOption(action,icon,title,detail,enabled=true){return `<button class="m-wa-sheet-option" data-action="${esc(action)}" type="button"${enabled?'':' disabled'}><span class="m-wa-sheet-icon" aria-hidden="true">${esc(icon)}</span><span><b>${esc(title)}</b><small>${esc(detail)}</small></span><i aria-hidden="true">›</i></button>`;}
  function renderMobileQuickActions(){
    const canCreate=has('can_create_database')&&has('can_view_database'),hasContacts=state.contacts.length>0;
    const canOpportunity=has('can_view_database')&&has('can_view_sales')&&has('can_edit_sales')&&hasContacts&&state.board.stages.length>0;
    const canTask=has('can_view_database')&&has('can_manage_agenda')&&hasContacts;
    const opportunityHint=!has('can_view_database')||!has('can_view_sales')||!has('can_edit_sales')?'No tienes permiso para crear oportunidades':!hasContacts?'Crea primero un contacto':!state.board.stages.length?'No hay columnas de ventas configuradas':'Elige el contacto y completa los datos';
    const taskHint=!has('can_view_database')||!has('can_manage_agenda')?'No tienes permiso para crear tareas':!hasContacts?'Crea primero un contacto':'Elige el contacto y programa la tarea';
    return `<div class="m-wa-sheet-options">${mobileWaActionOption('quick-scan','▧','Escanear contacto',canCreate?'Haz una foto dentro del marco guiado':'No tienes permiso para crear contactos',canCreate)}${mobileWaActionOption('quick-manual','＋','Crear contacto manualmente',canCreate?'Escribe y revisa todos los datos':'No tienes permiso para crear contactos',canCreate)}${mobileWaActionOption('quick-opportunity','◇','Nueva oportunidad',opportunityHint,canOpportunity)}${mobileWaActionOption('quick-task','▣','Nueva tarea',taskHint,canTask)}${mobileWaActionOption('quick-templates','▤','Plantillas',has('can_manage_templates')?'Abre la biblioteca móvil':'No tienes permiso para gestionar plantillas',has('can_manage_templates'))}${mobileWaActionOption('quick-labels','◆','Etiquetas',has('can_manage_labels')?'Organiza y asigna etiquetas':'No tienes permiso para gestionar etiquetas',has('can_manage_labels'))}</div>`;
  }
  function openMobileQuickActions(trigger){
    if(route().parts[0]==='scan'){stopGuidedCamera();setGuidedCameraStatus('La cámara se ha detenido. Pulsa “Activar cámara” para continuar.');}mobileWaSheetTrigger=trigger||null;if(trigger)trigger.setAttribute('aria-expanded','true');setMobileWaSheet('quick-actions','Crear y gestionar',renderMobileQuickActions(),'');
  }
  function renderMobileWaActions(){
    const chatId=state.whatsapp.selectedId,contact=mobileWaFindContact(chatId),linked=!!contact,linkHint=linked?contact.fullName:'Primero crea o vincula el contacto';
    return `<div class="m-wa-sheet-options">${mobileWaActionOption('wa-choose-file','⌁','Foto o archivo','Envía una imagen, vídeo, audio o documento')}${mobileWaActionOption('wa-show-templates','▤','Usar plantilla',has('can_manage_templates')?'Prepara un texto guardado':'No tienes permiso para usar plantillas',has('can_manage_templates'))}${mobileWaActionOption('wa-create-task','▣','Crear tarea',linked?(has('can_manage_agenda')?`Vinculada a ${linkHint}`:'No tienes permiso para crear tareas'):linkHint,linked&&has('can_manage_agenda'))}${mobileWaActionOption('wa-create-opportunity','◇','Crear oportunidad',linked?(has('can_view_sales')&&has('can_edit_sales')?`Vinculada a ${linkHint}`:'No tienes permiso para crear oportunidades'):linkHint,linked&&has('can_view_sales')&&has('can_edit_sales'))}${mobileWaActionOption('wa-show-labels','◆','Añadir etiqueta',linked?(has('can_manage_labels')?`Gestiona las etiquetas de ${linkHint}`:'No tienes permiso para gestionar etiquetas'):linkHint,linked&&has('can_manage_labels'))}</div>`;
  }
  function openMobileWaActions(trigger){
    if(!state.whatsapp.selectedId||state.whatsapp.sending)return;mobileWaSheetTrigger=trigger||null;if(trigger)trigger.setAttribute('aria-expanded','true');setMobileWaSheet('actions','Acciones del chat',renderMobileWaActions());
  }
  function mobileWaFilterText(value){return clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').replace(/\s+/g,' ');}
  function mobileWaMatchesFilter(values,query){const needle=mobileWaFilterText(query);if(!needle)return true;const haystack=mobileWaFilterText(values.filter(Boolean).join(' '));return haystack.includes(needle)||haystack.replace(/\s/g,'').includes(needle.replace(/\s/g,''));}
  function mobileWaTemplateCategory(template){return clean(template?.category)||'Sin categoría';}
  function mobileWaTemplateCategories(){return [...new Set(state.whatsapp.templates.map(mobileWaTemplateCategory))].sort((a,b)=>a.localeCompare(b,'es'));}
  function mobileWaFilteredTemplates(){const query=state.whatsapp.templateQuery,category=state.whatsapp.templateCategory;return state.whatsapp.templates.map((template,index)=>({template,index})).filter(({template})=>{const current=mobileWaTemplateCategory(template);return (!category||current===category)&&mobileWaMatchesFilter([template.name,template.text,template.shortcut,current],query);});}
  function mobileWaInferLabelCategory(name){const value=mobileWaFilterText(name);if(value.includes('vodafone'))return 'Vodafone';if(value.includes('orange'))return 'Orange';if(value.includes('masmovil')||value.includes('mas movil'))return 'MásMóvil';if(value.includes('yoigo'))return 'Yoigo';return 'Otras';}
  function mobileWaLabelCategories(){return [...new Set(state.whatsapp.labels.map(label=>clean(label.category)||mobileWaInferLabelCategory(label.name)))].sort((a,b)=>a.localeCompare(b,'es'));}
  function mobileWaFilteredLabels(){const query=state.whatsapp.labelQuery,category=state.whatsapp.labelCategory;return state.whatsapp.labels.filter(label=>{const current=clean(label.category)||mobileWaInferLabelCategory(label.name);return (!category||current===category)&&mobileWaMatchesFilter([label.name,current],query);});}
  function mobileWaFilterControls(type,query,category,categories){const template=type==='template',noun=template?'plantilla':'etiqueta';return `<div class="m-wa-sheet-filters"><label class="m-wa-sheet-field"><span>Buscar</span><input class="m-input m-wa-sheet-search" type="search" data-wa-filter="${type}-query" value="${esc(query)}" placeholder="Buscar ${noun}…" autocomplete="off" aria-label="Buscar ${noun}"></label><label class="m-wa-sheet-field"><span>Categoría</span><select class="m-select m-wa-sheet-category" data-wa-filter="${type}-category" aria-label="Filtrar por categoría"><option value="">Todas las categorías</option>${categories.map(value=>`<option value="${esc(value)}"${category===value?' selected':''}>${esc(value)}</option>`).join('')}</select></label></div>`;}
  function applyMobileWaSheetFilters(root=byId('mobileWaActionSheet')){
    if(!root||root.classList.contains('hidden'))return;
    if(root.dataset.kind==='templates'){
      const visible=new Set(mobileWaFilteredTemplates().map(row=>String(row.index)));root.querySelectorAll('[data-wa-template-index]').forEach(row=>row.classList.toggle('hidden',!visible.has(String(row.dataset.waTemplateIndex))));const count=root.querySelector('[data-wa-result-count="templates"]');if(count)count.textContent=`Mostrando ${visible.size} ${visible.size===1?'plantilla':'plantillas'}`;root.querySelector('[data-wa-filter-empty="templates"]')?.classList?.toggle('hidden',visible.size>0);
    }
    if(root.dataset.kind==='labels'){
      const visible=new Set(mobileWaFilteredLabels().map(label=>String(label.id)));root.querySelectorAll('[data-wa-label-id]').forEach(row=>row.classList.toggle('hidden',!visible.has(String(row.dataset.waLabelId))));const count=root.querySelector('[data-wa-result-count="labels"]');if(count)count.textContent=`Mostrando ${visible.size} ${visible.size===1?'etiqueta':'etiquetas'}`;root.querySelector('[data-wa-filter-empty="labels"]')?.classList?.toggle('hidden',visible.size>0);
    }
  }
  function handleMobileWaSheetFilter(event){const filter=event.target?.dataset?.waFilter;if(!filter)return;const value=String(event.target.value||'');if(filter==='template-query')state.whatsapp.templateQuery=value;if(filter==='template-category')state.whatsapp.templateCategory=value;if(filter==='label-query')state.whatsapp.labelQuery=value;if(filter==='label-category')state.whatsapp.labelCategory=value;applyMobileWaSheetFilters();}
  function renderMobileWaTemplatesSheet(){
    if(state.whatsapp.templatesLoading)return '<div class="m-wa-sheet-loading">Cargando plantillas…</div>';
    if(state.whatsapp.templatesError)return `<div class="m-duplicate warn">${esc(state.whatsapp.templatesError)}</div><button class="m-secondary m-wa-sheet-full" data-action="wa-show-templates" type="button">Reintentar</button>`;
    if(!state.whatsapp.templates.length)return '<div class="m-wa-sheet-empty">No tienes plantillas guardadas.</div>';
    const visible=new Set(mobileWaFilteredTemplates().map(row=>String(row.index))),categories=mobileWaTemplateCategories();
    return `${mobileWaFilterControls('template',state.whatsapp.templateQuery,state.whatsapp.templateCategory,categories)}<p class="m-wa-result-count" data-wa-result-count="templates">Mostrando ${visible.size} ${visible.size===1?'plantilla':'plantillas'}</p><div class="m-wa-template-list">${state.whatsapp.templates.map((template,index)=>`<button class="m-wa-template-row${visible.has(String(index))?'':' hidden'}" data-action="wa-use-template" data-index="${index}" data-wa-template-index="${index}" type="button"><span><b>${esc(template.name||'Plantilla')}</b><small>${esc(mobileWaTemplateCategory(template))}</small><em>${esc(template.text||'')}</em></span><i aria-hidden="true">›</i></button>`).join('')}<div class="m-wa-sheet-empty${visible.size?' hidden':''}" data-wa-filter-empty="templates">No hay plantillas que coincidan con los filtros.</div></div><p class="m-wa-sheet-note">La plantilla se prepara en el mensaje. Tú decides cuándo enviarla.</p>`;
  }
  async function openMobileWaTemplates(){
    const chatId=mobileWaSheetChatId()||state.whatsapp.selectedId;if(!chatId||!has('can_manage_templates'))return;state.whatsapp.templateQuery='';state.whatsapp.templateCategory='';state.whatsapp.templatesLoading=true;state.whatsapp.templatesError='';setMobileWaSheet('templates','Usar plantilla',renderMobileWaTemplatesSheet(),chatId);
    try{const {data,error}=await client.rpc('wa_list_templates');if(error)throw error;state.whatsapp.templates=(Array.isArray(data)?data:[]).map(row=>({id:row.id,name:row.name||'Plantilla',text:row.body||'',category:row.category||'',shortcut:row.shortcut||''})).filter(row=>clean(row.text));}
    catch(error){state.whatsapp.templates=[];state.whatsapp.templatesError=error?.message||'No se pudieron cargar las plantillas.';}
    finally{state.whatsapp.templatesLoading=false;const root=byId('mobileWaActionSheet');if(root?.dataset?.kind==='templates'&&root.dataset.chatId===chatId)setMobileWaSheet('templates','Usar plantilla',renderMobileWaTemplatesSheet(),chatId);}
  }
  function resolveMobileWaTemplate(text,chatId){
    const chat=mobileWaSelectedChat(chatId),contact=mobileWaFindContact(chatId),fullName=clean(contact?.fullName||chat?.name),first=clean(contact?.first||fullName.split(/\s+/)[0]),dni=clean(contact?.dni),phone=clean(contactPhones(contact).find(p=>p.number===contactPhoneNumber(mobileWaNormalizePhone(chatId)))?.label||contact?.phone||mobileWaNormalizePhone(chatId));
    return String(text||'').replace(/\{\{contacto\.nombre_completo\}\}/gi,fullName).replace(/\{\{contacto\.nombre\}\}/gi,first).replace(/\{\{contacto\.telefono\}\}/gi,phone).replace(/\{\{contacto\.(?:dni|dni \/ nif|nif)\}\}/gi,dni).replace(/\{nombre_completo\}/gi,fullName).replace(/\{nombre\}/gi,first).replace(/\{dni\}/gi,dni).replace(/\{telefono\}/gi,phone);
  }
  function useMobileWaTemplate(index){
    const chatId=mobileWaSheetChatId(),template=state.whatsapp.templates[Number(index)];if(!chatId||!template)return;const input=byId('mobileWaComposer');if(!input)return;input.value=resolveMobileWaTemplate(template.text,chatId).slice(0,4096);closeMobileWaSheet(false);input.focus?.();input.setSelectionRange?.(input.value.length,input.value.length);toast('Plantilla preparada. Revísala y pulsa Enviar.','success');
  }
  async function loadMobileWaLabelCategories(){
    try{const result=await client.from('app_settings').select('value').eq('key','crm_label_categories_v1').maybeSingle();if(result.error)throw result.error;const value=result.data?.value;return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch(_){return {};}
  }
  function renderMobileWaLabelsSheet(contact){
    if(state.whatsapp.labelsLoading)return '<div class="m-wa-sheet-loading">Cargando etiquetas…</div>';
    if(state.whatsapp.labelsError)return `<div class="m-duplicate warn">${esc(state.whatsapp.labelsError)}</div><button class="m-secondary m-wa-sheet-full" data-action="wa-show-labels" type="button">Reintentar</button>`;
    const selected=new Set(state.whatsapp.labelIds.map(String)),visible=new Set(mobileWaFilteredLabels().map(label=>String(label.id))),categories=mobileWaLabelCategories(),choices=state.whatsapp.labels.length?`${mobileWaFilterControls('label',state.whatsapp.labelQuery,state.whatsapp.labelCategory,categories)}<p class="m-wa-result-count" data-wa-result-count="labels">Mostrando ${visible.size} ${visible.size===1?'etiqueta':'etiquetas'}</p><div class="m-wa-label-list">${state.whatsapp.labels.map(label=>`<label class="m-wa-label-row${visible.has(String(label.id))?'':' hidden'}" data-wa-label-id="${esc(label.id)}"><input type="checkbox" value="${esc(label.id)}" ${selected.has(String(label.id))?'checked':''}><span><b>${esc(label.name||'Etiqueta')}</b><small>${esc(clean(label.category)||mobileWaInferLabelCategory(label.name))}</small></span></label>`).join('')}<div class="m-wa-sheet-empty${visible.size?' hidden':''}" data-wa-filter-empty="labels">No hay etiquetas que coincidan con los filtros.</div></div>`:'<div class="m-wa-sheet-empty">No hay etiquetas creadas.</div>';
    return `<p class="m-wa-sheet-contact">Contacto: <b>${esc(contact.fullName)}</b></p>${choices}<button class="m-primary m-wa-sheet-full" data-action="wa-save-labels" type="button"${state.whatsapp.labelsSaving?' disabled':''}>${state.whatsapp.labelsSaving?'Guardando…':'Guardar etiquetas'}</button><p id="mobileWaLabelsMsg" class="m-form-msg">${esc(state.whatsapp.labelsError)}</p>`;
  }
  async function openMobileWaLabels(){
    const chatId=mobileWaSheetChatId()||state.whatsapp.selectedId,contact=mobileWaFindContact(chatId);if(!chatId||!contact||!has('can_manage_labels'))return;state.whatsapp.labelQuery='';state.whatsapp.labelCategory='';state.whatsapp.labelsLoading=true;state.whatsapp.labelsError='';setMobileWaSheet('labels','Etiquetas del contacto',renderMobileWaLabelsSheet(contact),chatId);
    try{const [labels,assigned,categories]=await Promise.all([client.rpc('crm_list_labels'),client.rpc('crm_get_contact_labels',{p_contact_id:contact.id}),loadMobileWaLabelCategories()]);if(labels.error)throw labels.error;if(assigned.error)throw assigned.error;state.whatsapp.labels=(Array.isArray(labels.data)?labels.data:[]).map(row=>({id:row.id,name:row.name||'Etiqueta',category:clean(categories[String(row.id)])||mobileWaInferLabelCategory(row.name)})).sort((a,b)=>a.name.localeCompare(b.name,'es'));state.whatsapp.labelIds=(Array.isArray(assigned.data)?assigned.data:[]).map(row=>String(row.id??row.label_id??row.value??'')).filter(Boolean);}
    catch(error){state.whatsapp.labels=[];state.whatsapp.labelIds=[];state.whatsapp.labelsError=error?.message||'No se pudieron cargar las etiquetas.';}
    finally{state.whatsapp.labelsLoading=false;const root=byId('mobileWaActionSheet');if(root?.dataset?.kind==='labels'&&root.dataset.chatId===chatId)setMobileWaSheet('labels','Etiquetas del contacto',renderMobileWaLabelsSheet(contact),chatId);}
  }
  async function saveMobileWaLabels(){
    const chatId=mobileWaSheetChatId(),contact=mobileWaFindContact(chatId),root=byId('mobileWaActionSheet');if(!chatId||!contact||!has('can_manage_labels')||root?.dataset?.kind!=='labels')return;const ids=[...(root.querySelectorAll('.m-wa-label-row input:checked')||[])].map(input=>String(input.value)),previousIds=[...state.whatsapp.labelIds];state.whatsapp.labelIds=ids;state.whatsapp.labelsSaving=true;state.whatsapp.labelsError='';setMobileWaSheet('labels','Etiquetas del contacto',renderMobileWaLabelsSheet(contact),chatId);
    try{const {error}=await client.rpc('crm_set_contact_labels',{p_contact_id:contact.id,p_label_ids:ids});if(error)throw error;state.whatsapp.labelIds=ids;closeMobileWaSheet();toast('Etiquetas actualizadas en todo el CRM.','success');}
    catch(error){state.whatsapp.labelIds=previousIds;state.whatsapp.labelsError=error?.message||'No se pudieron guardar las etiquetas.';}
    finally{state.whatsapp.labelsSaving=false;const current=byId('mobileWaActionSheet');if(current&&!current.classList.contains('hidden')&&current.dataset.kind==='labels'&&current.dataset.chatId===chatId)setMobileWaSheet('labels','Etiquetas del contacto',renderMobileWaLabelsSheet(contact),chatId);}
  }
  function openMobileWaLinkedAction(type){
    const chatId=mobileWaSheetChatId(),contact=mobileWaFindContact(chatId);if(!chatId||!contact){closeMobileWaSheet(false);toast('Primero crea o vincula el contacto.','error');return;}const allowed=type==='task'?has('can_manage_agenda'):has('can_view_sales')&&has('can_edit_sales');if(!allowed)return;closeMobileWaSheet(false);const query=`?chat=${encodeURIComponent(chatId)}`;go(type==='task'?`new-task/${contact.id}${query}`:`new-contact-opportunity/${contact.id}${query}`);
  }
  function renderMobileWhatsAppChat(chatId){
    if(!has('can_use_whatsapp'))return `<div class="m-page">${pageHead('WhatsApp','home')}${empty('Acceso restringido','No tienes permiso para utilizar WhatsApp.')}</div>`;
    if(!chatId)return `<div class="m-page">${pageHead('WhatsApp','whatsapp')}${empty('Chat no encontrado','Vuelve a la lista de conversaciones.')}</div>`;
    const chat=mobileWaContactChat(chatId),id=String(chat.id||''),phone=id.includes('@g.us')?'Grupo':id.includes('@lid')?'Contacto de WhatsApp':`+${mobileWaNormalizePhone(id)}`,sameChat=String(state.whatsapp.selectedId)===String(chatId),busy=state.whatsapp.sending?' disabled':'',busyText=state.whatsapp.sending?'Hay un envío en curso…':'';
    return `<div class="m-page m-wa-chat-page"><div class="m-wa-chat-head"><button class="m-back" data-action="wa-back-list" type="button" aria-label="${mobileWaBackTarget()==='whatsapp'?'Volver a conversaciones':'Volver a la ficha del contacto'}">‹</button><span class="m-avatar m-wa-avatar">${esc(mobileWaInitials(chat))}</span><span class="m-wa-chat-title"><strong>${esc(mobileWaChatName(chat))}</strong><small>${esc(phone)}</small></span><button class="m-back m-wa-refresh" data-action="wa-refresh-chat" type="button" aria-label="Actualizar chat">↻</button></div><div class="m-wa-contact-link">${renderMobileWaContactAction(chat)}</div><div id="mobileWaMessages" class="m-wa-messages" aria-live="polite">${sameChat?renderMobileWaMessages():skeleton()}</div><div class="m-wa-composer"><button class="m-secondary m-wa-attach" data-action="wa-attach" type="button" aria-label="Abrir acciones del chat" aria-haspopup="dialog" aria-controls="mobileWaActionSheet" aria-expanded="false"${busy}>＋</button><textarea id="mobileWaComposer" class="m-textarea" rows="1" maxlength="4096" placeholder="Escribe un mensaje"${busy}></textarea><button id="mobileWaSend" class="m-primary" data-action="wa-send" type="button"${busy}>Enviar</button><small id="mobileWaComposerMsg" class="m-form-msg">${esc(busyText)}</small></div></div>`;
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
  async function sendMobileWaFile(file,originChatId=''){
    if(!file||state.whatsapp.sending)return;if(file.size>2500000){toast('El archivo supera el límite de 2,5 MB.','error');return;}
    const chatId=clean(originChatId||state.whatsapp.selectedId),current=route();if(!chatId)return;if(chatId!==String(state.whatsapp.selectedId||'')||current.parts[0]!=='whatsapp-chat'||safeDecode(current.parts[1])!==chatId){toast('No se envió el archivo porque cambiaste de conversación.','error');return;}setMobileWaSending(true,'Enviando archivo…',chatId);
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

  function renderScreenCheck(){
    if(!state.perms?.is_admin)return empty('Acceso restringido','Solo disponible para el administrador.');
    const round=value=>Number.isFinite(value)?Math.round(value*10)/10:'—';
    const rect=selector=>{const r=document.querySelector(selector)?.getBoundingClientRect();return r?`${round(r.top)} / ${round(r.bottom)} / ${round(r.height)}`:'—';};
    const app=byId('mobileApp'),nav=document.querySelector('.m-bottom-nav'),vv=window.visualViewport;
    const appStyle=getComputedStyle(app),navStyle=nav?getComputedStyle(nav):null,units=[];
    const probe=document.createElement('div');probe.style.cssText='position:absolute;top:0;left:0;width:0;visibility:hidden;pointer-events:none;';document.body.appendChild(probe);
    try{for(const unit of ['vh','dvh','lvh']){probe.style.height='100'+unit;units.push(`${unit}: ${round(probe.getBoundingClientRect().height)}`);}}finally{probe.remove();}
    const lines=[
      'PANTALLA · diagnóstico 1',
      `Instalada: ${navigator.standalone===true} / CSS: ${matchMedia('(display-mode:standalone)').matches}`,
      `Pantalla: ${screen.width} × ${screen.height} · escala ${devicePixelRatio}`,
      `Disponible: ${screen.availWidth} × ${screen.availHeight}`,
      `Ventana: ${innerWidth} × ${innerHeight}`,
      `Visible: ${round(vv?.width)} × ${round(vv?.height)} · zoom ${round(vv?.scale)}`,
      `Desplazamiento visible: ${round(vv?.offsetTop)} / ${round(vv?.pageTop)}`,
      units.join(' · '),
      'Medidas: arriba / abajo / altura',
      `Aplicación: ${rect('#mobileApp')}`,
      `Cabecera: ${rect('.m-header')}`,
      `Contenido: ${rect('#mobileView')}`,
      `Barra: ${rect('.m-bottom-nav')}`,
      `Botón: ${rect('.m-bottom-nav button:last-child')}`,
      `Reserva inferior: ${navStyle?.paddingBottom||'—'}`,
      `Diseño: ${appStyle.display} / ${appStyle.position} / ${navStyle?.position||'—'}`,
      location.hostname
    ];
    return `<div class="m-page">${pageHead('Diagnóstico de pantalla','more')}<p class="m-subtitle">Envía una captura de estas medidas para revisar el margen inferior.</p><pre class="m-info-card" style="font-size:11px;line-height:1.65;padding:12px;white-space:pre-wrap;overflow-wrap:anywhere">${esc(lines.join('\n'))}</pre><button class="m-secondary" data-action="route" data-route="screen-check">Volver a medir</button></div>`;
  }
  function renderMore(){
    return `<div class="m-page">${pageHead('Más','home')}<div class="m-info-card">${infoRow('Usuario',state.perms?.display_name||state.user?.email)}${infoRow('Sincronización','Mismo CRM y misma base de datos')}${infoRow('Última actualización',state.lastRefresh?dateTime(state.lastRefresh):'—')}</div><div class="m-action-stack" style="margin-top:14px">${state.perms?.is_admin?'<button class="m-secondary" data-action="route" data-route="system">● Estado del sistema</button><button class="m-secondary" data-action="route" data-route="screen-check">Diagnóstico de pantalla</button>':''}<button class="m-secondary" data-action="refresh">↻ Actualizar datos</button><button class="m-secondary" data-action="open-desktop">Abrir CRM completo</button><button class="m-danger" data-action="logout">Cerrar sesión</button></div></div>`;
  }

  function handleMobileWaSheetKeydown(event){
    const root=byId('mobileWaActionSheet');if(!root||root.classList.contains('hidden'))return;if(event.key==='Escape'){event.preventDefault();closeMobileWaSheet();return;}if(event.key!=='Tab')return;const focusable=[...root.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled)')];if(!focusable.length)return;const first=focusable[0],last=focusable[focusable.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }

  function bindStaticEvents(){
    byId('mobileLoginForm').addEventListener('submit',signIn);
    byId('mobileBrand').onclick=()=>go('home');byId('mobileAlerts').onclick=()=>{state.alertFilter='all';state.alertLimit=ALERT_PAGE_SIZE;go('alerts');};byId('mobileMenu').onclick=()=>go('more');byId('mobileAdd').onclick=event=>openMobileQuickActions(event.currentTarget);
    document.querySelectorAll('[data-mobile-route]').forEach(button=>button.onclick=()=>go(button.dataset.mobileRoute));
    byId('mobileCameraInput').onchange=event=>{handleImage(event.target.files?.[0]);event.target.value='';};
    byId('mobileGalleryInput').onchange=event=>{handleImage(event.target.files?.[0]);event.target.value='';};
    byId('mobileWhatsAppFileInput').onchange=event=>{const chatId=state.whatsapp.pendingFileChatId;state.whatsapp.pendingFileChatId='';sendMobileWaFile(event.target.files?.[0],chatId);event.target.value='';};
    byId('mobileView').addEventListener('click',handleViewClick);
    byId('mobileView').addEventListener('change',event=>{
      if(event.target?.dataset?.contactPhone){const phone=selectedContactPhone(event.target.dataset.contactPhone),link=byId('mobileContactCall');if(phone&&link)link.href='tel:+'+phone.number;return;}
      const prefix=event.target?.dataset?.taskTypePrefix;
      if(['newTask','editTask'].includes(prefix)){const fields=byId(prefix+'TypeFields');if(fields)fields.innerHTML=taskTypeFields(prefix,event.target.value);return;}
      if(event.target?.id==='mobileProfileLabelCategory'){filterProfileLabels();return;}
      const id=event.target?.dataset?.profileLabelId;
      if(id&&profileLabels.loaded&&!profileLabels.saving){event.target.checked?profileLabels.selected.add(id):profileLabels.selected.delete(id);}
    });
    byId('mobileView').addEventListener('input',event=>{
      if(event.target?.id!=='mobileProfileLabelSearch')return;
      filterProfileLabels();
    });
    byId('mobileWaActionSheet').addEventListener('click',handleViewClick);
    byId('mobileWaActionSheet').addEventListener('input',handleMobileWaSheetFilter);
    byId('mobileWaActionSheet').addEventListener('change',handleMobileWaSheetFilter);
    document.addEventListener('keydown',handleMobileWaSheetKeydown);
    addEventListener('hashchange',()=>{closeMobileWaSheet(false);render();});
    addEventListener('pageshow',()=>{if(state.user&&Date.now()-state.lastRefresh>30000)refreshData({silent:true}).then(render);});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){stopMobileWaRefresh();if(route().parts[0]==='scan'){state.cameraPaused=true;stopGuidedCamera();setGuidedCameraStatus('La cámara se ha detenido. Pulsa “Activar cámara” para continuar.');}return;}if(state.user&&Date.now()-state.lastRefresh>30000)refreshData({silent:true}).then(render);const current=route();if(current.parts[0]==='whatsapp')loadMobileWaChats({silent:true,light:true});else if(current.parts[0]==='whatsapp-chat')loadMobileWaHistory(safeDecode(current.parts[1]),{silent:true});});
    addEventListener('pagehide',()=>{stopMobileWaRefresh();stopGuidedCamera();});
  }
  async function handleViewClick(event){
    const target=event.target.closest('[data-action]');if(!target)return;event.preventDefault();const action=target.dataset.action;
    if(action.startsWith('system-')){await window.TPFMobileSystem?.handle?.(action,target);return;}
    if(action==='route'){
      if(target.dataset.route?.startsWith('task/'))taskDetail={id:'',row:null,loading:false,error:''};
      const destination=String(target.dataset.route||''),current=route().parts[0];
      if(destination.startsWith('whatsapp-chat/'))state.whatsapp.listScroll=Number(byId('mobileView')?.scrollTop||0);
      else if(destination==='whatsapp'&&current!=='whatsapp-chat')state.whatsapp.listScroll=0;
      go(destination);
    }
    if(action==='back')goBack(target.dataset.fallback||'home');
    if(action==='quick-scan'){closeMobileWaSheet(false);resetDraft();go('scan');}
    if(action==='quick-manual'){closeMobileWaSheet(false);resetDraft();go('detected');}
    if(action==='quick-opportunity'){closeMobileWaSheet(false);state.library.contactQuery='';state.library.contactLimit=CONTACT_PAGE_SIZE;go('choose-contact/opportunity');}
    if(action==='quick-task'){closeMobileWaSheet(false);state.library.contactQuery='';state.library.contactLimit=CONTACT_PAGE_SIZE;go('choose-contact/task');}
    if(action==='quick-templates'){closeMobileWaSheet(false);go('templates');}
    if(action==='quick-labels'){closeMobileWaSheet(false);go('labels');}
    if(action==='start-scan'){resetDraft();go('scan');}
    if(action==='manual-contact'){resetDraft();go('detected');}
    if(action==='camera')byId('mobileCameraInput').click();
    if(action==='gallery')byId('mobileGalleryInput').click();
    if(action==='start-camera'){state.cameraPaused=false;startGuidedCamera();}
    if(action==='capture-photo')captureGuidedPhoto();
    if(action==='repeat-photo')repeatGuidedPhoto();
    if(action==='analyse-scan')analyseScan();
    if(action==='check-duplicates')checkDuplicates();
    if(action==='continue-detected')continueDetected();
    if(action==='toggle-reminder'){target.classList.toggle('on');target.setAttribute('aria-pressed',target.classList.contains('on'));}
    if(action==='continue-opportunity')continueOpportunity();
    if(action==='skip-opportunity')skipOpportunity();
    if(action==='create-all')performCreation();
    if(action==='retry-creation')performCreation();
    if(action==='finish-flow'){resetDraft();go('home');}
    if(action==='profile-tab'){state.profileTab=target.dataset.tab;if(state.profileTab==='history')contactHistory={id:'',rows:[],loading:false,error:'',limit:50};render();}
    if(action==='contact-whatsapp')openContactWhatsApp(target.dataset.id);
    if(action==='contact-text-save')saveContactText(target.dataset.id,target.dataset.kind,target);
    if(action==='contact-history-reload')loadContactHistory(target.dataset.id);
    if(action==='contact-history-more')loadContactHistory(target.dataset.id,contactHistory.limit+50);
    if(action==='save-opportunity-detail')saveOpportunityDetail(target.dataset.id,target);
    if(action==='profile-delete-opportunity')deleteProfileOpportunity(target.dataset.id,target.dataset.contactId,target);
    if(action==='profile-labels')openProfileLabels(target.dataset.contactId);
    if(action==='profile-labels-retry')loadProfileLabels(target.dataset.contactId);
    if(action==='profile-labels-save')saveProfileLabels(target.dataset.contactId);
    if(action==='task-filter'){state.taskFilter=TASK_FILTERS.includes(target.dataset.filter)?target.dataset.filter:'all';render();}
    if(action==='agenda-day'&&validAgendaDateKey(target.dataset.date))go(`agenda?date=${target.dataset.date}`,true);
    if(action==='open-tasks'){state.taskFilter=TASK_FILTERS.includes(target.dataset.filter)?target.dataset.filter:'pending';go('tasks');}
    if(action==='open-opportunities'){state.opportunityQuery='';state.opportunityStage='';state.opportunityFilter=OPPORTUNITY_FILTERS.includes(target.dataset.filter)?target.dataset.filter:'all';go('opportunities');}
    if(action==='open-alerts'){state.alertFilter=ALERT_FILTERS.includes(target.dataset.filter)?target.dataset.filter:'all';state.alertLimit=ALERT_PAGE_SIZE;go('alerts');}
    if(action==='alert-filter'){state.alertFilter=ALERT_FILTERS.includes(target.dataset.filter)?target.dataset.filter:'all';state.alertLimit=ALERT_PAGE_SIZE;updateAlertResults();}
    if(action==='alert-more'){state.alertLimit+=ALERT_PAGE_SIZE;updateAlertResults();}
    if(action==='contact-filter'){state.contactFilter=CONTACT_FILTERS.includes(target.dataset.filter)?target.dataset.filter:'all';state.contactLimit=CONTACT_PAGE_SIZE;updateContactResults();}
    if(action==='contact-more'){state.contactLimit+=CONTACT_PAGE_SIZE;updateContactResults();}
    if(action==='chooser-more'){state.library.contactLimit+=CONTACT_PAGE_SIZE;const current=route(),kind=current.parts[0]==='assign-label'?'label':current.parts[1],labelId=current.parts[0]==='assign-label'?current.parts[1]:'';updateContactChooserResults(kind,labelId);}
    if(action==='opportunity-filter'){state.opportunityFilter=OPPORTUNITY_FILTERS.includes(target.dataset.filter)?target.dataset.filter:'all';updateOpportunityResults();}
    if(action==='wa-filter'){state.whatsapp.filter=MOBILE_WA_FILTERS.includes(target.dataset.filter)?target.dataset.filter:'all';state.whatsapp.limit=MOBILE_WA_PAGE_SIZE;updateMobileWaListDom();}
    if(action==='wa-more'){state.whatsapp.limit+=MOBILE_WA_PAGE_SIZE;updateMobileWaListDom();}
    if(action==='wa-refresh')loadMobileWaChats();
    if(action==='wa-back-home')go('home',true);
    if(action==='wa-back-list')go(mobileWaBackTarget(),true);
    if(action==='wa-refresh-chat')loadMobileWaHistory(state.whatsapp.selectedId,{scrollBottom:false});
    if(action==='wa-send')sendMobileWaMessage();
    if(action==='wa-attach')openMobileWaActions(target);
    if(action==='wa-close-sheet')closeMobileWaSheet();
    if(action==='wa-choose-file'){const chatId=mobileWaSheetChatId();if(!chatId)return;state.whatsapp.pendingFileChatId=chatId;closeMobileWaSheet(false);byId('mobileWhatsAppFileInput').click();}
    if(action==='wa-show-templates')openMobileWaTemplates();
    if(action==='wa-use-template')useMobileWaTemplate(target.dataset.index);
    if(action==='wa-create-task')openMobileWaLinkedAction('task');
    if(action==='wa-create-opportunity')openMobileWaLinkedAction('opportunity');
    if(action==='wa-show-labels')openMobileWaLabels();
    if(action==='wa-save-labels')saveMobileWaLabels();
    if(action==='wa-load-media')loadMobileWaMedia(target.dataset.id);
    if(action==='wa-create-contact')startContactFromMobileWa(target.dataset.chatId);
    if(action==='new-template')go('template-edit/new?from=templates');
    if(action==='edit-template')go(`template-edit/${target.dataset.id}?from=templates`);
    if(action==='insert-template-variable')insertMobileTemplateVariable(target.dataset.token);
    if(action==='save-template')saveMobileTemplate(target.dataset.id);
    if(action==='delete-template')deleteMobileTemplate(target.dataset.id);
    if(action==='copy-template')copyMobileTemplate(target.dataset.id);
    if(action==='reload-templates'){state.library.templatesLoaded=false;loadMobileTemplates(true);}
    if(action==='new-label')go('label-edit/new?from=labels');
    if(action==='edit-label')go(`label-edit/${target.dataset.id}?from=labels`);
    if(action==='save-label')saveMobileLabel(target.dataset.id);
    if(action==='delete-label')deleteMobileLabel(target.dataset.id);
    if(action==='reload-labels'){state.library.labelsLoaded=false;loadMobileLabels(true);}
    if(action==='assign-label'){state.library.contactQuery='';state.library.contactLimit=CONTACT_PAGE_SIZE;go(`assign-label/${target.dataset.id}?from=labels`);}
    if(action==='assign-label-contact')assignMobileLabelContact(target.dataset.contactId,target.dataset.labelId,target);
    if(action==='save-contact')saveContact(target.dataset.id);
    if(action==='save-task')saveTask(target.dataset.contactId);
    if(action==='reload-task')loadTaskDetail(target.dataset.id);
    if(action==='save-task-detail')saveTaskDetail(target.dataset.id);
    if(action==='task-status')saveTaskDetail(target.dataset.id,true);
    if(action==='delete-task')deleteTask(target.dataset.id);
    if(action==='save-contact-opportunity')saveContactOpportunity(target.dataset.contactId);
    if(action==='complete-task')completeTask(target.dataset.id);
    if(action==='refresh')refreshData();
    if(action==='logout')signOut();
    if(action==='open-desktop')location.href='/';
  }

  boot();
})();

