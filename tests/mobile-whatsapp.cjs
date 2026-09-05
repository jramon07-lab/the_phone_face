const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../js/mobile-app.js'),'utf8');
const htmlSource=fs.readFileSync(path.join(__dirname,'../movil/index.html'),'utf8');
const testSource=source.replace(/\s*boot\(\);\s*\}\)\(\);\s*$/,`
window.__mobileWhatsAppTest={
  state,MOBILE_WA_FILTERS,MOBILE_WA_PAGE_SIZE,
  mobileWaNormalizePhone,mobileWaUnread,mobileWaMessageText,mobileWaMessageDirection,
  mobileWaPreview,mobileWaFilterCounts,mobileWaFilteredChats,mobileWaFindContact,
  renderHome,renderMobileWhatsApp,renderMobileWaFilters,renderMobileWaListBody,
  renderMobileWaMessages,renderMobileWhatsAppChat,mobileWaApi,
  updateMobileWaMessagesDom,loadMobileWaHistory,sendMobileWaMessage,sendMobileWaFile,
  renderMobileWaActions,renderMobileWaTemplatesSheet,resolveMobileWaTemplate,renderMobileWaLabelsSheet
};
})();`);
assert.notEqual(testSource,source,'No se pudo preparar mobile-app.js para la prueba');

let fetchImpl=async()=>{throw new Error('La prueba no configuró fetch');};
let timeoutId=0;
const nodes={
  mobileWaComposer:{value:'',disabled:false},
  mobileWaSend:{disabled:false},
  mobileWaMessages:{scrollHeight:1000,scrollTop:200,clientHeight:400,writes:0,_html:'',set innerHTML(value){this._html=value;this.scrollTop=0;this.writes+=1;},get innerHTML(){return this._html;}},
  mobileToast:{textContent:'',className:'',classList:{add(){}}},
  mobileWhatsAppFileInput:{click(){}}
};
const attach={disabled:false};
const client={auth:{async getSession(){return {data:{session:{access_token:'test-access-token'}},error:null};}}};
const context={
  window:{supabase:{createClient(){return client;}}},
  console,Intl,URL,URLSearchParams,AbortController,
  location:{hash:'#/home',replace(value){this.hash=value;}},
  history:{length:1,back(){}},
  document:{
    hidden:false,
    getElementById(id){return nodes[id]||null;},
    querySelector(selector){return selector==='[data-action="wa-attach"]'?attach:null;},
    querySelectorAll(){return [];}
  },
  fetch(...args){return fetchImpl(...args);},
  setTimeout(){timeoutId+=1;return timeoutId;},
  clearTimeout(){},
  addEventListener(){}
};
vm.createContext(context);
vm.runInContext(testSource,context);
const api=context.window.__mobileWhatsAppTest;

function plain(value){return JSON.parse(JSON.stringify(value));}
function response(status,payload){return {ok:status>=200&&status<300,status,async json(){return payload;}};}
const flush=()=>new Promise(resolve=>setImmediate(resolve));

async function run(){
  assert.deepEqual(Array.from(api.MOBILE_WA_FILTERS),['all','unread','contacts','groups']);
  assert.equal(api.MOBILE_WA_PAGE_SIZE,60);
  assert.equal(api.mobileWaNormalizePhone('+34 695 661 409@c.us'),'34695661409');
  assert.equal(api.mobileWaNormalizePhone('123456789012345@lid'),'');

  const chats=[
    {id:'34695661409@c.us',name:'Ramón Sánchez',unreadCount:2,_lastMessage:{timestamp:300,messageData:{textMessageData:{textMessage:'Mensaje nuevo'}}}},
    {id:'1203630@g.us',name:'Equipo Tienda',unreadCount:0,_lastMessage:{timestamp:200,messageData:{typeMessage:'imageMessage'}}},
    {id:'34600111222@c.us',name:'María López',unreadMessagesCount:1,_lastMessage:{timestamp:100,message:'Respuesta anterior'}}
  ];
  api.state.whatsapp.chats=chats;
  assert.deepEqual(plain(api.mobileWaFilterCounts()),{all:3,unread:2,contacts:2,groups:1});

  api.state.whatsapp.filter='groups';api.state.whatsapp.query='';
  assert.deepEqual(Array.from(api.mobileWaFilteredChats(),chat=>chat.id),['1203630@g.us']);
  api.state.whatsapp.filter='contacts';api.state.whatsapp.query='600111';
  assert.deepEqual(Array.from(api.mobileWaFilteredChats(),chat=>chat.id),['34600111222@c.us']);
  api.state.whatsapp.filter='invalid';api.state.whatsapp.query='ramón';
  assert.deepEqual(Array.from(api.mobileWaFilteredChats(),chat=>chat.id),['34695661409@c.us']);

  const nested={type:'outgoing',timestamp:20,messageData:{textMessageData:{textMessage:'Texto anidado <b>no HTML</b>'}}};
  const extended={typeWebhook:'incomingMessageReceived',timestamp:10,messageData:{extendedTextMessageData:{text:'Texto extendido'}}};
  const extendedPlain={typeWebhook:'incomingMessageReceived',timestamp:11,extendedTextMessage:{text:'Texto extendido plano'}};
  const plainMessage={outgoing:true,timestamp:30,message:'Texto plano'};
  assert.equal(api.mobileWaMessageText(nested),'Texto anidado <b>no HTML</b>');
  assert.equal(api.mobileWaMessageText(extended),'Texto extendido');
  assert.equal(api.mobileWaMessageText(extendedPlain),'Texto extendido plano');
  assert.equal(api.mobileWaMessageText(plainMessage),'Texto plano');
  assert.equal(api.mobileWaMessageDirection(nested),'out');
  assert.equal(api.mobileWaMessageDirection(extended),'in');
  assert.equal(api.mobileWaMessageText({message:'GREEN_API_TOKEN'}),'');
  assert.equal(api.mobileWaPreview(chats[1]),'📷 Foto');

  api.state.whatsapp.messages=[plainMessage,nested,extended];
  const messagesHtml=api.renderMobileWaMessages();
  assert.match(messagesHtml,/m-wa-msg in[\s\S]*Texto extendido/);
  assert.match(messagesHtml,/m-wa-msg out[\s\S]*Texto anidado &lt;b&gt;no HTML&lt;\/b&gt;/);
  assert.match(messagesHtml,/Texto plano/);
  assert.doesNotMatch(messagesHtml,/<b>no HTML<\/b>/);

  api.state.perms={is_admin:false,can_use_whatsapp:false};
  assert.match(api.renderMobileWhatsApp(),/Acceso restringido/);
  assert.doesNotMatch(api.renderMobileWhatsApp(),/mobileWaSearch/);
  api.state.perms={is_admin:false,can_use_whatsapp:true,can_view_database:true};
  assert.match(api.renderMobileWhatsApp(),/id="mobileWaSearch"/);
  assert.match(api.renderMobileWaFilters(),/No leídos/);

  const home=api.renderHome();
  assert.match(home,/data-action="route" data-route="whatsapp"[^>]*><span>◉<\/span><small>WhatsApp<\/small>/);
  assert.doesNotMatch(home,/data-action="open-desktop"[^>]*><span>◉<\/span><small>WhatsApp<\/small>/);

  api.state.contacts=[{id:'contact-1',phone:'695661409'}];
  assert.equal(api.mobileWaFindContact('34695661409@c.us').id,'contact-1');
  assert.equal(api.mobileWaFindContact('1203630@g.us'),null);
  assert.equal(api.mobileWaFindContact('123456789012345@lid'),null);

  api.state.contacts=[{id:'contact-1',first:'María',last:'López',fullName:'María López',phone:'695661409',dni:'12345678Z'}];
  api.state.whatsapp.selectedId='34695661409@c.us';
  api.state.perms={is_admin:true};
  const actions=api.renderMobileWaActions();
  for(const label of ['Foto o archivo','Usar plantilla','Crear tarea','Crear oportunidad','Añadir etiqueta'])assert.match(actions,new RegExp(label));
  assert.doesNotMatch(actions,/data-action="wa-create-task"[^>]* disabled/);
  assert.equal(api.resolveMobileWaTemplate('Hola {nombre}. {nombre_completo} · {dni} · {telefono}','34695661409@c.us'),'Hola María. María López · 12345678Z · 695661409');
  api.state.whatsapp.templates=[{name:'Saludo',category:'Atención',text:'Hola {nombre}'}];api.state.whatsapp.templatesLoading=false;api.state.whatsapp.templatesError='';
  assert.match(api.renderMobileWaTemplatesSheet(),/Saludo/);assert.match(api.renderMobileWaTemplatesSheet(),/Buscar plantilla/);assert.match(api.renderMobileWaTemplatesSheet(),/Todas las categorías/);assert.match(api.renderMobileWaTemplatesSheet(),/Tú decides cuándo enviarla/);
  api.state.whatsapp.labels=[{id:'label-1',name:'Cliente VIP'}];api.state.whatsapp.labelIds=['label-1'];api.state.whatsapp.labelsLoading=false;api.state.whatsapp.labelsError='';
  assert.match(api.renderMobileWaLabelsSheet(api.state.contacts[0]),/value="label-1" checked/);assert.match(api.renderMobileWaLabelsSheet(api.state.contacts[0]),/Buscar etiqueta/);assert.match(api.renderMobileWaLabelsSheet(api.state.contacts[0]),/Todas las categorías/);

  const fetchCalls=[];
  fetchImpl=async(url,options)=>{fetchCalls.push({url,options});return response(200,{ok:true,chats:[]});};
  await api.mobileWaApi('summary');
  assert.equal(fetchCalls[0].url,'/api/mobile-green?action=summary');
  assert.equal(fetchCalls[0].options.method,'GET');
  assert.equal(fetchCalls[0].options.headers.Authorization,'Bearer test-access-token');
  assert.equal(fetchCalls[0].options.cache,'no-store');
  await api.mobileWaApi('history',{chatId:'34695661409@c.us',count:100});
  assert.equal(fetchCalls[1].options.method,'POST');
  assert.equal(fetchCalls[1].options.headers.Authorization,'Bearer test-access-token');
  assert.equal(fetchCalls[1].options.headers['Content-Type'],'application/json');
  assert.deepEqual(JSON.parse(fetchCalls[1].options.body),{chatId:'34695661409@c.us',count:100});

  const callsBeforeForbidden=fetchCalls.length;
  await assert.rejects(api.mobileWaApi('notifications'),/Acción móvil no permitida/);
  assert.equal(fetchCalls.length,callsBeforeForbidden);
  assert.doesNotMatch(source,/mobileWaApi\s*\(\s*['"]notifications?['"]/);

  let resolveSend;
  let sendCalls=0;
  fetchImpl=async(url,options)=>{
    sendCalls+=1;
    assert.equal(url,'/api/mobile-green?action=send');
    assert.equal(options.headers.Authorization,'Bearer test-access-token');
    return new Promise(resolve=>{resolveSend=()=>resolve(response(200,{ok:true,idMessage:'sent-once'}));});
  };
  context.location.hash='#/home';
  api.state.whatsapp.selectedId='34695661409@c.us';
  api.state.whatsapp.messages=[];
  api.state.whatsapp.sending=false;
  nodes.mobileWaComposer.value='Enviar una sola vez';
  const firstSend=api.sendMobileWaMessage();
  const secondSend=api.sendMobileWaMessage();
  await flush();
  assert.equal(sendCalls,1,'Dos pulsaciones simultáneas no deben duplicar el POST');
  assert.equal(api.state.whatsapp.sending,true);
  resolveSend();
  await Promise.all([firstSend,secondSend]);
  assert.equal(sendCalls,1);
  assert.equal(api.state.whatsapp.sending,false);
  assert.equal(nodes.mobileWaComposer.value,'');
  assert.equal(api.state.whatsapp.messages.length,1);
  assert.equal(api.state.whatsapp.messages[0].idMessage,'sent-once');

  let oversizedFetches=0;
  fetchImpl=async()=>{oversizedFetches+=1;return response(200,{ok:true});};
  await api.sendMobileWaFile({size:2500001,name:'grande.pdf',type:'application/pdf'});
  assert.equal(oversizedFetches,0);
  assert.match(nodes.mobileToast.textContent,/supera el límite de 2,5 MB/);

  api.state.whatsapp.chats=Array.from({length:61},(_,index)=>({id:`34600${String(index).padStart(6,'0')}@c.us`,name:`Chat ${index}`,timestamp:61-index}));
  api.state.whatsapp.filter='all';api.state.whatsapp.query='';api.state.whatsapp.limit=60;api.state.whatsapp.loaded=true;api.state.whatsapp.loadingChats=false;api.state.whatsapp.error='';
  const limited=api.renderMobileWaListBody();
  assert.equal((limited.match(/class="m-wa-chat-row/g)||[]).length,60);
  assert.match(limited,/Mostrar más \(1\)/);
  assert.match(api.renderMobileWhatsAppChat('34695661409@c.us'),/maxlength="4096"/);
  assert.match(api.renderMobileWhatsAppChat('34695661409@c.us'),/aria-haspopup="dialog" aria-controls="mobileWaActionSheet" aria-expanded="false"/);
  assert.match(api.renderMobileWhatsAppChat('123456789012345@lid'),/Contacto de WhatsApp/);
  assert.doesNotMatch(api.renderMobileWhatsAppChat('123456789012345@lid'),/Crear contacto/);
  api.state.whatsapp.sending=true;
  assert.match(api.renderMobileWhatsAppChat('34695661409@c.us'),/data-action="wa-send"[^>]* disabled/);
  api.state.whatsapp.sending=false;

  const chatA='34611111111@c.us',chatB='34622222222@c.us',historyResolvers=new Map();
  fetchImpl=async(url,options)=>{
    assert.equal(url,'/api/mobile-green?action=history');
    const body=JSON.parse(options.body);
    return new Promise(resolve=>historyResolvers.set(body.chatId,messages=>resolve(response(200,{ok:true,messages}))));
  };
  api.state.whatsapp.selectedId=chatA;api.state.whatsapp.messages=[];api.state.whatsapp.loadingHistory=false;api.state.whatsapp.historyLoadingId='';api.state.whatsapp.historyRequestId=0;
  const historyA=api.loadMobileWaHistory(chatA,{silent:true});
  await flush();
  api.state.whatsapp.selectedId=chatB;
  const historyB=api.loadMobileWaHistory(chatB,{silent:true});
  await flush();
  historyResolvers.get(chatB)([{idMessage:'b-only',timestamp:2,message:'Mensaje B'}]);
  await historyB;
  historyResolvers.get(chatA)([{idMessage:'a-stale',timestamp:1,message:'Mensaje A'}]);
  await historyA;
  assert.deepEqual(Array.from(api.state.whatsapp.messages,message=>message.idMessage),['b-only'],'La respuesta antigua de otro chat no debe sustituir el chat visible');
  assert.equal(api.state.whatsapp.loadingHistory,false);

  const raceResolvers=[];
  fetchImpl=async(_url,options)=>new Promise(resolve=>raceResolvers.push({chatId:JSON.parse(options.body).chatId,resolve}));
  api.state.whatsapp.selectedId=chatA;api.state.whatsapp.messages=[];api.state.whatsapp.loadingHistory=false;api.state.whatsapp.historyRequestId=10;
  const oldA=api.loadMobileWaHistory(chatA,{silent:true});await flush();
  api.state.whatsapp.selectedId=chatB;const middleB=api.loadMobileWaHistory(chatB,{silent:true});await flush();
  api.state.whatsapp.selectedId=chatA;const newA=api.loadMobileWaHistory(chatA,{silent:true});await flush();
  raceResolvers[2].resolve(response(200,{ok:true,messages:[{idMessage:'a-new',timestamp:3,message:'A nuevo'}]}));await newA;
  raceResolvers[0].resolve(response(200,{ok:true,messages:[{idMessage:'a-old',timestamp:1,message:'A antiguo'}]}));await oldA;
  raceResolvers[1].resolve(response(200,{ok:true,messages:[{idMessage:'b-stale',timestamp:2,message:'B antiguo'}]}));await middleB;
  assert.deepEqual(Array.from(api.state.whatsapp.messages,message=>message.idMessage),['a-new'],'Una respuesta antigua A→B→A no debe sobrescribir el historial nuevo');

  nodes.mobileWaMessages.scrollTop=200;nodes.mobileWaMessages.scrollHeight=1000;nodes.mobileWaMessages.clientHeight=400;
  api.updateMobileWaMessagesDom();
  assert.equal(nodes.mobileWaMessages.scrollTop,200,'El refresco debe conservar la posición cuando se leen mensajes anteriores');

  api.state.whatsapp.selectedId=chatB;api.state.whatsapp.messages=[{idMessage:'b-only',timestamp:2,message:'Mensaje B'}];api.state.whatsapp.loadingHistory=false;
  nodes.mobileWaMessages.writes=0;
  fetchImpl=async()=>response(200,{ok:true,messages:[{idMessage:'b-only',timestamp:2,message:'Mensaje B'}]});
  await api.loadMobileWaHistory(chatB,{silent:true});
  assert.equal(nodes.mobileWaMessages.writes,0,'Un refresco sin cambios no debe reconstruir el historial');
  assert.match(source,/loadMobileWaChats\(\{silent:true,light:true\}\)/);
  assert.match(source,/page==='whatsapp-chat'\?20000:180000/);
  assert.match(source,/if\(action==='wa-back-list'\)go\(mobileWaBackTarget\(\),true\)/);
  assert.match(htmlSource,/id="mobileWhatsAppFileInput"[^>]*accept="image\/\*,video\/\*,audio\/\*,\.pdf,\.doc,\.docx,\.xls,\.xlsx,\.txt"/);
  assert.match(htmlSource,/id="mobileWaActionSheet"[^>]*aria-hidden="true"/);

  console.log('mobile WhatsApp UI and safeguards: ok');
}

run().catch(error=>{console.error(error);process.exitCode=1;});
