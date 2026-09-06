'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):/\.(c?js|mjs)$/.test(e.name)?[path.join(dir,e.name)]:[]);}
let failed=0;const files=['js','api','lib','scripts'].flatMap(walk);
for(const file of files){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status!==0){failed++;console.error(file+'\n'+r.stderr);}}
console.log(`${files.length-failed}/${files.length} JavaScript files valid`);process.exitCode=failed?1:0;
