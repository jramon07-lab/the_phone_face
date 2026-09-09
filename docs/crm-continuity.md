## Checkpoint — 9 de septiembre, 07:45 UTC

- Desarrollo guardado `7ca4b1f`; estable conserva `734db099`, sin promoción nueva.
- Chrome del candidato: `34324473084`, job `102378444534`: **49 aprobadas, 3 omitidas**. Contadores iguales; firma completa de resúmenes convergió en unos 37 segundos.
- Ensayo real `34324454056`, job `102380134957`: **archivado con Supabase real y dos sesiones aprobado**; proveedor WhatsApp simulado. La prueba Drive creó/vinculó la carpeta pero falló esperando un mensaje transitorio que la UI sustituye al listar. No llegó a subir el PDF. Se corrige el criterio para comprobar vínculo persistido, enlace visible y subida habilitada.
- Limpieza de ese ensayo: contacto af47fb47-d832-4e25-9800-8bec64428e0d y papelera: 0; fila sintética de chat retirada; carpeta vacía 1UiFNpABZq_wNN6dfdvs4FUSy5kip-QWp retirada. No repetir sin nueva revisión del resultado.
- **Cambio de base aplicado**: migración `20260909073937 crm_label_management_permissions`. SQL y prueba en db/proposals/crm-label-management-permissions.sql y supabase/tests/label-management-permissions.sql. Bloquea CRUD de etiquetas sin permiso; mantiene demo/admin. Pruebas propuestas con ROLLBACK y repetidas después de aplicar; cero filas sintéticas. CRUD Chrome pasó después.
- Se descubrió rama Supabase antigua yebjacgqrycxcvpewmzq: 30 tablas, sin usuarios Auth, 3 cron activos. No se modificó ni se considera una recuperación actual.
- Matriz completa y bloqueos actuales en docs/crm-audit/README.md. La auditoría sigue abierta.

## Ensayo de integraciones reales preparado

- Workflow `CRM Live Integrations Audit`: prueba separada de la validación diaria; usa el mismo bloqueo de cuenta y espera el commit desplegado.
- Archivo WhatsApp: único identificador sintético `000009092026001@c.us`; dos sesiones, escritura/lectura reales de Supabase y proveedor simulado. Retirar exclusivamente esa fila al cerrar los contextos.
- Drive: contacto sin teléfono/correo/bienvenida; crea carpeta y PDF propios, prueba papelera de una segunda copia y elimina el contacto de prueba. Después descargar el PDF retenido con el conector, cotejar SHA256 y eliminar exclusivamente los archivos y carpeta identificados en el log.
- No ejecutar de nuevo el ensayo hasta terminar la limpieza registrada. No se ha completado todavía.
- El endpoint de configuración de confirmaciones WhatsApp también exige administrador y método POST.

## Checkpoint de autorización de servicios — candidato en desarrollo

- `c5d6936`: Chrome `34322276395`, job `102371397768`, **46 aprobadas, 3 omitidas**. Dos sesiones: 2.266 conversaciones, 69 recientes, igualdad comprobada; reposo de automatizaciones: 0 mutaciones.
- `62b2f40`: copias v3 guardadas; Chrome `34322723611` en curso en la última consulta.
- Candidato siguiente: exigir sesión/permiso del CRM en WhatsApp y Telegram, adjuntar la sesión solo a llamadas del mismo origen y descargar archivos mediante petición autenticada sin credenciales en URL.
- Pruebas nuevas de autorización y descarga; regresiones locales **98/98**, sintaxis válida. Pendiente Chrome antes de promover al estable.
- Los ejecutores de Supabase usan el dominio antiguo de producción; revisar su autenticación al corregir o promover ese dominio. No cambiar su destino sin verificar entregas y autorización del servidor.
- La auditoría integral continúa: mantener pendientes explícitos en `docs/crm-audit/README.md`; no declarar 100 % validado.

## Checkpoint de copias v3 — 9 de septiembre de 2026

- El usuario ha mostrado de nuevo «Streaming interrumpido» en el chat. El trabajo anterior está guardado en `c5d69367c850194ff1a00980b720dee09b8023ad`; no reiniciar la auditoría.
- Copia ampliada de 38 a 42 tablas públicas; paginación de archivados por `chat_id`; lectura compatible con copias v2. Pruebas locales de cobertura de esquema, integridad y API aprobadas.
- Esquema observado: 46 tablas públicas y 3 privadas. Todas con RLS. Inventario sin datos de clientes en `docs/crm-audit/database-inventory.json`.
- La copia diaria y la restauración completa siguen pendientes; no confundir este cambio de código con una copia real reciente.
- Revisión de acceso a servicios WhatsApp/Telegram abierta: comprobar sesión del CRM en servidor y compatibilidad de descargas, móvil y ejecutores antes de promover cambios.
- Chrome de `c5d6936`: Actions `34322276395`, job `102371397768`, en curso en la última consulta. Estable sigue `734db099`.

## Avance de auditoría: correcciones candidatas, pendientes de Chrome

- Reproducción roja y corrección de orden de captura del aviso de borrador; el retorno a WhatsApp espera al cierre aceptado.
- Reproducción roja y corrección de reconstrucción de automatizaciones al recargar datos idénticos.
- Pruebas nuevas: `whatsapp-contact-edit-back.cjs`, `automations-list-refresh.cjs`; ampliación de `browser-navigation.cjs`.
- Ninguna de estas correcciones se ha promovido al enlace estable todavía. La auditoría de 42 áreas sigue EN CURSO.
- Supabase: 120 respuestas HTTP 200, sin timeout, de los dos ejecutores durante la última hora consultada; no equivalen a entrega de todas las acciones.
- Producción Vercel es un despliegue antiguo (29 de agosto, `dpl_CwYWyd558uX9LtN11KGwFvN3VNjV`), separado del enlace estable de rama. Se investiga la falta de copias diarias.

# The Phone Face CRM — punto de continuidad

## Auditoría completa iniciada — 2026-09-09

El usuario ha pedido revisar todo el CRM y no dejar funciones sin revisar. Continuar desde `docs/crm-audit/README.md` y el inventario de código `docs/crm-audit/source-inventory.json`. No confundir las pruebas anteriores con cobertura completa.

- Base remota recuperada: estable `734db09`, desarrollo `576bcf0`; alias estable READY y sin cambios.
- Ejecución posterior `34287934209`: 44 Chrome superadas, 2 fallidas, 3 omitidas. Dos sesiones WhatsApp pasaron; revisar protección de borradores de contacto y parpadeo de automatizaciones.
- Copias: última verified registrada 2026-09-04 18:04 UTC. Microsoft 365: 0 buzones. Revisar programación y recuperación real; no afirmar cobertura completa.
- Inventario inicial: 42 grupos de recorridos con operaciones, criterios, fuentes y estado. El rastreo estático detecta 1.143 candidatos de controles en 165 archivos; no son pruebas aprobadas ni un denominador de cobertura definitivo.
- En curso: reproducción de los dos fallos, ampliación de pruebas reales y contraste de permisos, integraciones y recuperación. Mantener el mismo enlace estable; publicar solo correcciones verificadas.

## Verificación completada — 2026-09-08, 22:48 UTC

**Versión estable actual: `734db09915a7dbf0b6cbc876264274768120838e`. Publicada y verificada antes y después de publicar.**

- Enlace habitual conservado: https://the-phone-face-app-whatsapp-git-4c8eb2-jramon-07-2402s-projects.vercel.app/ .
- Vercel: `dpl_2tuWoJUjgqSu8MJfth4u4TdnS8pS`, READY, commit `734db09`, rama `tmp/contact-profile-recover-20260901`, sin error de alias. Despliegue inmutable: `the-phone-face-app-whatsapp-fotos-y-multimedia-78ncdsijp.vercel.app`.
- Antes de cambios, se repitió la versión anterior `dfa7348`: 92/92 regresiones locales y **46 Chrome superadas, 3 omitidas, 0 fallidas** contra su despliegue estable. Actions https://github.com/jramon07-lab/the_phone_face/actions/runs/34279134442 , intento 2, trabajo `102261946796`.
- Se encontró además una ejecución posterior de desarrollo, https://github.com/jramon07-lab/the_phone_face/actions/runs/34279779860 , con **45 Chrome superadas, 1 fallida y 3 omitidas**. Ambos escenarios de dos sesiones pasaron, pero Cancelar en el editor de contactos permaneció abierto. Se investigó el fallo intermitente; no se ocultó repitiendo esa ejecución hasta que pasase.
- Causa reproducida con prueba local roja: el enfoque automático podía registrar el nombre vacío antes de rellenar los datos; la protección de navegación confundía la carga con un cambio del usuario. El editor establece ahora la referencia inicial después de rellenar los datos, antes de esperar las etiquetas. Las respuestas de etiquetas de una edición ya cerrada no reinstalan sus controles.
- Pruebas añadidas: `tests/contact-editor-loading.cjs` comprueba carga inicial, borrador real durante la espera y Cancelar antes de recibir etiquetas. El recorrido Chrome de contactos comprueba Cancelar sin cambios, proteger un borrador y recuperar el valor original, sin guardar cambios en ese contacto.
- Candidato en desarrollo, antes de publicar: **93/93 regresiones y 46 Chrome superadas, 3 omitidas, 0 fallidas**. Actions https://github.com/jramon07-lab/the_phone_face/actions/runs/34286517219 , trabajo `102263724158`, commit `734db09`, destino `the-phone-face-app-whatsapp-fotos-y-multimedia-diji4jhdf.vercel.app`.
- Después de publicar: **144/144 JavaScript válidos y 93/93 regresiones**. Actions https://github.com/jramon07-lab/the_phone_face/actions/runs/34287234178 , trabajo `102265514603`.
- Chrome sobre el despliegue estable publicado: **46 superadas, 3 omitidas, 0 fallidas**. Actions https://github.com/jramon07-lab/the_phone_face/actions/runs/34287248785 , trabajo `102265564685`. El log confirma commit `734db09` y destino `78ncdsijp`.
- En esa última ronda, dos sesiones autenticadas coincidieron en **2.266 conversaciones**, 68 con mensaje reciente, historial y contadores. Salud GREEN: HTTP 200, authorized, providerHealthy true, degraded false. Los ensayos de archivo compartido, error al guardar, deshacer lento, respuestas atrasadas y recuperación de conexión pasaron.
- La entrada HTML del enlace habitual referencia la versión correcta; `contact-profile.js` y `runtime.js` servidos por ese enlace coinciden exactamente con el código verificado.
- Preservación: no se migró la base ni se cambiaron proveedores. Las escrituras de la suite general se limitan a registros sintéticos con limpieza; la lectura real de WhatsApp no envía ni marca leído. Los ensayos de archivado en navegador usan un almacén compartido simulado; no se presentan como una escritura de archivo real entre los ordenadores físicos.
- Siguen fuera Microsoft 365 (2 pruebas omitidas) y diagnóstico administrativo (1 omitida); se conservan los límites de la sección final y de `docs/crm-functional-validation.md`.
- Para cargar la corrección en pestañas ya abiertas: guardar lo pendiente y recargar una vez en ambos ordenadores.
- Este informe final se guarda en desarrollo como cambio exclusivamente documental. La rama estable conserva exactamente `734db09`; no se debe confundir el commit documental posterior con una nueva versión funcional publicada.

## Entrega comprobada — 2026-09-08, 21:16 UTC

**Versión histórica de esta entrega: `dfa73486f5506d79fe701db87a02679cdf1860cc`. Sustituida por la versión verificada indicada arriba.**

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
