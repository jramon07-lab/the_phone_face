# The Phone Face CRM — mapa técnico

Base auditada: `b4e99706bb91d4b2f3750d63694cc83534413ee3`.

## WhatsApp en vivo
- Entrada/vista: `#view-whatsapplive`.
- Núcleo de conversaciones, selección, historial, multimedia y matching: `js/modules/whatsapp-green-core.js`.
- Estado: `waLiveState` (`selected`, `contact`, `history`, `chats`, etc.).
- Panel derecho: DOM `#waSidePanel`, tareas `#waSideTasks`, acciones `#waSideViewOpps`, `#waSideViewTasks`, `#waSideCreateContact`, `#waSideOpenContact`.
- Ajustes visuales/acciones laterales validadas: `js/modules/whatsapp-five-fixes.js`.
- Crear contacto moderno: `whatsapp-five-fixes.js` abre el creador de `js/modules/contacts-list-ui.js` (`#tpfContactsAdd`, `#tpfContactsCreateBack`) y rellena nombre/teléfono del chat.
- Protegido: no modificar `whatsapp-green-core.js` para arreglos de navegación del panel derecho.

## Perfil de contacto
- Modal: `#contactModal`.
- Render/datos: `renderContactProfile()` en `js/modules/contacts-sales-core.js` y módulos de perfil/contactos.
- Actividad: `#cpTimeline`; pestañas `#contactModal .cpTabs`.
- Filtro de actividad y puente mínimo desde WhatsApp: `js/modules/contact-activity-tabs.js`.
- Datos de contacto: tabla `records`; contacto activo: `currentContact`.
- Volver desde WhatsApp: debe cerrar páginas de contacto/tarea y conservar `waLiveState.selected` para volver a la misma conversación.

## Oportunidades
- Datos/cache: `salesCache`; relación con contacto por el registro/contacto activo.
- Nueva oportunidad desde contacto: `openContactNewOpportunity()` en `contacts-sales-core.js`.
- Modal detalle: `#oppDetailModal`.
- Botones de contacto: `#cpNewOpp`, `#cpSideNewOpp`.
- Actividad de oportunidades del contacto: `#cpTimeline` + clasificación `cpevent-opportunity`/texto de oportunidad.
- Desde WhatsApp `#waSideViewOpps`: preparar `currentContact=waLiveState.contact`, renderizar perfil y seleccionar directamente actividad `oportunidades`; no abrir primero la ficha general mediante `openWaMatchedContact()`.

## Tareas / Agenda
- Implementación nativa: `js/modules/contacts-sales-core.js`.
- Tabla: `agenda_items`; vínculo: `related_record_id=currentContact.id`.
- Crear: `openContactTaskPage()`; DOM `#cpTaskPage`; botón guardar `#cpTaskSave`.
- Detalle: `openContactTaskDetail(id)`; DOM `#cpTaskDetailPage`.
- Editar/guardar: `#cpTaskDetailSave` actualiza `agenda_items`.
- Completar: `#cpTaskMarkDone`; reabrir: `#cpTaskReopen`; eliminar: `#cpTaskDelete`.
- Refrescos nativos: `renderContactProfile()` y `loadAgenda()` después de mutaciones.
- Hallazgo DOM: `#cpTaskDetailPage` estaba anidado dentro de `#cpTaskPage`; si se oculta el padre, el detalle queda invisible. El puente de actividad debe mover el detalle como hermano una sola vez y después reutilizar las funciones nativas.
- Prohibido: reconstruir tareas o usar `whatsapp-task-bridge.js`.

## Contactos modernos
- Lista/creador: `js/modules/contacts-list-ui.js`.
- Creador: `#tpfContactsAdd` -> `#tpfContactsCreateBack` y campos `#tpfCreateFirst`, `#tpfCreateLast`, `#tpfCreatePhone`.
- Esta ruta está protegida porque ya fue validada desde WhatsApp.

## Navegación / Volver
- Infraestructura general: `tpfRememberScreen()` / `tpfBackExactly()` usada por páginas nativas.
- Para entrada desde panel derecho de WhatsApp se conserva explícitamente el `chatId` de `waLiveState.selected`; Volver/cerrar oculta `cpTaskPage`, `cpTaskDetailPage`, `contactModal`, vuelve a `whatsapplive` y re-selecciona el mismo chat si fuera necesario.

## Pruebas
- Workflow: `.github/workflows/browser-validation.yml`.
- Comando: `npm run test:e2e` (Playwright/Chromium).
- Secretos requeridos: `CRM_TEST_EMAIL`, `CRM_TEST_PASSWORD`, `VERCEL_AUTOMATION_BYPASS_SECRET`.
- Regresión específica añadida: `tests/e2e/crm-whatsapp-right-panel.spec.js`.
- Antes de promover: validar WhatsApp/conversaciones/multimedia/Programar WhatsApp/Contactos/oportunidades, Vercel `READY` y `githubCommitSha === HEAD`.

## Módulos protegidos en este trabajo
- `js/modules/whatsapp-green-core.js` — no tocar.
- `js/modules/contacts-list-ui.js` — conservar creador moderno validado.
- Implementación nativa de tareas en `js/modules/contacts-sales-core.js` — reutilizar, no duplicar.
- Production y ramas estables — no tocar; trabajar en rama temporal y promover solo tras validación completa.
