const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('js/modules/offers-pro.js','utf8'),ctx={window:{},Intl,Date};vm.createContext(ctx);vm.runInContext(source,ctx);
const month=ctx.window.TPFOffersPro.madridSaleMonth;
assert.equal(month(new Date('2026-09-30T22:30:00Z')),'2026-10','The default month uses Madrid, even when UTC is still September');
assert.equal(month(new Date('2026-10-31T23:30:00Z')),'2026-11');
const elements=new Map(),node=id=>{if(!elements.has(id))elements.set(id,{value:'',checked:false,textContent:'',classList:{add(){},remove(){},toggle(){}},focus(){}});return elements.get(id)};
let calls=[],saved=0,previewRequests=0;Object.assign(ctx,{$:node,busy:false,directContext:null,directRouter:null,dayOneReady:false,dayOneAvailable:true,dayOneDrafts:new Map(),OPERATORS:['Vodafone'],directOperator:'Vodafone',directNetflix:false,directCounteroffer:false,CRM_TEST_MODE:false,CRM_TEST_PHONE:'695661409',madridSaleMonth:month,current:()=>({id:'synthetic'}),directOfferContext:async()=>({id:'synthetic',managerId:'synthetic',recipientId:'synthetic',ownerName:'Prueba'}),ensureUi(){},esc:x=>x,firstName:x=>x,renderDirectSaleOperator(){},updateDirectSaleInfo(){},loadDirectDayOne(){previewRequests++},setTimeout(){},confirm:()=>true,alert(){},money:x=>x,loadInstances:async()=>{},whatsappContact:()=>null,sb:{rpc:async(name,args)=>{calls.push({name,args});return{data:{ok:true}}}}});
const begin=source.indexOf('async function openDirectSale()'),end=source.indexOf('\nasync function loadCatalog()',begin);
vm.runInContext(source.slice(source.indexOf('function directSalePending()'),source.indexOf('function updateDirectSaleInfo()'))+source.slice(begin,end),ctx);
(async()=>{
 await ctx.openDirectSale();assert.equal(node('directSaleMonth').value,month());assert.equal(node('directSaleStatus').value,'accepted');
 node('directSalePrice').value='27';await ctx.submitDirectSale();assert.equal(calls.length,1);assert.equal(calls[0].name,'crm_create_direct_sale_v9');assert.equal(calls[0].args.p_initial_status,'accepted');assert.equal(calls[0].args.p_after_sale,null);assert.equal(calls[0].args.p_send_day_one,false);assert.equal(calls[0].args.p_sale_month,month());
 node('directSaleStatus').value='processed';ctx.dayOneReady=true;ctx.directRouter={get:()=>({send:true,text:'Aviso',workflow:'installation_v1'}),saveTemplate:async()=>saved++};await ctx.submitDirectSale();assert.equal(saved,1);assert.equal(calls[1].args.p_initial_status,'processed');assert.equal(calls[1].args.p_after_sale.workflow,'installation_v1');assert.equal(calls[1].args.p_send_day_one,true);
 node('directSaleStatus').value='accepted';ctx.directRouter={get(){throw Error('Hidden installation fields must not be read')},saveTemplate(){throw Error('Must not save a pending template')}};await ctx.submitDirectSale();assert.equal(calls[2].args.p_after_sale,null);
 console.log('direct-sale-pending-ui: visible Madrid month, default pending and correct RPC payloads passed');
})().catch(e=>{console.error(e);process.exit(1)});
