'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');

const cards=fs.readFileSync('js/modules/whatsapp-green-core.js','utf8');
assert.match(cards,/compact\?"openOpportunityFull":"openOpportunityCard"/,'La ficha del contacto debe abrir el editor de la oportunidad');
assert.match(cards,/WA_SHARED_SYNC_MS=15000/,'Los dos equipos deben actualizar sin depender de la cola de avisos');
assert.match(cards,/if\(waSharedSyncBusy\)return/,'La sincronización no debe solapar peticiones');

const green=fs.readFileSync('api/green.js','utf8');
assert.match(green,/summary:\$\{minutes\}`,[\s\S]*freshMs: 15000, staleMs: 600000/);
assert.match(green,/history:\$\{chatId\}:\$\{count\}`,[\s\S]*freshMs: 8000, staleMs: 300000/);
assert.match(green,/providerStatus === 429[\s\S]*\["state", "summary", "chats", "history", "previews"\][\s\S]*rateLimited: true/);

const health=fs.readFileSync('api/green-health.js','utf8');
assert.match(health,/getStateInstance/);
assert.doesNotMatch(health,/getSettings/,'La comprobación de salud no debe duplicar consultas de configuración');
assert.match(health,/healthInFlight/,'Las comprobaciones simultáneas deben compartir una sola petición');

const status=fs.readFileSync('api/green-status.js','utf8');
assert.match(status,/statusInFlight/,'Los estados simultáneos deben compartir una sola petición');
assert.match(status,/FRESH_MS = 60000/);

const performance=fs.readFileSync('js/modules/whatsapp-performance-max.js','utf8');
assert.match(performance,/if\(r\?\.degraded\)\{/,'Un límite temporal debe gestionar recuperación sin sustituir el historial');
assert.match(performance,/if\(box&&!waLiveState.history.length\)/,'El aviso solo sustituye una conversación todavía vacía');

const lifecycle=fs.readFileSync('db/proposals/automation_preserve_review_completion.sql','utf8');
assert.match(lifecycle,/action_type not in \('record_offer_month','record_sale_month','prepare_operator_review'\)/);

const system=fs.readFileSync('js/modules/system-status-core.js','utf8');
assert.match(system,/text\.includes\('\/api\/green-status'\)[\s\S]*signal is aborted/,'Un timeout controlado no debe aparecer como avería');

console.log('permanent stability fixes ok');
