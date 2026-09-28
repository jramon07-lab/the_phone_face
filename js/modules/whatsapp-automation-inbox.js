(function(){
  'use strict';
  const M=window.TPFModules;if(!M)return;

  const REFRESH_MS=90000;
  const MANUAL_KEY='tpf_wa_manual_outgoing_v1';
  const SEND_ACTIONS=['send_template','send_whatsapp_now','__send_whatsapp'];
  let latestAutomaticByPhone=new Map(),deliveredOfferPhones=new Map(),businessSource=null;
  let manualCache=null;
  let followupsByPhone=new Map();
  let loading=false;
  let timer=0;

  function liveState(){
    try{return typeof waLiveState!=='undefined'?waLiveState:null}catch(_){return null}
  }
  function database(){
    try{return typeof sb!=='undefined'&&sb?.from?sb:(window.sb?.from?window.sb:null)}catch(_){return window.sb?.from?window.sb:null}
  }

  const digits=value=>String(value??'').replace(/\D/g,'');
  function localPhone(value){
    let valueDigits=digits(value);
    if(valueDigits.startsWith('0034'))valueDigits=valueDigits.slice(4);
    else if(valueDigits.startsWith('34')&&valueDigits.length===11)valueDigits=valueDigits.slice(2);
    return valueDigits;
  }
  function chatPhone(chat){return localPhone(chat?.id||chat?.chatId||'')}
  function seconds(value){
    const time=new Date(value||0).getTime();
    return Number.isFinite(time)?Math.floor(time/1000):0;
  }
  function manualMap(){
    if(manualCache)return manualCache;
    try{manualCache=JSON.parse(localStorage.getItem(MANUAL_KEY)||'{}')||{}}catch(_){manualCache={}}
    return manualCache;
  }
  function rememberManual(chatId){
    const phone=chatPhone({id:chatId});if(!phone)return;
    const rows=manualMap(),cutoff=Date.now()-120*86400000;
    Object.keys(rows).forEach(key=>{if(Number(rows[key]||0)<cutoff)delete rows[key]});
    rows[phone]=Date.now();
    try{localStorage.setItem(MANUAL_KEY,JSON.stringify(rows))}catch(_){}
  }
  function preview(chat){
    const id=String(chat?.id||'');
    const candidate=liveState()?.livePreview?.[id]||null;
    const storedTimestamp=Number(window.waMessageTimestamp?.(chat?._lastMessage)||0);
    const live=candidate&&Number(candidate.timestamp||0)>=storedTimestamp?candidate:null;
    const last=live||(chat?._lastMessage||null);
    const timestamp=Number(live?.timestamp||(typeof window.waMessageTimestamp==='function'?window.waMessageTimestamp(last):0)||chat?.lastMessageTime||chat?.lastMessageTimestamp||chat?.timestamp||chat?.lastActivityTime||0);
    const outgoing=typeof live?.outgoing==='boolean'?live.outgoing:(typeof window.waMessageDirection==='function'?window.waMessageDirection(last)==='out':false);
    return {timestamp,outgoing,idMessage:String(last?.idMessage||last?.id_message||'')};
  }
  function isAutomaticWaiting(chat){
    const last=preview(chat);
    // Match the actual provider receipt, never a time window: phone replies can
    // arrive in the same second as an automatic send.
    return last.outgoing&&!!last.idMessage&&!!latestAutomaticByPhone.get(chatPhone(chat))?.has(last.idMessage);
  }
  function jobPhone(row){
    const context=row?.context||{};
    return localPhone(context.phone||context.contact_phone||context.contract_party?.recipient_phone||context.contact_data?.['TELÉFONO']||'');
  }
  function ingestJobs(rows){
    const next=new Map(),delivered=new Map();
    for(const row of rows||[]){
      const receipt=row.action_config?.__delivery_receipt,phone=localPhone(receipt?.chatId)||jobPhone(row),id=String(receipt?.idMessage||'');
      const offerId=String(row.context?.offer_instance_id||''),recipient=phoneKey(receipt?.chatId),at=seconds(row.completed_at||row.updated_at);
      if(offerId&&recipient&&id&&(!delivered.has(offerId)||at>delivered.get(offerId).at))delivered.set(offerId,{phone:recipient,at});
      if(phone&&id){if(!next.has(phone))next.set(phone,new Set());next.get(phone).add(id);}
    }
    latestAutomaticByPhone=next;deliveredOfferPhones=delivered;
    if(businessSource)ingestBusiness(businessSource.offers,businessSource.opportunities);
    return next.size;
  }
  function ingestFollowups(rows){
    const next=new Map();
    for(const row of rows||[]){
      if(!['pending','running','failed'].includes(row.status))continue;
      if(!String(row.automation?.trigger_config?.automation_code||'').endsWith('_security_3_months'))continue;
      if(!SEND_ACTIONS.includes(row.action_type))continue;
      const phone=jobPhone(row);if(!phone)continue;
      if(!next.has(phone))next.set(phone,[]);
      next.get(phone).push({id:row.id,at:seconds(row.run_at),status:row.status});
    }
    for(const jobs of next.values())jobs.sort((a,b)=>a.at-b.at);
    followupsByPhone=next;
  }
  function followups(chat){return followupsByPhone.get(chatPhone(chat))||[];}
  async function loadFollowups(){
    const client=database();if(!client)return;
    try{
      if(client.auth?.getSession){const {data}=await client.auth.getSession();if(!data?.session)return;}
      const rows=[];
      for(let start=0;;start+=500){
        const {data,error}=await client.from('crm_server_automation_jobs')
          .select('id,action_type,context,run_at,status,automation:crm_automations!inner(trigger_config)')
          .in('status',['pending','running','failed']).in('action_type',SEND_ACTIONS)
          .eq('automation.trigger_config->>automation_category','Posventa')
          .order('id').range(start,start+499);
        if(error)throw error;rows.push(...(data||[]));if((data||[]).length<500)break;
      }
      ingestFollowups(rows);window.renderWhatsAppChats?.();
    }catch(error){console.warn('Seguimientos de tres meses',error);}
  }
  async function loadAutomaticSends(){
    const client=database();
    if(loading||!client)return;
    loading=true;
    try{
      if(client.auth?.getSession){const {data}=await client.auth.getSession();if(!data?.session)return;}
      const since=new Date(Date.now()-120*86400000).toISOString();
      const result=await client.from('crm_server_automation_jobs')
        .select('id,action_type,context,action_config,completed_at,updated_at')
        .in('status',['done','pending','running','failed'])
        .in('action_type',SEND_ACTIONS)
        .gte('updated_at',since)
        .order('updated_at',{ascending:false})
        .limit(1000);
      if(result.error)throw result.error;
      ingestJobs(result.data||[]);
      updateAutomaticCount();
      window.renderWhatsAppChats?.();
    }catch(error){console.warn('Bandeja de WhatsApp automáticos',error)}
    finally{loading=false}
  }
  let businessByPhone=new Map(),declineArchives=new Map(),declineRevision=0,businessLoading=false,businessAt=0;
  function ingestDeclineArchives(rows){declineArchives=new Map(rows.map(r=>[String(r.chat_id),seconds(r.declined_archived_at)]));}
  function phoneKey(value){const p=localPhone(value);return p.length>=8?p:'';}
  // Only actual offer instances drive commercial tabs. Legacy opportunities
  // (including annual reviews in Este mes) are used only to resolve the recipient.
  function ingestBusiness(offers,opportunities){
    businessSource={offers,opportunities};
    const oppById=new Map(opportunities.map(o=>[String(o.id),o])),next=new Map();
    for(const offer of offers){
      const o=oppById.get(String(offer.opportunity_id));
      const key=phoneKey(deliveredOfferPhones.get(String(offer.id))?.phone||offer.snapshot?.recipient_phone||o?.contract_party?.recipient_phone||o?.phone);if(!key)continue;
      const item=next.get(key)||{automatic:false,processing:false,paused:false,wonAt:0,declinedAt:0,plans:[]};
      if(['following','queued','paused','error'].includes(offer.status)){item.automatic=true;if(offer.status==='paused')item.paused=true;}
      if(['accepted','processed'].includes(offer.status))item.processing=true;
      if(offer.status==='lost'&&offer.customer_declined_at)item.declinedAt=Math.max(item.declinedAt,seconds(offer.customer_declined_at));
      if(offer.status==='won')item.wonAt=Math.max(item.wonAt,seconds(offer.status_changed_at||offer.updated_at));
      const task=offer.plan_task,at=seconds(task?.starts_at||offer.next_action_at);
      // A linked task is authoritative. Completed/deleted tasks must not leave ghost reminders.
      if(['following','queued','paused','error','accepted','processed'].includes(offer.status)&&at&&offer.next_action&&(!offer.plan_task_id||task?.status==='pending')){
        item.plans.push({at,setAt:seconds(offer.updated_at),title:task?.title||offer.next_action});
      }
      next.set(key,item);
    }
    businessByPhone=next;
  }
  function business(chat){return String(chat?.id||'').includes('@g.us')?null:businessByPhone.get(phoneKey(chat?.id));}
  async function loadBusiness(force=false){
    const db=database();if(!db||businessLoading||(!force&&Date.now()-businessAt<30000))return;
    businessLoading=true;
    const revision=declineRevision;
    async function all(table,columns,key='id'){const rows=[];for(let start=0;;start+=500){const {data,error}=await db.from(table).select(columns).order(key).range(start,start+499);if(error)throw error;rows.push(...(data||[]));if((data||[]).length<500)return rows;}}
    try{
      if(db.auth?.getSession){const {data}=await db.auth.getSession();if(!data?.session)return;}
      const [offers,opps,archives]=await Promise.all([all('crm_offer_instances','id,opportunity_id,status,snapshot,status_changed_at,updated_at,customer_declined_at,next_action,next_action_at,plan_task_id,plan_task:agenda_items!plan_task_id(status,starts_at,title)'),all('sales_opportunities','id,phone,contract_party'),all('crm_whatsapp_chat_state','chat_id,declined_archived_at','chat_id')]);
      ingestBusiness(offers,opps);if(revision===declineRevision)ingestDeclineArchives(archives);businessAt=Date.now();window.renderWhatsAppChats?.();
    }catch(e){console.warn('No se pudo actualizar la fase de las ofertas de WhatsApp',e)}finally{businessLoading=false;}
  }
  async function reload(){await Promise.all([loadAutomaticSends(),loadBusiness(true),loadFollowups()]);}
  function meta(chat){return window.waMeta?.(chat.id)||{}}
  function incoming(chat){return Math.max(Number(chat?._lastIncomingAt||0),Number(meta(chat).lastIncomingAt||0),!preview(chat).outgoing?preview(chat).timestamp:0)}
  function workPlan(chat){
    const m=meta(chat),manualAt=window.TPFInboxManual?.since?.(chat)||0;
    return (business(chat)?.plans||[]).filter(p=>manualAt<=p.setAt&&Number(m.archivedAt||0)<Math.max(p.setAt,p.at)).sort((a,b)=>a.at-b.at)[0]||null;
  }
  function planCategory(chat){
    const p=workPlan(chat);if(!p)return null;
    const last=preview(chat),inc=incoming(chat),m=meta(chat);
    const freshIncoming=inc>p.setAt&&inc>Number(m.archivedAt||0)&&(!last.outgoing||isAutomaticWaiting(chat)||!!window.TPFWaAutoReplies?.isReply(last.idMessage));
    return freshIncoming||p.at<=Date.now()/1000?'unanswered':'snoozed';
  }
  function describe(chat){
    const p=workPlan(chat);if(!p)return window.TPFInboxManual?.describe(chat)||'';
    if(planCategory(chat)==='unanswered'&&p.at>Date.now()/1000)return 'Revisar mensaje del cliente';
    return (p.at<=Date.now()/1000?'Próxima acción vencida: ':'Próxima acción: ')+p.title+' · '+new Date(p.at*1000).toLocaleString('es-ES',{timeZone:'Europe/Madrid',dateStyle:'short',timeStyle:'short'});
  }
  function facets(chat){
    const m=meta(chat),last=preview(chat),inc=incoming(chat),phase=business(chat);
    const plan=planCategory(chat);
    const manual=plan||window.TPFInboxManual?.category(chat,inc,{...last,automatic:isAutomaticWaiting(chat)||!!window.TPFWaAutoReplies?.isReply(last.idMessage)});
    const automaticMessage=isAutomaticWaiting(chat)||!!window.TPFWaAutoReplies?.isReply(last.idMessage);
    const resolved=!!m.archived&&inc<=Number(m.archivedAt||0);
    const pending=plan==='unanswered'||(!resolved&&(manual==='unanswered'||(!['waiting','snoozed'].includes(manual)&&inc>0&&(!last.outgoing||automaticMessage))));
    const dismissedAt=declineArchives.get(String(chat.id))||0;
    const declined=!!phase?.declinedAt&&!(dismissedAt>=phase.declinedAt&&inc<=dismissedAt&&Number(m.reopenedAt||0)<=dismissedAt);
    const businessOpen=!!(phase?.automatic||phase?.processing||declined||plan);
    const remainingWork=businessOpen;
    const wonArchived=!!phase?.wonAt&&!remainingWork&&!pending&&(inc<=phase.wonAt||(last.outgoing&&!automaticMessage&&last.timestamp>=inc))&&Number(m.reopenedAt||0)<=Math.max(phase.wonAt,last.outgoing&&!automaticMessage?last.timestamp:0);
    if((m.archived&&!businessOpen&&inc<=Number(m.archivedAt||Infinity))||wonArchived)return ['archived'];
    const kinds=[];
    if(pending)kinds.push('unanswered');
    else if(manual)kinds.push(manual);
    if(phase?.automatic)kinds.push('automatic');
    if(phase?.processing)kinds.push('processing');
    if(declined)kinds.push('declined');
    // A scheduled after-sale message alone does not start an offer workflow.
    return kinds.length?kinds:['all'];
  }
  function category(chat){return facets(chat)[0];}
  function matchesFilter(chat,filter){
    if(filter==='aftercare')return followups(chat).length>0;
    const kinds=facets(chat),archived=kinds.includes('archived');
    if(filter==='archived')return archived;
    if(archived)return false;
    if(['automatic','processing','declined','waiting','unanswered','snoozed'].includes(filter))return kinds.includes(filter);
    if(filter==='groups')return String(chat.id).includes('@g.us');
    if(filter==='contacts')return String(chat.id).includes('@c.us');
    if(filter==='unread')return Math.max(Number(window.waUnreadCount?.(chat.id)||0),Number(window.waChatServerUnread?.(chat)||0))>0;
    if(filter==='favorites')return !!(meta(chat).favorite||meta(chat).pinned);
    return true;
  }
  function automaticChats(){return (liveState()?.chats||[]).filter(c=>category(c)==='automatic')}
  function updateAutomaticCount(){
    const rows=liveState()?.chats||[];
    const counts={aftercare:0,declined:0,processing:0,automatic:0,unanswered:0,waiting:0,all:0,contacts:0,groups:0,unread:0,favorites:0,archived:0,snoozed:0};
    for(const c of rows){
      if(followups(c).length)counts.aftercare++;
      const kinds=facets(c),key=kinds[0],m=window.waMeta?.(c.id)||{};
      if(key==='archived'){counts.archived++;continue;}
      counts.all++;
      for(const kind of ['automatic','processing','declined','unanswered','waiting','snoozed'])if(kinds.includes(kind))counts[kind]++;
      if(String(c.id).includes('@c.us'))counts.contacts++;
      if(String(c.id).includes('@g.us'))counts.groups++;
      if(m.favorite||m.pinned)counts.favorites++;
      if(Math.max(Number(window.waUnreadCount?.(c.id)||0),Number(window.waChatServerUnread?.(c)||0))>0)counts.unread++;
    }
    for(const [key,n] of Object.entries(counts)){
      const badge=document.querySelector('[data-wa-tab="'+key+'"] .waAutomaticCount');
      if(badge){badge.textContent=String(n);badge.hidden=false;}
    }
  }

  function ensureTab(){
    const view=document.getElementById('view-whatsapplive'),tabs=view?.querySelector('.waTabs');if(!tabs)return;
    if(!view.classList.contains('waInboxWorkspace'))view.classList.add('waInboxWorkspace');
    const labels=[['unanswered','Pendientes','waPendingCount'],['waiting','En espera','waWaitingCount'],['automatic','Automáticos','waAutomaticCount'],['processing','En tramitación','waProcessingCount'],['aftercare','Seguimiento 3 meses','waAftercareCount'],['declined','No interesados','waDeclinedCount'],['all','Todos','waCount_all'],['contacts','Clientes','waCount_contacts'],['groups','Grupos','waCount_groups'],['unread','No leídos','waCount_unread'],['favorites','Favoritos','waCount_favorites'],['archived','Archivados','waCount_archived'],['snoozed','Aplazados','waCount_snoozed']];
    const more=tabs.querySelector('.waCleanFilters');
    for(const [key,label,id] of labels){
      let button=view.querySelector('[data-wa-tab="'+key+'"]');
      if(!button){button=document.createElement('button');button.type='button';button.dataset.waTab=key;}
      if(!button.dataset.inboxLabel){button.innerHTML=label+(id?' <b id="'+id+'" class="waAutomaticCount">0</b>':'');button.dataset.inboxLabel='1';}
      tabs.insertBefore(button,more||null);
      button.classList.toggle('active',(liveState()?.filter||'all')===key);
    }
    if(more)more.hidden=true;
    const page=view.querySelector('.waLivePage'),body=view.querySelector('.waLiveLayout');
    // Place navigation above the three existing panes, preserving all native controls.
    if(page&&body&&tabs.parentElement!==page)page.insertBefore(tabs,body);
    let info=document.getElementById('waInboxHelp');
    if(!info){info=document.createElement('div');info.id='waInboxHelp';info.setAttribute('role','status');document.getElementById('waLiveSearch')?.parentElement.after(info);}
    const messages={aftercare:'WhatsApp de los 3 meses programados o con error. Incluye conversaciones archivadas; no cambia su estado.',declined:'Clientes que pulsaron No me interesa. Atender conserva esta lista; Archivar los retira.',unanswered:'Clientes que necesitan atención. Leer no resuelve.',waiting:'Conversaciones que has marcado expresamente en espera.',snoozed:'Conversaciones aplazadas y próximas acciones. Al llegar la fecha vuelven a Pendientes.',automatic:'Ofertas sin aceptar. Si el cliente escribe, también aparece en Pendientes.',processing:'Ofertas aceptadas o tramitadas, pendientes de cerrar como Ganadas.',all:'Todas las conversaciones sin archivar.',archived:'Conversaciones resueltas y ventas ganadas sin atención pendiente.'};
    info.textContent=messages[liveState()?.filter||'all']||'Filtra tus conversaciones.';
    updateAutomaticCount();decorateHeader();
  }
  async function archiveDeclined(chatId){
    if(!chatId||!database())throw Error('No hay conexión para archivar');
    const now=new Date().toISOString(),at=seconds(now);declineRevision++;
    const {error}=await database().from('crm_whatsapp_chat_state').upsert({chat_id:String(chatId),declined_archived_at:now,archived:true,archived_at:now,updated_at:now},{onConflict:'chat_id'});
    if(error)throw error;
    declineRevision++;declineArchives.set(String(chatId),at);
    const apply=window.__tpfWaArchiveBaseSave||window.waMetaSave;
    apply?.(chatId,{archived:true,archivedAt:at},{persist:true,render:false});
    window.renderWhatsAppChats?.();decorateHeader();
  }
  function decorateHeader(){
    const button=document.getElementById('waArchiveChat'),chatId=liveState()?.selected?.id;
    if(button&&chatId){const chat=(liveState()?.chats||[]).find(c=>c.id===chatId),archived=chat?facets(chat).includes('archived'):!!window.waMeta?.(chatId)?.archived;button.textContent=archived?'Reabrir':'✓ Marcar como atendido';button.title=archived?'Volver a conversaciones':'Quitar de Pendientes. Conserva ofertas activas y No interesados; las demás pasan a Archivados.';button.setAttribute('aria-label',button.textContent);}
    if(button){
      let archive=document.getElementById('waArchiveDeclined');
      if(!archive){archive=document.createElement('button');archive.id='waArchiveDeclined';archive.type='button';archive.className='secondary';archive.textContent='Archivar';archive.title='Retirar de No interesados. Las demás ofertas activas continúan.';button.after(archive);archive.onclick=async()=>{const id=liveState()?.selected?.id;archive.disabled=true;try{await archiveDeclined(id)}catch(e){window.showToast?.(e.message,true)}finally{archive.disabled=false}};}
      const chat=(liveState()?.chats||[]).find(c=>c.id===chatId);archive.hidden=!chat||!facets(chat).includes('declined');
    }
  }
  function decorateAutomaticRows(){
    const rows=new Map((liveState()?.chats||[]).map(c=>[String(c.id),c]));
    document.querySelectorAll('#waLiveChats .waChatRow').forEach(row=>{
      const chat=rows.get(row.dataset.waChatId);if(!chat)return;
      const kinds=facets(chat),labels={automatic:business(chat)?.paused?'Seguimiento pausado':'Oferta en seguimiento',processing:'En tramitación',declined:'No interesado',waiting:'Esperando respuesta',unanswered:'Pendiente',snoozed:'Aplazada',archived:'Archivada',all:'Conversación'};
      const followup=liveState()?.filter==='aftercare'?followups(chat)[0]:null;
      const detail=followup?('WhatsApp 3 meses · '+new Date(followup.at*1000).toLocaleString('es-ES',{timeZone:'Europe/Madrid',dateStyle:'short',timeStyle:'short'})+(followup.status==='failed'?' · Error: revisar automatización':'')):(describe(chat)||(kinds.includes('unanswered')?'Revisar mensaje del cliente':''));
      const signature=JSON.stringify([kinds.map(k=>labels[k]),detail]);
      if(row.__tpfInboxDecoration===signature)return;
      row.__tpfInboxDecoration=signature;
      row.querySelectorAll('.waMiniFlag,.waAutomaticFlag,.waInboxFlag,.waInboxReason').forEach(x=>x.remove());
      let host=row.querySelector('.waChatMeta');if(!host){host=document.createElement('div');host.className='waChatMeta';row.querySelector('.waChatRowMain')?.append(host);}
      for(const kind of kinds){const badge=document.createElement('span');badge.className='waInboxFlag '+kind;badge.textContent=labels[kind]||kind;host.append(badge);}
      if(detail){const note=document.createElement('small');note.className='waInboxReason';note.textContent=detail;host.append(note);}
    });decorateHeader();
  }
  function openAutomaticTab(tab){
    const state=liveState();if(!state)return;
    state.filter=tab.dataset.waTab;
    document.querySelectorAll('#view-whatsapplive [data-wa-tab]').forEach(b=>b.classList.toggle('active',b===tab));
    window.renderWhatsAppChats?.();ensureTab();
  }
  function wrapRenderer(){
    const base=window.renderWhatsAppChats;
    if(typeof base!=='function'||base.__tpfAutomationInbox)return false;
    const wrapped=function(...args){
      if(!document.getElementById('waLiveChats'))return base.apply(this,args);
      const state=liveState();if(!state)return base.apply(this,args);
      const chats=state.chats,filter=state.filter||'all';
      if(!String(document.getElementById('waLiveSearch')?.value||'').trim())state.chats=(chats||[]).filter(c=>matchesFilter(c,filter));
      state.filter='all';state.__inboxPrefiltered=true;state.__inboxFilter=filter;
      try{return base.apply(this,args)}finally{state.chats=chats;state.filter=filter;delete state.__inboxPrefiltered;delete state.__inboxFilter;updateAutomaticCount();queueMicrotask(decorateAutomaticRows);}
    };
    wrapped.__tpfAutomationInbox=true;window.renderWhatsAppChats=wrapped;return true;
  }
  function styles(){
    if(document.getElementById('tpfWaAutomationInboxCss'))return;
    const style=document.createElement('style');style.id='tpfWaAutomationInboxCss';
    style.textContent=`#view-whatsapplive #waArchiveDeclined[hidden]{display:none!important}.waInboxFlag.declined,.m-inbox-badge.declined{background:#fff0ed;color:#a33b28}.waInboxFlag.processing,.m-inbox-badge.processing{background:#eaf2ff;color:#175cd3}.waInboxFlag.archived,.m-inbox-badge.archived{background:#eef2f5;color:#475569}.waInboxFlag+.waInboxFlag,.m-inbox-badge+.m-inbox-badge{margin-left:4px}#view-whatsapplive .waAutomaticCount{display:inline-grid;place-items:center;min-width:18px;height:18px;margin-left:4px;padding:0 5px;border-radius:999px;background:#e8efff;color:#315ea8;font-size:10px}#view-whatsapplive .waTabs button.active .waAutomaticCount{background:#fff;color:#172033}#view-whatsapplive .waAutomaticFlag{display:inline-flex;padding:3px 7px;border-radius:999px;background:#fff4d6;color:#8a5b00;font-size:9px;font-weight:800}#view-whatsapplive .waAutomaticCount[hidden]{display:none!important}`;
    document.head.appendChild(style);
  }
  function bindManualComposer(){
    const markLater=()=>{
      const chatId=liveState()?.selected?.id;if(!chatId)return;
      setTimeout(()=>{
        const text=String(document.getElementById('waComposerText')?.value||'');
        if(!text.trim()){rememberManual(chatId);window.renderWhatsAppChats?.()}
      },650);
    };
    const send=document.getElementById('waComposerSend');
    if(send&&!send.dataset.tpfAutomationManual){send.dataset.tpfAutomationManual='1';send.addEventListener('click',markLater)}
    const text=document.getElementById('waComposerText');
    if(text&&!text.dataset.tpfAutomationManual){text.dataset.tpfAutomationManual='1';text.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey)markLater()})}
  }
  function bind(){
    styles();ensureTab();bindManualComposer();
    const selected=document.getElementById('waChatName');if(selected)new MutationObserver(()=>{decorateHeader();}).observe(selected,{childList:true});
    const view=document.getElementById('view-whatsapplive');if(view)new MutationObserver(()=>{if(!view.classList.contains('hidden'))ensureTab();}).observe(view,{attributes:true,attributeFilter:['class']});
    document.addEventListener('click',event=>{
      if(event.target.closest?.('#waArchiveChat')){
        const chat=liveState()?.selected;
        if(chat&&facets(chat).includes('archived')&&!meta(chat).archived){event.preventDefault();event.stopImmediatePropagation();window.waMetaSave?.(chat.id,{archived:false},{render:true});window.renderWhatsAppChats?.();return;}
      }
      const tab=event.target.closest?.('#view-whatsapplive [data-wa-tab]');
      if(tab&&['aftercare','automatic','processing','declined','waiting','unanswered','snoozed','all','archived','contacts','groups','unread','favorites'].includes(tab.dataset.waTab)){
        event.preventDefault();event.stopImmediatePropagation();openAutomaticTab(tab);
      }
      if(tab)setTimeout(()=>{ensureTab();updateAutomaticCount();if(tab.dataset.waTab==='automatic')decorateAutomaticRows()},0);
      if(event.target.closest?.('.nav[data-view="whatsapplive"],#waLiveRefresh'))setTimeout(loadAutomaticSends,180);
    },true);
    if(!wrapRenderer()){
      let tries=0;const wait=setInterval(()=>{tries++;if(wrapRenderer()||tries>40)clearInterval(wait)},100);
    }
    reload();
    window.addEventListener('tpf:sales-updated',reload);
    window.addEventListener('tpf:tasks-changed',()=>loadBusiness(true));
    window.addEventListener('focus',()=>loadBusiness(true));
    setInterval(()=>{if(!document.hidden&&!document.getElementById('view-whatsapplive')?.classList.contains('hidden')&&[...businessByPhone.values()].some(x=>x.plans.length))window.renderWhatsAppChats?.();},20000);
    window.addEventListener('tpf:followup-ready',()=>loadBusiness());
    clearInterval(timer);timer=setInterval(()=>{
      const view=document.getElementById('view-whatsapplive');
      if(!document.hidden&&(!view||!view.classList.contains('hidden')))reload();
    },REFRESH_MS);
  }
  window.TPFAutomationInbox={isAutomaticWaiting,category,facets,matchesFilter,business,workPlan,describe,ingestBusiness,ingestDeclineArchives,archiveDeclined,ingestJobs,ingestFollowups,followups,reload};
  M.register('whatsapp-automation-inbox',{install(){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind()}});
})();
