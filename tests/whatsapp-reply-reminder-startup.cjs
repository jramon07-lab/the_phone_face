'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const elements=new Map(),observers=[],timeouts=[],intervals=[];
function element(){return {dataset:{},children:[],append(node){this.children.push(node)},querySelector(selector){return selector==='[data-nr-list]'?this.children.find(x=>Object.hasOwn(x.dataset,'nrList'))||null:null}};}
const head=element(),body=element();head.appendChild=node=>head.append(node);
const document={readyState:'complete',head,body,getElementById:id=>elements.get(id)||null,querySelector:()=>null,querySelectorAll:()=>[],createElement:element,addEventListener(){}};
function MutationObserver(fn){this.fn=fn;this.targets=[];this.observe=(target)=>this.targets.push(target);observers.push(this)}
const context={document,window:{addEventListener(){}},MutationObserver,Date,Intl,Map,Set,WeakSet,console,setTimeout:fn=>timeouts.push(fn),setInterval:fn=>intervals.push(fn)};
vm.createContext(context);
vm.runInContext(fs.readFileSync('js/modules/whatsapp-reply-reminders.js','utf8'),context);
assert.ok(observers.some(x=>x.targets.includes(body)),'initialization survives before Control de envíos exists');
assert.equal(intervals.length,1,'reminder polling is installed');
const tabs=element();elements.set('ccPanel',{querySelector:selector=>selector==='.ccSourceTabs'?tabs:null});
observers.find(x=>x.targets.includes(body)).fn();timeouts.shift()();
assert.equal(tabs.children.length,1,'launcher appears when Control de envíos is opened later');
assert.equal(tabs.children[0].textContent,'🔔 Avisos sin respuesta');
observers.find(x=>x.targets.includes(body)).fn();timeouts.shift()();assert.equal(tabs.children.length,1,'repeated updates do not duplicate launcher');
const home=element();elements.set('dashRefresh',{parentElement:home});observers.find(x=>x.targets.includes(body)).fn();timeouts.shift()();assert.equal(home.children.length,1,'Inicio works while optional dashboard sections are absent');
console.log('Reminder startup tolerates absent/later-rendered screens, installs polling and shows launchers without duplicates.');
