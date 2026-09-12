'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('js/modules/contact-batch-verification.js','utf8')
 .replace("M.register('contact-batch-verification',{install});","window.testApi={analyzeRows,summary,label};");
const context={window:{TPFModules:{}},Map,Set,JSON,String,Array,Object,RegExp,Date,URLSearchParams};
vm.createContext(context);vm.runInContext(source,context);
const {analyzeRows}=context.window.testApi;
const norm=value=>String(value||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('es-ES');
const p=value=>String(value||'').replace(/\D/g,'').replace(/^34(?=\d{9}$)/,'').slice(-9);
const api={
 contactData:row=>row.c,
 googlePhones:person=>(person.phoneNumbers||[]).map(item=>item.value),
 strictGoogleAligned:(person,c)=>norm(person.first)===norm(c.first)&&norm(person.last)===norm(c.last)&&norm(person.nickname)===norm(c.nickname),
 strictWhatsappAligned:(chat,c)=>!!c.first&&!!c.last&&norm(chat.name)===norm(c.name),
 savedVerification:()=>false,
 googleView:person=>({name:[person.first,person.last].filter(Boolean).join(' '),nickname:person.nickname||''})
};
const crm=(id,name='María Rosa Ortiz',nickname='Tienda',number='622558518',extra={})=>({id,data:extra,c:{id,first:'María Rosa',last:'Ortiz',name,nickname,phone:number}});
const google=(id,first='María Rosa',last='Ortiz',nickname='Tienda',number='622558518')=>({resourceName:id,first,last,nickname,phoneNumbers:[{value:'+34'+number}]});
const wa=(name='María Rosa Ortiz',number='622558518')=>({id:'34'+number+'@c.us',name});

let result=analyzeRows([crm('one')],[google('people/one')],[wa()],api,'shop@example.test');
assert.equal(result[0].status,'safe','solo una coincidencia exacta puede validarse');

result=analyzeRows([crm('one')],[google('people/one')],[wa('María Rosa')],api,'shop@example.test');
assert.equal(result[0].status,'whatsapp_name_mismatch','un nombre de WhatsApp incompleto no es válido');

result=analyzeRows([crm('one')],[google('people/one','María Rosa','Ortiz','Otro apodo')],[wa()],api,'shop@example.test');
assert.equal(result[0].status,'google_data_mismatch','un apodo distinto en Google no es válido');

result=analyzeRows([crm('one'),crm('two')],[google('people/one')],[wa()],api,'shop@example.test');
assert.ok(result.every(item=>item.status==='crm_phone_duplicate'),'un número compartido por dos fichas CRM nunca se valida automáticamente');

result=analyzeRows([crm('one')],[google('people/one'),google('people/two')],[wa()],api,'shop@example.test');
assert.equal(result[0].status,'google_duplicate','dos contactos de Google con el mismo teléfono requieren revisión');

result=analyzeRows([crm('one','María Rosa Ortiz','Tienda','622558518',{TPF_GOOGLE_CONTACT:{resource_name:'people/own',google_account:'shop@example.test'}})],[google('people/own'),google('people/other')],[wa()],api,'shop@example.test');
assert.equal(result[0].status,'safe','un vínculo explícito de Google conserva la ficha correcta aunque se repita el teléfono');

result=analyzeRows([crm('one','María Rosa Ortiz','Tienda','622558518',{TPF_GOOGLE_CONTACT:{resource_name:'people/own',google_account:'otra@example.test'}})],[google('people/own')],[wa()],api,'shop@example.test');
assert.equal(result[0].status,'google_account_mismatch','nunca se reutiliza un vínculo de otra cuenta de Google');

const inline=fs.readFileSync('js/modules/contact-google-inline.js','utf8');
assert.match(inline,/function saveStrictVerification/,'la aplicación segura debe vivir junto a la verificación existente');
const saveSlice=inline.slice(inline.indexOf('async function saveStrictVerification'),inline.indexOf('async function reviewProfile'));
assert.match(saveSlice,/source:'verificacion_estricta'/,'el guardado seguro deja trazabilidad');
assert.doesNotMatch(saveSlice,/\bNOMBRE\s*=/,'la validación masiva no puede reescribir el nombre');
assert.doesNotMatch(saveSlice,/\bAPELLIDOS\s*=/,'la validación masiva no puede reescribir los apellidos');
assert.doesNotMatch(saveSlice,/\bAPODO\s*=/,'la validación masiva no puede reescribir el apodo');
assert.match(source,/No se envían mensajes/,'la interfaz debe dejar claro que el análisis no manda WhatsApp');
assert.match(source,/fetch\('\/api\/green\?action=chats'/,'debe usar los nombres originales devueltos por WhatsApp');
assert.match(source,/DNI \/ NIF/,'la revisión por lotes debe mostrar el DNI o NIF del CRM');
assert.match(source,/Validar seleccionados/,'la revisión por lotes debe permitir validar una selección manual');
assert.match(source,/selectedSafe\(\)/,'solo las coincidencias elegidas pueden validarse');
assert.match(source,/selectedIds\.has\(rowKey\(row\)\)/,'la aplicación debe conservar exactamente la selección tras volver a comprobar');
console.log('PASS comprobación masiva: solo valida coincidencias estrictas CRM, Google y WhatsApp');
