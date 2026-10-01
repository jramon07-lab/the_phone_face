const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('js/modules/contact-google-inline.js','utf8');
const code=source.slice(source.indexOf('  async function writeCrm('),source.indexOf('  async function addAssociatedContactToHolder('));
async function scenario(latest){
 const original={NOMBRE:'Ana',APELLIDOS:'Uno',APODO:'',NOTAS:'Original'};let writes=0,saved;
 const sb={from(){let patch;const q={update(p){patch=p;return q},eq(){return q},select(){return q},async single(){if(!patch)return {data:{id:'one',data:latest}};writes++;if(writes===1)return {data:null};saved=patch.data;return {data:{id:'one',data:saved}}}};return q}};
 const ctx={sb,displayCase:v=>v,safe:v=>String(v??''),verificationSignature:r=>JSON.stringify([r.data.NOMBRE,r.data.APELLIDOS,r.data.APODO]),Object,JSON,Error};vm.createContext(ctx);vm.runInContext(code+';this.write=writeCrm;',ctx);
 try{await ctx.write({id:'one',data:original},'Ana Maria','Uno','',null,null);return {writes,saved};}catch(error){return {writes,error};}
}
(async()=>{
 let r=await scenario({NOMBRE:'Otra persona',APELLIDOS:'Uno',APODO:'',NOTAS:'Original'});assert.match(r.error.message,/otro dispositivo/);assert.equal(r.writes,1,'No retry write may overwrite conflicting identity');
 r=await scenario({NOMBRE:'Ana',APELLIDOS:'Uno',APODO:'',NOTAS:'Edited on PC 2'});assert.equal(r.error,undefined);assert.equal(r.saved.NOMBRE,'Ana Maria');assert.equal(r.saved.NOTAS,'Edited on PC 2');
 r=await scenario({NOMBRE:'Ana Maria',APELLIDOS:'Uno',APODO:'',NOTAS:'Original'});assert.equal(r.error,undefined);
 console.log('PASS concurrent identity conflict rejected; unrelated changes and identical edits preserved');
})().catch(e=>{console.error(e);process.exitCode=1});
