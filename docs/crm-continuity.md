# The Phone Face CRM — punto de continuidad

## Reglas de trabajo

- Repositorio único: `jramon07-lab/the_phone_face`.
- Desarrollo: `desarrollo-crm`. Estable: `tmp/contact-profile-recover-20260901`.
- Enlace estable que debe conservarse: https://the-phone-face-app-whatsapp-git-4c8eb2-jramon-07-2402s-projects.vercel.app/
- Se trabaja con **DOS ordenadores simultáneamente**. Una prueba de una sola sesión no basta para validar WhatsApp.
- Recuperar HEAD de ambas ramas, destino del alias en Vercel y últimas Actions antes de modificar. No recuperar una copia local antigua ni sobrescribir trabajo ajeno.
- Preservar clientes, mensajes, documentos, automatizaciones, permisos y esquema. Limitar pruebas de escritura a registros sintéticos; no enviar mensajes a clientes.
- Verificar localmente, guardar en desarrollo, esperar Vercel READY y pruebas Chrome del mismo commit. Solo después actualizar estable, conservando su enlace y verificando de nuevo su destino.
- No declarar terminadas pruebas omitidas ni prometer ausencia de cualquier error futuro.

## Recuperado el 8 de septiembre de 2026

- Ambas ramas remotas: `d37c77c19d12b270e2a788c15e07e0df18a4c746`.
- Alias estable: despliegue `dpl_Hnf2ck2mLZ3kf9g4HkkSEC7Gaovf`, READY, ese mismo commit.
- Proyecto Vercel: `prj_oZaofr9dAryIdELSYA3cfdRrSD7o`; equipo `team_g3JPBt5N7fd8R32fZxYd4NTf`.
- Actions revisadas: https://github.com/jramon07-lab/the_phone_face/actions/runs/34275237368 y https://github.com/jramon07-lab/the_phone_face/actions/runs/34275954839 . Ambas: 46 pruebas Chrome superadas y 3 omitidas.
- En ambas, dos sesiones reales devolvieron 2.266 conversaciones con resumen, historial y contadores iguales. Recuperación de red, aislamiento de chats y archivado usan además fallos simulados.
- `npm run verify` repetido al recuperar: **90/90**.

## Corrección de este punto

Se reprodujeron y corrigieron fallos del archivado de escritorio: una lectura antigua podía revertir el estado visual de un cambio confirmado; las escrituras rápidas podían resolverse en orden inverso; un rechazo de escritura dejaba una decisión solo en local. Ahora hay escrituras secuenciales por conversación, protección ante lecturas antiguas, estado confirmado para recuperarse de errores y aviso visible.

PC y móvil leen el archivo compartido completo por páginas. Si una página falla, no aplican una lista parcial. La importación de archivos locales anteriores solo inserta si no existe el registro remoto. La tabla real tenía 5 registros al comenzar; la paginación es prevención de crecimiento, no explicación del incidente actual.

- Regresiones: `tests/whatsapp-archive-reliability.cjs` y `tests/whatsapp-archive-sync.cjs`.
- Chrome: `tests/e2e/crm-whatsapp-multidevice.spec.js`, ampliado con rechazo de archivo y archivar/deshacer con guardado lento.
- Verificación local de la corrección: **91/91**. Verificación Chrome y promoción: consultar el siguiente registro de entrega; no inferirlas de este texto.
- Prueba SQL con rol autenticado y permiso WhatsApp: registro sintético `__crm_validation_a114d734ae59__`, archivado/recuperado dentro de una transacción y ROLLBACK. No se migró el esquema.
- Documentación de cobertura: `docs/crm-functional-validation.md`.

## Límites que siguen siendo explícitos

### Incidencia encontrada en la validación de desarrollo

El commit de archivado `f0a0eb867c14dabfce37946c92f1ff282924a45a` pasó la prueba de dos PCs con archivo, fallo de guardado y deshacer lento en Actions `34277615556`, pero **no fue publicado en estable**: la prueba de lectura real falló por `providerStatus:429`. Un servidor devolvía 2.266 conversaciones y otro una respuesta degradada vacía. No se reintentó la ejecución para ocultar el fallo.

Se reprodujo con dos servidores independientes en `tests/green-multiserver-recovery.cjs`. La caché y separación de consultas en memoria solo se comparten dentro del mismo proceso de Vercel; un proceso nuevo que chocaba con otra consulta quedaba en espera de 45 segundos.

`api/green.js` ahora recupera límites breves únicamente en métodos de lectura explícitos: espera al menos 1,25 segundos con variación entre procesos y hasta dos reintentos, respetando `Retry-After`. Esperas solicitadas mayores de 5 segundos se delegan al mecanismo de espera existente. Los envíos, ajustes y consumo de notificaciones no se reintentan por esta vía. No se cambia esquema, infraestructura ni datos de clientes.

Verificación local con ambas correcciones: **92/92**. El resultado Chrome válido debe corresponder al commit que incorpora esta recuperación, no al fallido `f0a0eb8`. Referencia del límite del proveedor: https://green-api.com/en/docs/api/ratelimiter/ .

- Microsoft 365 pausado (2 pruebas omitidas) y diagnóstico administrativo omitido para la cuenta demo.
- Los ensayos Chrome usan dos contextos independientes, no los dos ordenadores físicos de la tienda.
- La lectura real de WhatsApp no envía mensajes ni marca leído; el cambio de archivo entre pantallas se prueba con almacén compartido simulado, más el ensayo SQL real reversible.
- Resumen/historial de escritorio consultan cada 15 segundos; archivo cada 20 segundos y al recuperar foco o conexión. La sincronización no es instantánea.
- Copia y restauración completa, envío final y automatizaciones reales mantienen las limitaciones descritas en la documentación funcional y `docs/recovery/README.md`.
- Si una interrupción corta el chat, continuar desde este archivo y verificar Actions del último commit. No usar un resultado verde de un commit anterior.
