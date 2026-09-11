'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');

const migration=fs.readFileSync('supabase/migrations/20260911195620_offer_response_actions.sql','utf8');
const phoneKeys=fs.readFileSync('supabase/migrations/20260911201500_contact_phone_key_normalization.sql','utf8');
const runner=fs.readFileSync('supabase/functions/crm-automation-runner/index.ts','utf8');

for(const label of ['Me interesa','No me interesa','Quiero otra oferta']){
  assert(migration.includes(label),`falta el botón ${label}`);
}
assert((migration.match(/'reply_buttons',reply_buttons/g)||[]).length>=2,'día 2 y día 5 deben conservar los tres botones');
assert(migration.includes('Hola, {nombre}. Vuelvo a escribirte sobre la oferta de {operador}'),'falta el nuevo texto del día 5');
assert(migration.includes("'accept','decided'"),'Me interesa debe registrar una decisión idempotente');
assert(migration.includes("lower(btrim(name))='pendiente de tramitar'"),'Me interesa debe mover a Pendiente de tramitar');
assert(migration.includes('offer_next_business_date(new.created_at)'),'Me interesa debe fechar el siguiente día hábil');
assert(!migration.match(/selected='accept'[\s\S]{0,1800}insert into public\.agenda_items/),'Me interesa no debe crear tareas');
assert(migration.includes("'decline','awaiting_reason'"),'No me interesa debe pedir el motivo');
for(const reason of ['Es por el precio','Prefiero seguir igual','Más adelante','Otro motivo'])assert(migration.includes(reason),`falta el motivo ${reason}`);
assert(migration.includes("state='awaiting_text'"),'Otro motivo debe habilitar una sola respuesta escrita');
assert(migration.includes("selected is null or selected not in ('accept','decline','alternative')"),'los textos normales deben quedar sin acción comercial');
assert(migration.includes("'alternative','resolved','Cliente solicita otra oferta'"),'Quiero otra oferta debe guardar el motivo');
assert(migration.includes("'Preparar otra oferta'"),'Quiero otra oferta debe crear la tarea');
assert(migration.includes('Perfecto, revisamos otras opciones'),'falta el acuse de la nueva oferta');
assert(migration.includes('crm_offer_outgoing_messages'),'las respuestas deben enlazarse con el mensaje exacto');
assert.match(phoneKeys,/translate\(lower\(e\.key\),'áéíóúüñ','aeiouun'\) like '%telef%'/);
assert.match(phoneKeys,/tpf_whatsapp_chat_id/);
assert(migration.includes('button_ignored'),'una pulsación tardía no debe sobrescribir estados finales');
assert(migration.includes('crm_telegram_business_events'),'las decisiones deben llegar a Telegram desde servidor');
assert(runner.includes('hasOfferDecision'),'el runner debe distinguir decisiones de textos normales');
assert(runner.includes('rememberOfferMessage'),'el runner debe guardar el identificador del mensaje enviado');
assert(!/offerFollowup\(job\)\?hasResponseSince/.test(runner),'una respuesta escrita normal no puede detener el seguimiento');

console.log('PASS: flujo de respuestas de oferta, motivos, movimientos, tareas y Telegram protegido.');
