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
const offer={operator:'Vodafone',name:'Fibra Pro',fiber_mbps:600,included_unlimited_lines:2,base_price:49.9,line_options:[
  {id:'30',name:'Línea 30 GB',data_gb:30,price_delta:5},
  {id:'60',name:'Línea 60 GB',data_gb:60,price_delta:8.5}
]};
assert.equal(api.calculateTotal(offer,{30:2,60:1}),68.4,'line quantities update the total');
const message=api.buildMessage(offer,{30:2,60:1},'Ana García','Precio válido este mes.');
assert.match(message,/Hola Ana/);
assert.match(message,/2 líneas principales con datos ilimitados/);
assert.match(message,/2 líneas adicionales · Línea 30 GB/);
assert.match(message,/1 línea adicional · Línea 60 GB/);
assert.match(message,/68,40 €\/mes/);
assert.match(message,/Precio válido este mes/);

const sql=fs.readFileSync(path.join(root,'db/proposals/offer-configurator.sql'),'utf8');
for(const table of ['crm_offer_catalog','crm_offer_line_options','crm_offer_instances'])assert.match(sql,new RegExp(`alter table public\\.${table} enable row level security`));
assert.match(sql,/p_mode not in \('followup','accepted'\)/);
assert.match(sql,/record_offer_month/);
assert.match(sql,/wait','unit','days','value',2/);
assert.match(sql,/wait','unit','days','value',3/);
assert.match(sql,/r\.trigger_config->>'automation_operator'/);
assert.match(sql,/array\['Vodafone','Yoigo','MásMóvil','O2','Lowi','Orange'\]/);
assert.doesNotMatch(sql,/insert into public\.crm_offer_catalog\([^)]*\)\s*values\s*\([^)]*(Vodafone|Orange)/is,'no invented live tariffs are seeded');

const runner=fs.readFileSync(path.join(root,'supabase/functions/crm-automation-runner/index.ts'),'utf8');
assert.match(runner,/replaceAll\("\{oferta_mensaje\}"/);
assert.match(runner,/replaceAll\("\{operador\}"/);
assert.match(runner,/replaceAll\("\{precio_total\}"/);
console.log('PASS: dynamic offer pricing, message composition, safe catalog, lifecycle and operator routing.');
