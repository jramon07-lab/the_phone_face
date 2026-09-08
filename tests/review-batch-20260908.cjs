'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');

const archive=fs.readFileSync('js/modules/whatsapp-archive-sync.js','utf8');
const waFixes=fs.readFileSync('js/modules/whatsapp-five-fixes.js','utf8');
const offers=fs.readFileSync('js/modules/offers-pro.js','utf8');
const errors=fs.readFileSync('js/modules/automations-execution-controls.js','utf8');
const sql=fs.readFileSync('db/proposals/vodafone-day-one-variants.sql','utf8');

assert.match(archive,/Archivar conversación/);
assert.match(archive,/Desarchivar/);
assert.match(archive,/Deshacer/);
assert.doesNotMatch(waFixes,/b\.textContent=done\?'✓ Atendida':'✓ Marcar atendida'/);

assert.match(offers,/id="directSaleNetflix"/);
assert.match(offers,/crm_create_direct_sale_v2/);
assert.match(offers,/p_netflix_followup/);
assert.match(offers,/Al día siguiente se enviará el mensaje/);

assert.match(sql,/Vodafone · Instalación y devolución de router/);
assert.match(sql,/netflix_template_id/);
assert.match(sql,/general_template_id/);
assert.match(sql,/trigger_config-'required_offer_flag'/);
assert.match(sql,/case when netflix_followup/);
assert.match(sql,/jsonb_set\(r\.action_config,'\{steps,2,config,template_id\}'/);
assert.match(sql,/create or replace function public\.crm_create_direct_sale_v2/);
assert.match(sql,/'netflix_followup',operator_name='Vodafone'/);
assert.match(sql,/revoke all on function public\.crm_create_direct_sale_v2/);

for(const value of ['Centro de control','acOverview','acOperatorFilter','acAutomationFilter','acErrorTypeFilter','Cliente','Ver pasos →','Reintentar paso'])assert.match(errors,new RegExp(value));
assert.match(errors,/firstFailure/);
assert.match(errors,/error_message/);

console.log('PASS bloque de revisión: navegación, archivado, errores y variantes Vodafone');
