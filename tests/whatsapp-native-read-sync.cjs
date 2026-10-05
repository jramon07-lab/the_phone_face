const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('js/modules/whatsapp-read-guard.js','utf8');
(async()=>{
 const calls=[],rows=new Map(),id='34600000000@c.us';let next={};
 function device(){const window={waLiveState:{unread:{[id]:4},livePreview:{}},TPFModules:{register:(_,m)=>m.install(),report:()=>{}},waApi:async()=>next,sb:{rpc:async(name,args)=>{
  if(name==='crm_whatsapp_mark_internal_read'){calls.push(args);rows.set(id,{chat_id:id,read_ts:args.p_ts,last_incoming_ts:1002,unread_count:2});return {data:args.p_ts};}
  return {data:[...rows.values()]};
 }}};vm.runInNewContext(src,{window,Date,Map,Set,Promise,Number,setTimeout:()=>0,setInterval:()=>0,clearInterval(){},document:{hidden:false,addEventListener(){}}});return window;}
 const pc=device(),mobile=device();
 const snapshot=(at,extra={})=>({nativeReadSnapshotAt:at,chats:[{id,unreadCount:0,_lastIncomingAt:1000}],...extra});
 next=snapshot(1300000);await pc.waApi('summary');assert.equal(calls.length,0);
 next=snapshot(1390000,{degraded:true});await pc.waApi('summary');assert.equal(calls.length,0);
 next=snapshot(1390000);await pc.waApi('summary');assert.equal(calls[0].p_ts,1000);
 await mobile.TPFPrivateReads.sync();assert.equal(mobile.waLiveState.unread[id],2,'newer messages survive on other device');
 calls.length=0;rows.clear();const fresh=device();
 await fresh.TPFPrivateReads.reconcileNative(snapshot(1300000));
 await fresh.TPFPrivateReads.reconcileNative(snapshot(1390000,{chats:[{id,_lastIncomingAt:1000}]}));
 await fresh.TPFPrivateReads.reconcileNative(snapshot(1400000));assert.equal(calls.length,0,'missing unread count resets confirmation');
 await fresh.TPFPrivateReads.reconcileNative(snapshot(1490000,{chats:[{id,unreadCount:0,_lastIncomingAt:1489}]}));assert.equal(calls.length,0,'recent arrivals never clear');
 await fresh.TPFPrivateReads.reconcileNative(snapshot(1500000,{chats:[{id,unreadCount:2,_lastIncomingAt:1000}]}));
 await fresh.TPFPrivateReads.reconcileNative(snapshot(1600000));assert.equal(calls.length,0);
 await fresh.TPFPrivateReads.reconcileNative(snapshot(1700000,{chats:[{id,unreadCount:0,_lastIncomingAt:1001}]}));assert.equal(calls.length,0,'new watermark restarts confirmation');
 await fresh.TPFPrivateReads.reconcileNative(snapshot(1800000,{chats:[{id,unreadCount:0,_lastIncomingAt:1001}]}));assert.equal(calls[0].p_ts,1001);
 assert.match(fs.readFileSync('js/mobile-app.js','utf8'),/await window\.TPFPrivateReads\?\.reconcileNative\(result\)/);
 console.log('PASS: native reads synchronize across CRM devices; stale/missing counts and new arrivals stay safe');
})().catch(e=>{console.error(e);process.exitCode=1});
