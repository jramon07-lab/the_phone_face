'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const files=fs.readdirSync('tests').filter(f=>f.endsWith('.cjs')||f.endsWith('.unit.js')).sort();let failed=0;
for(const file of files){const r=spawnSync(process.execPath,['-r',path.resolve('scripts/test-offline.cjs'),path.join('tests',file)],{encoding:'utf8',timeout:30000,env:{PATH:process.env.PATH,TZ:'UTC',NODE_ENV:'test'}});console.log(`${r.status===0?'PASS':'FAIL'} ${file}`);if(r.status!==0){failed++;console.error(r.error?.message||r.stderr||r.stdout);}}
console.log(`${files.length-failed}/${files.length} tests passed`);process.exitCode=failed?1:0;
