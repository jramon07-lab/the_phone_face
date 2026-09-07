const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const sql=fs.readFileSync(root+'/db/proposals/offer-configurator-o2.sql','utf8');
const source=fs.readFileSync(root+'/js/modules/offers-pro.js','utf8');
const context={window:{},Intl};vm.createContext(context);vm.runInContext(source,context);
const api=context.window.TPFOffersPro;
for(const value of [
  "'O2 · 600 + 60 GB',35::numeric", "'O2 · 600 + 10 GB + 40 GB',35::numeric", "'O2 · 1 GB + 120 GB',38::numeric",
  "'O2 TV · 600 + 35 GB',38::numeric", "'O2 TV · 600 + 60 GB + DISNEY+',45::numeric", "'O2 TV · 600 + 60 GB + NETFLIX',47::numeric",
  "'O2 TV · 1 GB + 350 GB',50::numeric", "'O2 TV · 600 + 60 GB + NETFLIX + DISNEY+',52::numeric",
  "'O2 TV · 1 GB + 375 GB + DISNEY+',56::numeric", "'O2 TV · 1 GB + 375 GB + NETFLIX',58::numeric",
  "'O2 TV · 1 GB + 375 GB + NETFLIX + DISNEY+',62::numeric"
])assert.ok(sql.includes(value),`expected O2 tariff: ${value}`);
for(const value of ["'Línea adicional 40 GB',40,5","'Línea adicional 150 GB',150,10","'Línea adicional 300 GB',300,15"])assert.ok(sql.includes(value),`expected O2 additional line: ${value}`);
assert.equal((sql.match(/'O2 TV ·/g)||[]).length,8,'O2 has eight TV tariffs');
assert.doesNotMatch(sql,/Móvil desde 0/);
assert.match(sql,/No crea oportunidades, trabajos ni mensajes retroactivos/);
assert.equal(api.offerGroupLabel({operator:'O2',base_features:['Fibra 600 Mb']}),'Sin TV');
assert.equal(api.offerGroupLabel({operator:'O2',base_features:['Movistar Plus+ incluido']}),'Con TV');
assert.equal(api.offerGroupLabel({operator:'Yoigo',base_features:['TV incluida']}),'');
const message=api.buildMessage({base_price:35,base_features:['Fibra 600 Mb','1 línea de 60 GB'],line_options:[{id:'l40',name:'Interna',data_gb:40,price_delta:5,option_type:'quantity',message_text:'40 GB'}]},{l40:2},'Eva','',45,{l40:true});
assert.match(message,/2 líneas de 40 GB/);
assert.doesNotMatch(message,/adicional|Interna/);
console.log('PASS: O2 catalog contains 3 no-TV and 8 TV tariffs with individual additional lines.');
