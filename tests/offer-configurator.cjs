// Offline checks only: no database rows or WhatsApp messages are created.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/modules/offers-pro.js'),'utf8');
const context={window:{},Intl};
vm.createContext(context);
vm.runInContext(source,context);
const api=context.window.TPFOffersPro;
assert(api,'the offer configurator exposes its deterministic helpers');
assert.deepEqual([...api.OPERATORS],['Vodafone','Yoigo','MásMóvil','O2','Lowi','Orange']);
const offer={operator:'Vodafone',name:'VDF · NOMBRE INTERNO',base_price:52,base_features:['Fibra 600 Mb','2 líneas principales de 160 GB','Amazon incluido'],line_options:[
  {id:'gb',name:'Fibra 1 Gb',price_delta:10,option_type:'radio',message_text:'Fibra 1 Gb',replaces_text:'Fibra 600 Mb'},
  {id:'netflix',name:'Netflix interno',price_delta:4,option_type:'radio',message_text:'Netflix incluido',replaces_text:'Amazon incluido'},
  {id:'extra',name:'Línea adicional interna',price_delta:6,option_type:'quantity',message_text:'Línea adicional de 160 GB'}
]};
assert.equal(api.calculateTotal(offer,{gb:1,netflix:1,extra:2}),78,'options update the calculated total');
const message=api.buildMessage(offer,{gb:1,netflix:1,extra:2},'Ana García','Precio válido este mes.',75);
assert.match(message,/Hola Ana/);
assert.match(message,/Fibra 1 Gb/);
assert.match(message,/2 líneas principales de 160 GB/);
assert.match(message,/Netflix incluido/);
assert.match(message,/Línea adicional de 160 GB × 2/);
assert.match(message,/75,00 €\/mes/);
assert.match(message,/Precio válido este mes/);
assert.doesNotMatch(message,/NOMBRE INTERNO|Netflix interno|Vodafone/,'internal catalog names are never sent to the customer');
assert.doesNotMatch(message,/Fibra 600 Mb|Amazon incluido/,'replaced commercial features are removed');

const sql=fs.readFileSync(path.join(root,'db/proposals/offer-configurator.sql'),'utf8');
for(const table of ['crm_offer_catalog','crm_offer_line_options','crm_offer_instances'])assert.match(sql,new RegExp(`alter table public\\.${table} enable row level security`));
assert.match(sql,/p_mode not in \('followup','accepted'\)/);
assert.match(sql,/record_offer_month/);
assert.match(sql,/wait','unit','days','value',2/);
assert.match(sql,/wait','unit','days','value',3/);
assert.match(sql,/r\.trigger_config->>'automation_operator'/);
assert.match(sql,/array\['Vodafone','Yoigo','MásMóvil','O2','Lowi','Orange'\]/);
assert.doesNotMatch(sql,/insert into public\.crm_offer_catalog\([^)]*\)\s*values\s*\([^)]*(Vodafone|Orange)/is,'no invented live tariffs are seeded');

const sqlV2=fs.readFileSync(path.join(root,'db/proposals/offer-configurator-v2.sql'),'utf8');
assert.match(sqlV2,/crm_create_offer_execution_v2/);
assert.match(sqlV2,/CONTRAOFERTA '\|\|upper\(offer\.operator\)/);
assert.match(sqlV2,/offer_record_month\(rec\.id,opp_id,now\(\)\)/);
assert.match(sqlV2,/VDF · ESTÁNDAR 600 \+ 2×160/);
assert.match(sqlV2,/VDF · CONTRAOFERTA 1 GB \+ 2 ILIMITADAS/);
for(const price of ["'Fibra 1 Gb',10","'Líneas principales ilimitadas',4","'Línea adicional 160 GB',6","'Línea adicional 30 GB',30,6","'Línea adicional 60 GB',60,8.5","'Línea adicional 160 GB',160,11","'Línea adicional ilimitada',null,16"])assert.ok(sqlV2.includes(price),`expected configurable Vodafone price: ${price}`);
assert.match(source,/crm_create_offer_execution_v2/);
assert.match(source,/Precio final para el cliente/);
assert.match(source,/Nombre interno \(no se envía\)/);

const runner=fs.readFileSync(path.join(root,'supabase/functions/crm-automation-runner/index.ts'),'utf8');
assert.match(runner,/replaceAll\("\{oferta_mensaje\}"/);
assert.match(runner,/replaceAll\("\{operador\}"/);
assert.match(runner,/replaceAll\("\{precio_total\}"/);
console.log('PASS: dynamic offer pricing, message composition, safe catalog, lifecycle and operator routing.');
