const {test,expect}=require('@playwright/test');
const {hash}=require('node:crypto');
test.use({screenshot:'off'}); // Nunca adjuntar conversaciones reales al informe público.
const A='34600000001@c.us',B='34600000002@c.us';

async function openDevice(browser,info,viewport){
  const context=await browser.newContext({baseURL:info.project.use.baseURL,extraHTTPHeaders:info.project.use.extraHTTPHeaders,viewport});
  return {context,page:await context.newPage()};
}
async function login(page){
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await page.locator('#email').fill(process.env.CRM_TEST_EMAIL);
  await page.locator('#password').fill(process.env.CRM_TEST_PASSWORD);
  await page.locator('#signin').click();
  await expect(page.locator('#app')).toBeVisible({timeout:30000});
  await page.waitForFunction(()=>window.TPFModules?.status().some(m=>m.name==='whatsapp-performance-max'&&m.state==='ready'));
  await page.locator('.nav[data-view="whatsapplive"]').first().click();
  await expect(page.locator('#waLiveChats .waChatRow').first()).toBeVisible({timeout:30000});
}
async function select(page,id){
  await page.evaluate(id=>window.selectWhatsAppChat(id),id);
  await expect(page.locator('#waChatActive')).toBeVisible();
}
async function summary(page){
  return page.evaluate(()=>({unread:document.getElementById('waStatUnread').textContent,waiting:document.getElementById('waStatWaiting').textContent,handled:document.getElementById('waStatHandled').textContent}));
}
async function protectDatabase(context,archive){
  await context.route('**/rest/v1/**',async route=>{
    const req=route.request(),url=new URL(req.url()),method=req.method();
    if(url.pathname.endsWith('/crm_whatsapp_chat_state')&&archive){
      if(method==='GET')return route.fulfill({json:[...archive.values()]});
      const row=req.postDataJSON();
      if(![A,B].includes(row.chat_id))throw Error('La prueba intentó modificar un chat ajeno');
      archive.set(row.chat_id,{...archive.get(row.chat_id),...row});
      return route.fulfill({status:201,json:row});
    }
    if(['GET','HEAD','OPTIONS'].includes(method))return route.continue();
    // RPCs de lectura autenticados sí usan POST; los demás quedan aislados.
    const rpc=url.pathname.split('/rpc/')[1]||'';
    if(/^(?:crm_get_|wa_get_|crm_can|crm_current_|crm_has_|get_user_|has_permission|is_admin)/.test(rpc)||['current_user_permissions','search_records','contact_related_items','crm_list_labels','crm_list_custom_fields','wa_list_templates'].includes(rpc))return route.continue();
    return route.fulfill({json:[]});
  });
  await context.route('**/api/green-read-safe',route=>route.fulfill({json:{ok:true,setRead:false}}));
}

test('Dos PCs: actualizan sin avisos, recuperan red y no mezclan chats',async({browser},info)=>{
  test.setTimeout(210000);
  const one=await openDevice(browser,info,{width:1280,height:720}),two=await openDevice(browser,info,{width:1920,height:1080});
  const archive=new Map(),now=Math.floor(Date.now()/1000),messages=new Map(),counts=new Map([[A,2],[B,0]]);
  const make=(chatId,text,stamp,outgoing=false)=>({chatId,idMessage:`${chatId}-${stamp}`,timestamp:stamp,type:outgoing?'outgoing':'incoming',textMessage:text});
  messages.set(A,[make(A,'Control A inicial',now)]);messages.set(B,[make(B,'Control B independiente',now,true)]);
  const chats=()=>[A,B].map(id=>({id,name:id===A?'Control A':'Control B',unreadCount:counts.get(id),_lastMessage:messages.get(id).at(-1),_lastIncomingAt:id===A?now:0,_lastOutgoingAt:id===B?now:0}));
  let releaseNotifications;const notificationGate=new Promise(r=>releaseNotifications=r);
  let failSummary=false,failHistory=false,delayA=false,releaseA;
  const heldA=new Promise(r=>releaseA=r);
  const errors=[];
  try{
    for(const [index,device] of [one,two].entries()){
      await protectDatabase(device.context,archive);
      await device.context.addInitScript(({A,B,index})=>{
        localStorage.setItem('tpf_wa_unread',JSON.stringify({[A]:index?59:2}));
        localStorage.setItem('tpf_wa_chat_meta_v3',JSON.stringify({[A]:{lastIncomingAt:index?1:200},[B]:{lastOutgoingAt:index?0:500}}));
      },{A,B,index});
      device.page.on('pageerror',error=>errors.push(error.message));
      await device.context.route('**/api/green?**',async route=>{
        const action=new URL(route.request().url()).searchParams.get('action');
        if(action==='state')return route.fulfill({json:{ok:true,state:'authorized'}});
        if(action==='summary')return route.fulfill({json:failSummary?{ok:true,degraded:true,chats:[]}:{ok:true,chats:chats()}});
        if(action==='chats')return route.fulfill({json:{ok:true,chats:chats()}});
        if(action==='notifications'||action==='notification'){await notificationGate;return route.fulfill({json:{ok:true,notifications:[]}}).catch(()=>{});}
        if(action==='history'){
          if(failHistory)return route.fulfill({status:503,json:{ok:false,error:'Interrupción temporal simulada'}});
          const {chatId}=route.request().postDataJSON();
          if(delayA&&chatId===A)await heldA;
          return route.fulfill({json:{ok:true,messages:messages.get(chatId)||[]}});
        }
        if(action==='ensure'||action==='read')return route.fulfill({json:{ok:true,changed:false,setRead:false}});
        if(action==='avatar')return route.fulfill({json:{ok:true,urlAvatar:''}});
        if(action==='previews')return route.fulfill({json:{ok:true,previews:[]}});
        throw Error('Acción inesperada en prueba aislada: '+action);
      });
    }
    await Promise.all([login(one.page),login(two.page)]);
    await Promise.all([select(one.page,A),select(two.page,A)]);
    await expect(one.page.locator('#waMessages')).toContainText('Control A inicial');
    await expect(two.page.locator('#waMessages')).toContainText('Control A inicial');

    await test.step('La actualización periódica funciona con la cola bloqueada en ambos PCs',async()=>{
      messages.get(A).push(make(A,'Control A actualizado sin aviso',now+1));counts.set(A,3);
      for(const device of [one,two])await expect(device.page.locator('#waMessages')).toContainText('Control A actualizado sin aviso',{timeout:45000});
      await expect.poll(async()=>JSON.stringify(await summary(one.page))===JSON.stringify(await summary(two.page)),{timeout:20000}).toBe(true);
      await expect.poll(()=>summary(one.page)).toEqual({unread:'3',waiting:'1',handled:'1'});
    });

    await test.step('Archivar en un PC y recuperar en el otro usa el mismo estado',async()=>{
      await one.page.locator('#waArchiveChat').click();
      await expect(two.page.locator('#waArchiveChat')).toContainText('Desarchivar',{timeout:35000});
      await two.page.locator('#waArchiveChat').click();
      await expect(one.page.locator('#waArchiveChat')).toContainText('Archivar conversación',{timeout:35000});
    });

    await test.step('Una respuesta atrasada de A no se dibuja dentro de B ni borra su borrador',async()=>{
      delayA=true;
      const requested=one.page.waitForRequest(req=>new URL(req.url()).searchParams.get('action')==='history'&&req.postDataJSON()?.chatId===A);
      await one.page.evaluate(id=>{window.__multiSelection=window.selectWhatsAppChat(id)},A);await requested;
      await select(one.page,B);await one.page.locator('#waComposerText').fill('Borrador solo de B');
      releaseA();delayA=false;await one.page.evaluate(()=>window.__multiSelection);
      await expect(one.page.locator('#waMessages')).toContainText('Control B independiente');
      await expect(one.page.locator('#waMessages')).not.toContainText('Control A');
      await expect(one.page.locator('#waComposerText')).toHaveValue('Borrador solo de B');
    });

    await test.step('La sincronización informa del fallo y se recupera al volver la red',async()=>{
      failSummary=true;await two.page.evaluate(()=>window.dispatchEvent(new Event('online')));
      await expect(two.page.locator('#waLiveStatus')).toContainText('Sincronización pendiente',{timeout:25000});
      failSummary=false;messages.get(A).push(make(A,'Control A después de reconectar',now+2));
      await two.page.evaluate(()=>window.dispatchEvent(new Event('online')));
      await expect(two.page.locator('#waMessages')).toContainText('Control A después de reconectar',{timeout:35000});
      await expect(two.page.locator('#waLiveStatus')).toHaveText('Conectado');
    });
    await test.step('Un fallo del historial conserva los mensajes y recupera incluso contenido idéntico',async()=>{
      failHistory=true;await two.page.evaluate(()=>window.dispatchEvent(new Event('online')));
      await expect(two.page.locator('.waHistoryRetry')).toBeVisible({timeout:25000});
      await expect(two.page.locator('#waMessages')).toContainText('Control A después de reconectar');
      failHistory=false;await two.page.locator('.waHistoryRetry').click();
      await expect(two.page.locator('.waHistoryRetry')).toHaveCount(0);
      await expect(two.page.locator('#waMessages')).toContainText('Control A después de reconectar');
    });
    expect(errors).toEqual([]);
  }finally{
    releaseA();releaseNotifications();
    await Promise.all([one.context.close(),two.context.close()]);
  }
});

test('Dos sesiones autenticadas: resumen e historial reales coinciden sin enviar ni marcar leído',async({browser},info)=>{
  test.setTimeout(150000);
  const one=await openDevice(browser,info,{width:1280,height:720}),two=await openDevice(browser,info,{width:1920,height:1080});
  const digest=value=>hash('sha256',JSON.stringify(value));
  try{
    for(const device of [one,two]){
      await protectDatabase(device.context);
      await device.context.route('**/api/green?**',async route=>{
        const action=new URL(route.request().url()).searchParams.get('action');
        if(['state','summary','chats','history','avatar','previews','file'].includes(action))return route.continue();
        return route.fulfill({json:{ok:true,changed:false,setRead:false,notifications:[]}});
      });
    }
    await Promise.all([login(one.page),login(two.page)]);
    let sharedId='';
    await expect.poll(async()=>{
      const results=await Promise.all([one.page.request.get('/api/green?action=summary'),two.page.request.get('/api/green?action=summary')]);
      const data=await Promise.all(results.map(r=>r.json()));
      if(data.some(r=>r.degraded||!r.chats?.length)){
        console.log('MULTIDEVICE_SUMMARY_RETRY',data.map((r,i)=>({status:results[i].status(),ok:r.ok,degraded:!!r.degraded,cached:!!r.cached,count:r.chats?.length||0,providerStatus:r.providerStatus||null})));
        return false;
      }
      const signature=r=>r.chats.map(c=>[c.id,c.unreadCount,c._lastMessage?.idMessage||'',c._lastIncomingAt,c._lastOutgoingAt]).sort((a,b)=>a[0].localeCompare(b[0]));
      sharedId=data[0].chats.find(c=>c._lastMessage&&!c.id.includes('@g.us'))?.id||'';
      console.log('MULTIDEVICE_SUMMARY_COMPARE',{counts:data.map(r=>r.chats.length),recent:data.map(r=>r.chats.filter(c=>c._lastMessage).length),equal:digest(signature(data[0]))===digest(signature(data[1]))});
      return !!sharedId&&digest(signature(data[0]))===digest(signature(data[1]));
    },{timeout:45000,intervals:[15000]}).toBe(true);
    await Promise.all([select(one.page,sharedId),select(two.page,sharedId)]);
    await expect.poll(async()=>{
      const states=await Promise.all([one.page,two.page].map(page=>page.evaluate(()=>({selected:waLiveState.selected?.id,messages:waLiveState.history.map(m=>[m.idMessage,m.chatId||m.senderData?.chatId||'']).sort()}))));
      return states.every(s=>s.selected===sharedId&&s.messages.length>0&&s.messages.every(m=>!m[1]||m[1]===sharedId))&&digest(states[0])===digest(states[1]);
    },{timeout:45000,intervals:[3000]}).toBe(true);
    await expect.poll(async()=>JSON.stringify(await summary(one.page))===JSON.stringify(await summary(two.page)),{timeout:45000,intervals:[3000]}).toBe(true);
    console.log('MULTIDEVICE_REAL_READ_OK: dos sesiones, resumen e historial coincidentes; sin envíos ni lecturas marcadas.');
  }finally{await Promise.all([one.context.close(),two.context.close()]);}
});
