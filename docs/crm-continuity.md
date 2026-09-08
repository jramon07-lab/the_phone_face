# The Phone Face CRM — punto de continuidad

## Revisión en curso — 2026-09-08, 22:32 UTC

- Petición del usuario: volver a verificar los fallos de dos ordenadores; no crear otro CRM.
- Recuperado de GitHub: estable `dfa73486f5506d79fe701db87a02679cdf1860cc`, desarrollo `eb2eacc44d163fe6ad3c300f8a9a0186d73da712`. Alias estable mantiene `dpl_CETsB7jttidLH4eEz936nFDiwvsT`, READY, mismo enlace.
- Repetido `npm run verify` antes de cambios: 144/144 JavaScript válidos y 92/92 regresiones. Salud en el alias estable: `/api/green-health` HTTP 200, authorized, providerHealthy true, degraded false, 2026-09-08 22:29 UTC.
- Se encontró una ejecución posterior, `34279779860`, con 45 Chrome superadas, 1 fallida y 3 omitidas: ambos escenarios de dos sesiones pasaron, pero Cancelar en el editor de contactos permaneció abierto. Esta ejecución no invalida el resultado histórico de la entrega de abajo, pero revela un fallo intermitente del mismo código.
- Se solicitó una nueva ejecución contra el despliegue estable original: Actions `34279134442`, intento 2, trabajo `102261946796`. Resultado pendiente al guardar este punto.
- Fallo del editor reproducido con prueba local roja; corregido con referencia inicial tras rellenar el formulario y descarte de respuestas de etiquetas de una edición cerrada. Prueba específica verde; Chrome ampliado para mantener la protección de borradores reales.
- Este punto se guarda primero en desarrollo. La versión estable sigue en `dfa7348` hasta verificar el candidato en Chrome.

## Entrega comprobada — 2026-09-08, 21:16 UTC

**Última versión funcional estable: `dfa73486f5506d79fe701db87a02679cdf1860cc`. Publicada y verificada.**

- El enlace habitual sigue siendo https://the-phone-face-app-whatsapp-git-4c8eb2-jramon-07-2402s-projects.vercel.app/ .
- Alias estable comprobado: `dpl_CETsB7jttidLH4eEz936nFDiwvsT`, READY, commit `dfa7348`, rama `tmp/contact-profile-recover-20260901`, sin error de alias.
- Antes de publicar: **92/92 locales y 46 Chrome superadas**, Actions https://github.com/jramon07-lab/the_phone_face/actions/runs/34278428861 .
- Después de publicar: **144/144 JavaScript válidos y 92/92 regresiones** en la rama estable, Actions https://github.com/jramon07-lab/the_phone_face/actions/runs/34279107877 .
- Navegador contra el propio despliegue estable: **46 superadas, 3 omitidas, 0 fallidas**, Actions https://github.com/jramon07-lab/the_phone_face/actions/runs/34279134442 . El log confirma el destino `the-phone-face-app-whatsapp-fotos-y-multimedia-pc7wf7ipj.vercel.app` y el commit `dfa7348`.
- Dos sesiones autenticadas devolvieron el mismo resumen de **2.266 conversaciones**, historial y contadores. Salud GREEN: authorized, providerHealthy true, degraded false.
- El módulo de archivado y la aplicación móvil servidos por el alias estable coinciden byte a byte con el código verificado. Las entradas PC y `/movil/` cargan sus versiones actualizadas.
- Pruebas SQL sintéticas de archivado con ROLLBACK: fechas y atribución correctas; comprobado después que quedan **0 registros sintéticos** de ese ensayo.
- Para cargar la actualización en pestañas que ya estuvieran abiertas: guardar el trabajo pendiente y recargar una vez en ambos ordenadores.
- Este registro final se guarda en **desarrollo** como cambio exclusivamente documental. No sustituye la versión funcional estable `dfa7348` ni publica otro cambio de aplicación.

Los fallos reproducidos de archivado y recuperación de lecturas están corregidos y comprobados. No convertir las 3 pruebas omitidas ni los límites descritos abajo en funciones certificadas.

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

## Incidencia encontrada en la validación de desarrollo

El commit de archivado `f0a0eb867c14dabfce37946c92f1ff282924a45a` pasó la prueba de dos PCs con archivo, fallo de guardado y deshacer lento en Actions `34277615556`, pero **no fue publicado en estable**: la prueba de lectura real falló por `providerStatus:429`. Un servidor devolvía 2.266 conversaciones y otro una respuesta degradada vacía. No se reintentó la ejecución para ocultar el fallo.

Se reprodujo con dos servidores independientes en `tests/green-multiserver-recovery.cjs`. La caché y separación de consultas en memoria solo se comparten dentro del mismo proceso de Vercel; un proceso nuevo que chocaba con otra consulta quedaba en espera de 45 segundos.

`api/green.js` ahora recupera límites breves únicamente en métodos de lectura explícitos: espera al menos 1,25 segundos con variación entre procesos y hasta dos reintentos, respetando `Retry-After`. Esperas solicitadas mayores de 5 segundos se delegan al mecanismo de espera existente. Los envíos, ajustes y consumo de notificaciones no se reintentan por esta vía. No se cambia esquema, infraestructura ni datos de clientes.

Verificación local con ambas correcciones: **92/92**. El resultado Chrome válido debe corresponder al commit que incorpora esta recuperación, no al fallido `f0a0eb8`. Referencia del límite del proveedor: https://green-api.com/en/docs/api/ratelimiter/ .

## Límites que siguen siendo explícitos

- Microsoft 365 pausado (2 pruebas omitidas) y diagnóstico administrativo omitido para la cuenta demo.
- Los ensayos Chrome usan dos contextos independientes, no los dos ordenadores físicos de la tienda.
- La lectura real de WhatsApp no envía mensajes ni marca leído; el cambio de archivo entre pantallas se prueba con almacén compartido simulado, más el ensayo SQL real reversible.
- Resumen/historial de escritorio consultan cada 15 segundos; archivo cada 20 segundos y al recuperar foco o conexión. La sincronización no es instantánea.
- Copia y restauración completa, envío final y automatizaciones reales mantienen las limitaciones descritas en la documentación funcional y `docs/recovery/README.md`.
- Si una interrupción corta el chat, continuar desde este archivo y verificar Actions del último commit. No usar un resultado verde de un commit anterior.
