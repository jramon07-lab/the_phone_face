const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={window:{},Intl};vm.createContext(ctx);vm.runInContext(fs.readFileSync('js/modules/offers-pro.js','utf8'),ctx);const api=ctx.window.TPFOffersPro;
for(const operator of api.OPERATORS){
 const o={operator,base_price:46.9,base_features:['Fibra 500 Mb','2 líneas con 200 GB compartidos'],line_options:[]};
 const original=JSON.stringify(o);
 const m=api.buildMessage(o,{},'Miriam','',null,{},false,{1:1});
 assert.match(m,/1 línea con 200 GB\n/);assert.doesNotMatch(m,/compartidos/);assert.match(m,/46,90/);assert.equal(JSON.stringify(o),original);
 assert.match(api.buildMessage(o,{},'Miriam'),/2 líneas con 200 GB compartidos/);
}
const o2={base_price:40,base_features:['Fibra 600 Mb','1 línea de 10 GB','1 línea de 40 GB'],line_options:[]};
const m=api.buildMessage(o2,{},'Ana','',null,{},false,{1:0});assert.doesNotMatch(m,/10 GB/);assert.match(m,/40 GB/);
const opt={base_price:52,base_features:['Fibra 600 Mb','2 líneas de 160 GB'],line_options:[{id:'u',replaces_text:'2 líneas de 160 GB',message_text:'2 líneas con datos ilimitados',price_delta:4}]};
assert.match(api.buildMessage(opt,{u:1},'Ana','',null,{},false,{1:1}),/1 línea con datos ilimitados/);
assert.match(api.buildMessage(opt,{u:1},'Ana','',null,{},false,{1:1}),/56,00/);
const mm={base_price:46.9,base_features:['Fibra 500 Mb','2 líneas con 200 GB compartidos'],line_options:[{id:'a',group_name:'shared_gb',data_gb:25,price_delta:5}]};
assert.match(api.buildMessage(mm,{a:1},'Ana','',null,{},false,{1:1}),/2 líneas con 225 GB compartidos/);
assert.match(api.buildMessage(mm,{a:1},'Ana','',null,{},false,{1:1}),/51,90/);
console.log('PASS visible lines across operators, separate O2 lines, replacements, additional shared data, unchanged prices/catalog');
