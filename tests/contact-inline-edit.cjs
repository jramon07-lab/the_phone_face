const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const ctx={window:{addEventListener(){}},document:{readyState:'loading',addEventListener(){}},perms:{is_admin:true}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('js/modules/contact-inline-edit.js','utf8'),ctx);
const {prepare,saveField}=ctx.window.TPFContactInlineEdit;
function client(data,{race=false,error=false}={}){
 const calls=[];return{calls,from(){let update;
 const q={select(){return q},eq(k,v){calls.push([k,v]);return q},update(v){update=v;calls.push(['update',v]);return q},async maybeSingle(){return update?{data:race?null:{id:'1',data:update.data},error:error?Error('network'):null}:{data:data===null?null:{id:'1',data},error:null}}};return q;}};
}
(async()=>{
 const base={TELÉFONO:'600111222',NOTAS:'Texto protegido',EMAIL:'a@b.es',HOLDERS:['2'],OTHER:'cambio reciente'};
 const c=client(base),result=await saveField({contactId:'1',fieldId:'contactPhone',original:'600111222',value:'600333444'},c);
 assert.equal(result.data.TELÉFONO,'600333444');assert.equal(result.data.NOTAS,base.NOTAS);assert.equal(result.data.OTHER,base.OTHER);assert.deepEqual(result.data.HOLDERS,base.HOLDERS);
 assert(c.calls.some(([k,v])=>k==='data'&&v===JSON.stringify(base)),'Optimistic compare protects concurrent changes');
 for(const [fieldId,original,value,pattern] of [['contactPhone','600111222','abc',/teléfono/],['contactEmail','a@b.es','bad',/correo/],['contactNotes','Texto protegido','',/borrado/],['contactPhone','old','600333444',/otro dispositivo/]]){
  const m=client(base);await assert.rejects(saveField({contactId:'1',fieldId,original,value},m),pattern);assert(!m.calls.some(x=>x[0]==='update'));
 }
 await assert.rejects(saveField({contactId:'1',fieldId:'contactPhone',original:'600111222',value:'600333444'},client(base,{race:true})),/No se ha sobrescrito/);
 await assert.rejects(saveField({contactId:'1',fieldId:'contactPhone',original:'600111222',value:'600333444'},client(base,{error:true})),/network/);
 await assert.rejects(saveField({contactId:'1',fieldId:'contactPhone',original:'600111222',value:'600333444'},client(null)),/no está disponible/);
 const noop=client(base);await saveField({contactId:'1',fieldId:'contactPhone',original:'600111222',value:'600111222'},noop);assert(!noop.calls.some(x=>x[0]==='update'));
 assert.equal(prepare(base,'contactNotes','Texto protegido',' Línea 1\nLínea 2 ').NOTAS,' Línea 1\nLínea 2 ');
 const aliases=prepare({DNI:'old'},'contactDni','old','new');assert.equal(aliases.DNI,'new');assert.equal(aliases['DNI / NIF'],'new');
 const identity={NOMBRE:'María',APELLIDOS:'López','NOMBRE Y APELLIDOS':'María López',NOTAS:'protegida',TPF_RELACIONES:{managed_contacts:[{id:'2'}]}};
 const renamed=prepare(identity,'contactName',JSON.stringify(['María','López']),JSON.stringify(['María José','López Ruiz']));assert.equal(renamed['NOMBRE Y APELLIDOS'],'María José López Ruiz');assert.equal(renamed.NOTAS,'protegida');assert.equal(renamed.TPF_RELACIONES,identity.TPF_RELACIONES);
 assert.throws(()=>prepare(identity,'contactName',JSON.stringify(['Antiguo','López']),JSON.stringify(['Nuevo','López'])),/otro dispositivo/);assert.throws(()=>prepare(identity,'contactName',JSON.stringify(['María','López']),JSON.stringify(['','López'])),/nombre/);
 assert.equal(prepare({APODO:'Tienda',ALIAS:'Tienda'},'contactNickname','Tienda','María tienda').ALIAS,'María tienda');
 ctx.perms={};await assert.rejects(saveField({contactId:'1',fieldId:'contactPhone',original:'600111222',value:'600333444'},client(base)),/permiso/);
 console.log('Inline editing: preservation, validation, aliases, no-op, permissions, conflicts and failures passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
