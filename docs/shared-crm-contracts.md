# Contratos compartidos y comprobación de cambios

## Responsabilidad

| Función | Dueño | Entradas |
|---|---|---|
| Resolver contacto de tarea/oportunidad, incluir titulares gestionados | `js/modules/record-links.js` | Contactos, Ventas, WhatsApp y móvil |
| Validar y guardar tarea; detectar edición simultánea | `js/modules/task-model.js` | Editor de ordenador y editor móvil |
| Formulario de tareas de ordenador | `agenda-core.js` + presentación `agenda-detail-pro.js` | Agenda lista/calendario, ficha, Ventas, WhatsApp |
| Formulario adaptado a móvil | `taskFields()` en `mobile-app.js` | Crear y editar en móvil, mismo modelo de datos |
| Avisos predeterminados de tareas nuevas | `agenda-settings-labels.js` | Aplicados al crear; editar conserva valores guardados |
| Copia y verificación de integridad | `crm-backup-core.js` + `api/crm-backup.js` | Ejecución manual/cron |

Los componentes visuales de ordenador y móvil siguen siendo diferentes. Las reglas compartidas viven en los modelos anteriores; no se debe copiar la lógica de validación, asociación o persistencia en cada pantalla.

## Reglas

- Un identificador explícito tiene prioridad. No sustituir un vínculo borrado por alguien con nombre/teléfono parecido.
- El teléfono antiguo solo enlaza si coincide con un único contacto. No cortar prefijos internacionales arbitrariamente.
- Crear, abrir y editar tareas de ordenador deben pasar por `openAgendaComposer`. Los adaptadores de entradas no crean otro formulario.
- `api/index.js` sirve el código del despliegue. No debe inyectar otro editor ni recuperar silenciosamente HTML de otra rama.
- No dar éxito si falla el guardado. Si falla únicamente el refresco después de guardar, no repetir la escritura.
- No convertir una tarea normal en envío de WhatsApp como efecto secundario.
- No cambiar el motor de conversaciones/multimedia al modificar tareas.

## Puertas de verificación

`npm run verify` comprueba sintaxis, estructura y todas las regresiones locales, con red deshabilitada. Las pruebas de navegador usan las credenciales demo mediante secretos de GitHub y la URL del despliegue. La tarea creada para validación se identifica por ID/título exclusivo, tiene fecha futura y avisos/envíos desactivados; se elimina al finalizar mediante el flujo del CRM.

Cada cambio de formulario debe verificar: abrir desde todas las entradas, crear, editar, volver al origen, borrar/refrescar, tamaños de pantalla y lectura sin permisos de edición. Un éxito de carga o de compilación no acredita estas acciones.

## Límites pendientes del trabajo de recuperación

La unificación de tareas no constituye una reescritura completa de todos los formularios históricos del CRM. Todavía hay adaptadores y parches de otras áreas, que se deben retirar por dominio con pruebas de comportamiento. Tampoco acredita un ensayo de restauración de base/archivos/proveedores. Ver `docs/recovery/README.md`.

El endurecimiento de las seis funciones SQL está preparado en `docs/recovery/restrict-anonymous-functions.sql`; no se ha aplicado sobre la base compartida con otros despliegues.
