'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
function clock(){let id=0;const jobs=new Map();return {setTimeout(fn){jobs.set(++id,fn);return id},clearTimeout(n){jobs.delete(n)},get size(){return jobs.size},flush(){const all=[...jobs.values()];jobs.clear();all.forEach(fn=>fn())}}}
(async()=>{
 // Hundreds of unrelated list mutations must not queue global modal scans.
 const timer=clock(),presence={window:{TPFModules:{register(){}}},...timer,document:{getElementById(){return null}},setInterval(){}};
 vm.createContext(presence);vm.runInContext(read('js/modules/edit-presence.js').replace("M.register('edit-presence'","window.checks={relevantMutation,scheduleDetect};M.register('edit-presence'"),presence);
 const {relevantMutation,scheduleDetect}=presence.window.checks;
 assert.equal(relevantMutation({type:'childList',addedNodes:[{nodeType:1,matches:()=>false,querySelector:()=>null}]}),false);
 assert.equal(relevantMutation({type:'attributes',target:{matches:()=>false}}),false);
 assert.equal(relevantMutation({type:'attributes',target:{matches:()=>true}}),true);
 for(let i=0;i<500;i++)scheduleDetect();assert.equal(timer.size,1);timer.flush();assert.equal(timer.size,0);
 // Sales keystrokes remain immediate; expensive board rendering runs once per burst.
 const main=read('js/core/20-main.js'),salesClock=clock();let draws=0;
 const search={};const sales={$:()=>search,...salesClock,renderSales(){draws++}};
 vm.runInNewContext(main.slice(main.indexOf('let salesSearchTimer;'),main.indexOf('\n',main.indexOf('$("salesSearch").oninput='))),sales);
 for(let i=0;i<200;i++)search.oninput();assert.equal(draws,0);assert.equal(salesClock.size,1);salesClock.flush();assert.equal(draws,1);
 // Search reuses task rows/statistics/linked contacts; refresh and expiry still fetch.
 const agendaSource=read('js/modules/agenda-core.js');let taskReads=0,statsReads=0,contactReads=0,rendered=[],wait=null,now=1000;
 const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',style:{},classList:{contains:()=>true}});return nodes.get(id)};
 node('agendaFilter').value='pending';
 const ctx={Date:class extends Date{static now(){return now}},Map,Promise,perms:{is_admin:true},agendaLoadVersion:0,agendaDateFilter:'all',agendaCalendarMonth:new Date(),agendaContactCache:new Map(),$:node,window:{},esc:String,
 agendaDateRange:()=>null,syncAgendaFilterUi(){},visibleRows(rows){return rows.filter(r=>r.title.includes(node('agendaSearch').value))},
 async agendaLoadStats(){statsReads++;return {data:[]}},async agendaLoadLinkedContacts(){contactReads++;return new Map()},async agendaResolveContact(){return null},updateStats(){},renderList(rows){rendered=rows},renderCalendar(){},
 sb:{from(){const chain=new Proxy({}, {get(_,key){if(key==='then')return resolve=>{taskReads++;resolve({data:[{id:'a',title:'alpha'},{id:'b',title:'beta'}]})};return ()=>chain}});return chain},async rpc(){if(wait)await wait;return {data:[]}}}};
 vm.createContext(ctx);vm.runInContext(agendaSource.slice(agendaSource.indexOf('let agendaSnapshot='),agendaSource.indexOf('$("agendaFilter").onchange=')),ctx);
 await ctx.loadAgenda();assert.deepEqual([taskReads,statsReads,contactReads],[1,1,1]);
 node('agendaSearch').value='alpha';await ctx.loadAgenda({searchOnly:true});assert.equal(rendered[0].id,'a');
 node('agendaSearch').value='beta';await ctx.loadAgenda({searchOnly:true});assert.equal(rendered[0].id,'b');
 assert.deepEqual([taskReads,statsReads,contactReads],[1,1,1],'Typing must not redownload all tasks and counters');
 await ctx.loadAgenda();assert.deepEqual([taskReads,statsReads,contactReads],[2,2,2],'Explicit refresh must fetch fresh rows');
 now+=31000;await ctx.loadAgenda({searchOnly:true});assert.deepEqual([taskReads,statsReads,contactReads],[3,3,3],'Expired snapshots refresh');
 let release;wait=new Promise(r=>release=r);node('agendaSearch').value='alpha';const old=ctx.loadAgenda({searchOnly:true});
 wait=null;node('agendaSearch').value='beta';await ctx.loadAgenda();release();await old;assert.equal(rendered[0].id,'b','Late search must not replace current results');
 // Dashboard search updates only its results, not unrelated panels.
 const dash=read('js/modules/dashboard-performance-guard.js');let priority=0,unrelated=0;const dashboard={D:{data:{stages:[],tasks:[]}},Map,dashboardOpen:()=>true,status:String,renderPriority(){priority++},renderUpcoming(){unrelated++},renderFocus(){unrelated++},renderCommercial(){unrelated++}};
 vm.runInNewContext(dash.slice(dash.indexOf('function renderWorkSearch()'),dash.indexOf('function bind(){')),dashboard);dashboard.renderWorkSearch();assert.equal(priority,1);assert.equal(unrelated,0);
 console.log('PASS shared UI: coalesced observers/search, scoped dashboard updates, fresh and race-safe Agenda cache.');
})().catch(error=>{console.error(error);process.exitCode=1});
