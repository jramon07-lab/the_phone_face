const {test,expect}=require('@playwright/test');
const path=require('node:path');

test('WhatsApp separa los automáticos hasta que el cliente responde',async({page})=>{
  const now=Math.floor(Date.now()/1000);
  await page.setContent(`
    <section id="view-whatsapplive">
      <div class="waTabs"><button class="active" data-wa-tab="all">Todas</button><button data-wa-tab="contacts">Clientes</button></div>
      <div id="waLiveChats"></div><textarea id="waComposerText"></textarea><button id="waComposerSend">Enviar</button>
    </section>
  `);
  await page.evaluate(now=>{
    window.TPFModules={register(_name,module){module.install()}};
    window.waLiveState={filter:'all',selected:null,chats:[
      {id:'34600000001@c.us',name:'Cliente automático',_lastMessage:{timestamp:now,type:'outgoing'}},
      {id:'34600000002@c.us',name:'Cliente normal',_lastMessage:{timestamp:now,type:'incoming'}}
    ],livePreview:{
      '34600000001@c.us':{timestamp:now,outgoing:true},
      '34600000002@c.us':{timestamp:now,outgoing:false}
    }};
    window.waMessageTimestamp=message=>message?.timestamp||0;
    window.waMessageDirection=message=>message?.type==='outgoing'?'out':'in';
    window.renderWhatsAppChats=function(){
      const rows=window.waLiveState.chats||[];
      document.getElementById('waLiveChats').innerHTML=rows.map(chat=>`<div class="waChatRow" data-chat="${chat.id}"><div class="waChatRowMain"><b>${chat.name}</b></div></div>`).join('')||'<div class="waLiveEmpty">Sin conversaciones</div>';
    };
    const result={data:[{id:'job-1',action_type:'send_template',context:{phone:'34600000001'},completed_at:new Date(now*1000).toISOString()}],error:null};
    window.sb={from(){
      const chain={select(){return chain},eq(){return chain},in(){return chain},gte(){return chain},order(){return chain},limit(){return Promise.resolve(result)}};
      return chain;
    }};
    document.querySelector('.waTabs').addEventListener('click',event=>{
      const button=event.target.closest('[data-wa-tab]');if(!button)return;
      document.querySelectorAll('[data-wa-tab]').forEach(node=>node.classList.toggle('active',node===button));
      window.waLiveState.filter=button.dataset.waTab;window.renderWhatsAppChats();
    });
    window.renderWhatsAppChats();
  },now);

  await page.addScriptTag({path:path.join(process.cwd(),'js/modules/whatsapp-automation-inbox.js')});
  await expect(page.locator('[data-wa-tab="all"]')).toHaveText('Conversaciones');
  await expect(page.locator('#waAutomaticCount')).toHaveText('1');
  await expect(page.locator('#waLiveChats .waChatRow')).toHaveCount(1);
  await expect(page.locator('#waLiveChats')).toContainText('Cliente normal');

  await page.locator('[data-wa-tab="automatic"]').click();
  await expect(page.locator('#waLiveChats .waChatRow')).toHaveCount(1);
  await expect(page.locator('#waLiveChats')).toContainText('Cliente automático');
  await expect(page.locator('.waAutomaticFlag')).toContainText('esperando respuesta');

  await page.evaluate(now=>{
    window.waLiveState.livePreview['34600000001@c.us']={timestamp:now+30,outgoing:false};
    window.renderWhatsAppChats();
  },now);
  await expect(page.locator('#waLiveChats .waChatRow')).toHaveCount(0);
  await page.locator('[data-wa-tab="all"]').click();
  await expect(page.locator('#waLiveChats .waChatRow')).toHaveCount(2);
  await expect(page.locator('#waLiveChats')).toContainText('Cliente automático');
});

