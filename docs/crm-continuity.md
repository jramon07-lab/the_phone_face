## Publicado y comprobado dec705c — 9 de septiembre, 09:13 UTC

- **Estable real actual: dec705cf3f13061f1759599f92422877ec08a90c**, mismo alias de siempre. No volver a 29f6b31 siguiendo notas históricas. Despliegue **dpl_AFAAzyVRaXs9eTm6ePsaetT4FtZV**, READY; inmutable qoya40w0e.
- Cierre local de PC/móvil/carga fallida de permisos móvil publicado. 100/100 locales, 147/147 JS, Chrome **34331867238** job **102403096927**: 50 aprobadas/3 omitidas. Ambas sesiones 2266 conversaciones/71 recientes, firma e historial iguales, `SESSION_ISOLATION_VERIFIED`, `SALES_SAVE_VERIFIED`.
- Verificación posterior: CI **34332948637** job **102405570452** success; Chrome **34332969490** job **102405636374** **SUCCESS, 50 aprobadas/3 omitidas**. CI confirma 100/100 regresiones y 147/147 JavaScript. Log de Chrome confirma qoya40w0e, ambas sesiones 2266/71, aislamiento de sesión y guardado único por ID. Publicación comprobada antes y después.
- Salud y SHA comprobados; scripts de PC y móvil servidos coinciden exactamente con el repositorio. No se cambiaron los datos de clientes ni se promovió el dominio antiguo de los ejecutores.
- Primer intento 34330713702 falló en consulta de venta; segundo intento, ensayo reforzado y comprobación posterior a publicar pasan. Causa pendiente: no ocultar ni declarar una corrección de ese fallo no reproducido.
- Para cerrar copia/diagnóstico, el navegador propio del administrador debe crear copia y exportar JSON. Remoto bloqueado; no pedir contraseñas ni extraer tokens. Última copia verificada sigue 4 de septiembre. Informe completo y pendientes en docs/crm-audit/release-20260909.md.

## Reanudación — prueba de sesiones y fallo de ventas, 9 de septiembre

- Estable conservado en **29f6b31**, con sus pruebas anteriores y posteriores aprobadas. Candidato de sesiones **229b46b301fcfe86c234d667ebdab661185f1972**: 100/100 locales y 147/147 JavaScript.
- Chrome **34330713702**, intento 1, job **102398391296**: aislamiento de tres sesiones APROBADO, renovación real del segundo PC conservada. Total 49 aprobadas, 1 fallida y 3 omitidas. Falló la consulta única de la venta sintética, sin causa demostrada; no promover basándose en ese resultado. Artefacto **10095871889**.
- Intento 2 del mismo commit, job **102401026910**, en curso al guardar este punto. No se añadieron reintentos automáticos ni se eliminaron aserciones.
- Este checkpoint refuerza la prueba de venta: exige respuesta correcta del RPC de creación, consulta por el ID devuelto y valida título, titular, gestor, importe y ausencia de duplicación. Es un cambio de verificación, no una corrección demostrada del fallo de ventas. Esperar el Chrome del nuevo commit antes de publicar.
- A las 08:52 UTC siguen avisos de Windows 1560a8b5; guardar y recargar ambos equipos. Copia/exportación administrativas siguen necesitando el navegador propio del usuario por bloqueo CDP, no nuevas credenciales.

## Publicación y sesiones — punto de continuidad, 9 de septiembre

- **Estable publicado ahora: 29f6b31d297c00cc7b92926209e26d64443ce70e**, mismo alias. Vercel dpl_3n8FtZBKinPNApkq2E3jGjvSukpJ READY, inmutable mxjcgqabb. No confundir las notas anteriores de estable 734db099 con el estado actual.
- Antes de publicar: 99 locales y Chrome 34328280876, 49 aprobadas/3 omitidas. Después: CI 34329198218 99/99 y 147/147 JavaScript; Chrome **34329217452**, job **102394555384**, **49 aprobadas/3 omitidas**. Ambas sesiones 2266 conversaciones y 71 recientes, resumen e historial iguales.
- Alias /api/health confirma 29f6b31; GREEN authorized/sano; API de resumen sin sesión CRM devuelve 401. HTML actual incluye api-auth.js y el commit correcto; autorización y diagnóstico coinciden byte a byte con el repositorio.
- Cuatro avisos nuevos desde Windows versión 1560a8b5: peticiones sin la nueva autorización. Se indicó al usuario guardar y recargar ambos ordenadores. No borrar estos avisos ni afirmar recuperación sin comprobarla.
- **Candidato siguiente**: cerrar sesión solo en el dispositivo actual. Los tres caminos usaban signOut global por defecto (PC, móvil y fallo de permisos móvil). Corregidos a scope local; test rojo antes/verde después, **100/100 regresiones**. Nuevo Chrome comprueba renovación real del segundo PC tras dos cierres; prohíbe peticiones globales durante la prueba. No se han revocado sesiones para reproducir el fallo.
- La copia manual y la exportación siguen bloqueadas por el navegador remoto: nuevo intento de diálogo y captura vuelve a timeout. No reintentar en bucle ni extraer credenciales; el administrador ya inició sesión correctamente. Paso alternativo necesario: Estado del sistema → Crear copia ahora y confirmar; Exportar diagnóstico y aportar JSON. Última copia sigue 4 de septiembre.
- Informe de publicación y límites: docs/crm-audit/release-20260909.md. Producción y los dos ejecutores continúan con su dependencia anterior; restauración aislada, Microsoft 365 y áreas de la matriz siguen abiertas.

## Punto de reanudación — 9 de septiembre, 08:20 UTC

El usuario ha enviado otra captura de Work con respuestas vacías y «algo ha salido mal». El acceso seguro de administrador YA SE COMPLETÓ. No pedir otra vez las credenciales salvo que la sesión realmente haya caducado. El navegador de administración dejó de responder al abrir la confirmación nativa de la copia; el único intento de pestaña nueva también falló. Solicitar intervención manual, sin extraer cookies/tokens ni cerrar la sesión de la cuenta usada por CI.

- Código candidato guardado: **29f6b31d297c00cc7b92926209e26d64443ce70e**. Verificación local 99/99; JavaScript 147/147. Chrome del mismo commit: ejecución **34328280876**, en curso al guardar este punto. Este commit de continuidad solo modifica documentación.
- Candidato anterior Drive **8a768a7**: Chrome **34327435911**, job 102387839074: **49 aprobadas, 3 omitidas**. Dos sesiones con 2266 conversaciones, 71 recientes, igualdad de resumen e historial. Automatizaciones en reposo: 0 mutaciones.
- Ensayo real **34327416743**, job 102389976359: **2 aprobadas**. Archivo compartido persistido en Supabase entre dos sesiones (proveedor simulado). Drive: creación/vinculación de carpeta, subida confirmada, listado y envío de una segunda copia sintética a papelera aprobados.
- Descarga independiente del PDF retenido: 618 bytes, igualdad exacta y SHA256 **76b734f8fbe3f8304fd29f77373ce6c2a73c4a3d87a3d128fdf33b9e39c3534d**. PDF **1cBaZtyKzzAUw6FEkM4TI5PABZXd3askQ**; carpeta **1RAvcR6Tc56_WS07g4Edgmuzz1Xl06vMq**; segunda copia en papelera **1rdNBuvjeblenco_abD2zNyd4JMtxWtlU**. Conservar artefactos hasta permiso explícito de limpieza; respetar el rechazo automático anterior.
- Contacto sintético d943e5fb-8350-45af-bed7-4480983e07c9 y su papelera: 0. Fila de chat 000009092026001@c.us retirada después de cerrar ambas sesiones.
- Estable sigue **734db09915a7dbf0b6cbc876264274768120838e**, mismo enlace. Ninguna corrección de esta auditoría se ha promovido todavía. No promover con una prueba fallida o desconocida.
- Cambios efectivos de base en esta auditoría: permisos de etiquetas 20260909073937 y de interruptores globales 20260909081241; ambos probados con ROLLBACK y después de aplicar. No se cambió ningún permiso de usuario, cliente ni valor de los interruptores.
- Próximos pasos concretos: consultar Actions 34328280876; recuperar la ventana administrativa para copia v3 y exportación; verificar la copia en historial (la última sigue siendo 4 de septiembre); resolver programación de producción/autenticación del ejecutor; restauración aislada completa y áreas abiertas en la matriz. Microsoft 365 sigue pausado e incompleto.

## Checkpoint — permisos del motor y diagnóstico, 9 de septiembre, 08:13 UTC

- Desarrollo guardado `8a768a7f975fca730daafba5f58ec57cb253d557`: corrección de origen Drive, 98/98 regresiones. Chrome `34327435911` y ensayo real `34327416743` en curso; esperar ambos antes de cambiar ese destino.
- **Migración aplicada** `20260909081241 crm_server_switch_permissions`: reserva al administrador la escritura de `crm_server_automations_enabled` y `crm_server_scheduled_whatsapp_enabled`. Se reprodujo escritura permitida al rol limitado; propuesta y prueba con ROLLBACK aprobadas; repetición después de aplicar aprobada. Ambos interruptores siguen true y quedan 0 ajustes sintéticos. Preferencias ordinarias conservan sus permisos.
- Corrección adicional preparada: Estado del sistema comprueba `current_user_permissions` en servidor y ya no usa solo la sesión en caché; el banner describe comprobaciones básicas. Prueba roja antes/verde después con sesión válida, caducada y respuesta vacía. Verificación completa 99/99 y 147/147 JavaScript.
- Browser administrativo sigue bloqueado por confirmación nativa de copia; apertura de pestaña nueva también falló. SQL confirma que no hubo copia nueva. Conservar sesión y solicitar intervención del navegador cuando el resto de comprobaciones termine.

## Checkpoint — Drive y acceso administrativo, 9 de septiembre

- `b888d3b`: Chrome `34325439846`, job `102381506539`, concluido success: 49 aprobadas (2 + 47), 3 omitidas. Dos sesiones: 2266/2266 y firma igual; automatizaciones en reposo: 0 mutaciones.
- Ensayo adicional `34325419583`, job `102383516362`: archivo compartido real APROBADO otra vez; Drive FALLÓ al confirmar la subida. La conexión independiente encontró el PDF de 618 bytes: SHA256 `76b734f8fbe3f8304fd29f77373ce6c2a73c4a3d87a3d128fdf33b9e39c3534d`, idéntico al generado. La subida sí llegó a Drive.
- Causa: la sesión resumible enviaba el origen estable aunque el navegador usase Preview. Corrección candidata en api/crm-documents.js: validar Origin contra Host HTTPS del propio despliegue; usar ese origen para la respuesta de Google. Prueba local roja antes, verde después; pendiente repetición real. La regresión completa detectó un falso positivo de su filtro de mutaciones en crypto.createHash().update(bytes); se usa crypto.hash sin relajar ese filtro.
- Limpieza de base confirmada: contacto f4eac477-886f-4e1e-a8fd-7c84bcf7c9d7 y papelera 0; fila sintética del chat retirada.
- **Limpieza Drive bloqueada por revisión automática**: NO borrar sin autorización explícita del usuario. PDF `1-5DcqIrn-aqrijtxQdTuc9Ep_XJC6h_r` dentro de carpeta `1-yO2W59hc0J3YbJNKpLwoo1K8TlAGUEG` (Auditoria Integracion 34325419583 Prueba). Ambos se conservan. Motivo: borrado permanente no autorizado explícitamente. No eludir el rechazo con otra vía.
- El usuario corrigió las credenciales mediante formulario seguro. Primero abrió su cuenta normal y después la cuenta administradora. No se han leído ni guardado contraseñas. Navegador de administrador abierto en alias desarrollo, Estado del sistema.
- Diagnóstico administrativo visible: Vercel responde; GREEN autorizado; sesión operativa; 5 cron sin fallos/atascos; 23 incidencias históricas activas, ninguna crítica. GitHub CI figuraba pendiente para ese commit. El banner Todo operativo tiene alcance limitado; no valida Drive ni copias.
- Crear copia ahora: clic produjo timeout de navegador al abrir confirmación; no se ha confirmado ni declarado creada. Consulta posterior de crm_backup_runs confirma que solo figuran las copias del 2 y 4 de septiembre. Recuperación mediante una pestaña nueva también falló; no insistir en bucle. Exportar diagnóstico aún pendiente.
- Candidato de origen Drive: verificación completa 147/147 JavaScript válidos y 98/98 regresiones aprobadas. Mantener enlace estable hasta las pruebas del mismo commit.

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
- Drive: contacto sin teléfono/correo/bienvenida; crea carpeta y PDF propios, prueba papelera de una segunda copia y elimina el contacto de prueba. Después descargar el PDF retenido con el conector y cotejar SHA256. Conservar los artefactos de Drive hasta autorización explícita de limpieza, según el rechazo automático registrado arriba.
- Antes de repetir, comprobar que los contactos y el chat sintéticos anteriores ya se retiraron. Los artefactos Drive conservados deben permanecer identificados y sin cambios. El ensayo de Drive aún no ha pasado completo.
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
