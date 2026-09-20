'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/modules/dashboard-performance-guard.js','utf8');
const start=source.slice(source.indexOf('function startWhenReady(){'),source.indexOf('\nfunction install(){'));
for(const initiallyOpen of [false,true]){
 let open=initiallyOpen,builds=0,loads=0,callback,disconnected=0;
 const shell={};
 const context={
  $:()=>shell,appOpen:()=>open,dashboardOpen:()=>open,
  build:()=>builds++,hideTemplateLeak(){},load:()=>loads++,
  document:{addEventListener(){throw new Error('shell already exists')}},
  MutationObserver:class{constructor(cb){callback=cb}observe(node,options){assert.equal(node,shell);assert.equal(options.attributes,true)}disconnect(){disconnected++}}
 };
 vm.runInNewContext(start+';startWhenReady();',context);
 assert.equal(builds,initiallyOpen?1:0);
 // No timer deadline: any number of closed-shell updates before login is safe.
 if(!initiallyOpen){for(let i=0;i<500;i++)callback();assert.equal(builds,0);open=true;callback()}
 assert.equal(builds,1);assert.equal(loads,1);assert.equal(disconnected,1);
 callback();assert.equal(builds,1,'unrelated shell mutations must not rebuild a loaded dashboard');
}
console.log('dashboard initializes after delayed login and only once');
