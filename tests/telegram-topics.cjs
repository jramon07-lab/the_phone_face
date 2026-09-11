'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');

const api=fs.readFileSync('api/telegram.js','utf8');
const ui=fs.readFileSync('js/core/20-main.js','utf8');
const settings=fs.readFileSync('js/modules/whatsapp-scheduling-core.js','utf8');
const html=fs.readFileSync('index.html','utf8');

for(const label of [
  '📅 Agenda y tareas',
  '💬 WhatsApp programados',
  '💰 Ofertas y ventas',
  '🔄 Seguimientos',
  '🚨 Errores e incidencias',
  '📊 Resumen diario'
]) assert(api.includes(label),`Falta el apartado ${label}`);

assert(api.includes('chat?.type !== "supergroup" || chat?.is_forum !== true'),'Solo se deben preparar apartados en un supergrupo con Temas');
assert(api.includes('editGeneralForumTopic'),'Agenda debe reutilizar el tema General');
assert(api.includes('createForumTopic'),'Los apartados deben crearse con la API oficial de Telegram');
assert(api.includes('if (Number(topics[key]) > 0) continue'),'Repetir la preparación no debe duplicar temas ya guardados');
assert(api.includes('message_thread_id: Number(body.message_thread_id) > 0'),'Los mensajes deben poder dirigirse a un tema');
assert(ui.includes('action:"setup-forum"'),'La pantalla debe solicitar la preparación de apartados');
assert(ui.includes('telegram_forum_enabled:true')===false,'No debe marcarse completo antes de leer el resultado de Telegram');
assert(settings.includes('whatsapp_telegram_thread_id'),'WhatsApp debe conservar su apartado');
assert(settings.includes('agenda_telegram_thread_id'),'Agenda debe conservar su apartado');
assert(html.includes('id="notifyTelegramTopics"'),'Debe existir el botón Preparar apartados');

console.log('PASS Telegram forum topics: six sections, routing, validation and duplicate guard');
