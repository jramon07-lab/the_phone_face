const fs=require('fs');
const assert=require('assert');
const source=fs.readFileSync('js/modules/contacts-list-avatars.js','utf8');
const profile=fs.readFileSync('js/modules/contact-desktop-layout.js','utf8');
const index=fs.readFileSync('index.html','utf8');
assert(source.includes("await waLoadAvatar(phone+'@c.us')"),'Las fotos deben reutilizar el cargador seguro de WhatsApp');
assert(!source.includes('contactCanUseWhatsapp'),'La lista no debe depender de que haya una ficha de contacto abierta');
assert(source.includes('setTimeout(resolve,280)'),'Las fotos deben solicitarse de forma controlada');
assert(source.includes('TPFContactPhotoViewer'),'Al pulsar la foto debe abrirse el visor compartido');
assert(source.includes("e.key!=='Enter'&&e.key!==' '"),'Los avatares deben ser accesibles con teclado');
assert(profile.includes('window.TPFContactPhotoViewer'),'La ficha debe compartir su visor con la lista');
assert(index.includes('contacts-list-avatars.js?v=20260926-visible-avatars-1'),'El navegador debe cargar el módulo de fotos de la lista');

// Real queue behavior: an offscreen or hidden contact must not start a read.
const vm=require('node:vm');
let rect={width:40,height:40,top:10,bottom:50},calls=0;
const el={isConnected:true,dataset:{contactAvatar:'',phone:'34600000000'},getBoundingClientRect:()=>rect};
const timers=[];
const ctx={window:{innerHeight:800,TPFModules:{register(){}}},document:{querySelectorAll:()=>[el]},
 setTimeout(fn){timers.push(fn);return timers.length;},clearTimeout(){},
 waLoadAvatar:async()=>{calls++;return '';}};
vm.createContext(ctx);
vm.runInContext(source.replace("M.register('contacts-list-avatars',{install});","window.check={hydrate,run,queue,queued};"),ctx);
(async()=>{
 const a=ctx.window.check;
 rect={width:0,height:0,top:0,bottom:0};a.hydrate();timers.shift()();
 assert.equal(calls,0,'Hidden contact list must not request photos');
 rect={width:40,height:40,top:900,bottom:940};a.hydrate();timers.shift()();
 assert.equal(calls,0,'Offscreen rows must not request photos');
 rect={width:40,height:40,top:10,bottom:50};a.hydrate();timers.shift()();
 await Promise.resolve();assert.equal(calls,1,'Visible photos still load');
 console.log('Contact photo visibility queue OK');
})().catch(e=>{console.error(e);process.exitCode=1});
