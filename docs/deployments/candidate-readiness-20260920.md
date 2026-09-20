# Preparación de versión candidata — 20 de septiembre de 2026

## Decisión
No se ha promovido a estable. No se ha cambiado main, el dominio de producción, los ejecutores, las reglas ni los datos de clientes. No se han enviado mensajes. Quedan bloqueos reales descritos abajo.

## Versiones identificadas y conservadas
- Estable actual: main, aecd16946cb1e1d3cb15537e36170303fdcbb378.
- Dominio estable: https://the-phone-face-app-whatsapp-fotos-y.vercel.app/
- Despliegue estable fijo: https://the-phone-face-app-whatsapp-fotos-y-multimedia-p042tlf26.vercel.app/
- Rama respaldo creada: backup/estable-antes-candidato-20260920.
- Candidata visual original: 449b2e8c99b79179ba288c1faf3394d82d65f2dc, despliegue 803h7yry0.
- Candidata de comprobación: 24c1998c29cccb5998210ddd8af52a1af894cd3b. Aplicación corregida en 72a8c06; 24c1998 solo ajusta el workflow móvil.
- Enlace fijo comprobado READY: https://the-phone-face-app-whatsapp-fotos-y-multimedia-2vk16gjyv.vercel.app/
- Rama de entrega: release/candidato-20260920. La documentación posterior no modifica código de aplicación.
- El alias histórico 4c8eb2 apunta a ccf94413505581249c0a98c9612ba7a62fa34895 (6bqsre2vx). No es main actual. El runner desplegado lo usa como proxy: conservarlo.

## Comparación de datos y motor
Lectura directa del proyecto overfzbjtpjqxzbujezg. Ambos despliegues sirvieron HTTP 200 para js/core/00-bootstrap.js, con contenido idéntico y ese mismo proyecto. No hay dos conjuntos de automatizaciones que copiar.
El diff entre main y la candidata no modifica api/, lib/, supabase/ ni db/.
Instantánea de identidad y hashes SHA256 de reglas completas y trabajos pendientes: candidate-20260920-snapshot.json. Contiene IDs, fechas y huellas; no cuerpos de mensajes ni datos personales de destinatarios. No es una copia restaurable de la base.

- 23 reglas: 14 activas, 9 inactivas.
- 491 trabajos: 377 terminados, 78 cancelados, 36 pendientes.
- 0 pendientes vencidos con más de 15 minutos; 0 trabajos running atascados.
- 0 duplicados por automation_id/event_key; índice UNIQUE vigente.
- 0 pendientes sin contacto; 0 pendientes de envío sin teléfono en su contexto.
- 4 trabajos históricos sin regla vinculada, todos terminados; ninguno pendiente.
- 22 pendientes de posventa/renovación: 11 a 3 meses y 11 a 11 meses; todos en Tramitado.
- Otros pendientes: 12 de seguimiento de oferta y 2 de tramitación Vodafone.
- Interruptores de automatizaciones y WhatsApp programado en servidor: true.
- Reclamación atómica de trabajos con FOR UPDATE SKIP LOCKED; solo service_role puede llamar crm_server_claim_jobs. No es una prueba de entrega exactamente una vez ante todos los fallos posibles.
- Seis cron activos. Sus invocaciones registradas en las últimas 24 horas figuran succeeded; eso confirma la invocación, no la entrega de cada mensaje.
- Runner desplegado crm-automation-runner versión 19. No se ha desplegado ni alterado.
- Cambiar de URL no reinicia, duplica ni migra por sí mismo estos registros.

## Fallo de Ganado confirmado y corrección preparada
crm_private.lifecycle_stage_changed conserva trabajos after_sale al mover a Ganado.
Pero public.crm_lifecycle_job_guard exige todavía la fase Tramitado: cuando llegue la fecha, puede cancelar el trabajo conservado. El runner real llama esa función antes de actuar.
La propuesta permite Tramitado o Ganado para after_sale, conservando exclusiones, bajas, pausas, contacto existente y dependencias.
Archivos:
- db/proposals/20260920-after-sale-won-guard.sql
- db/proposals/20260920-after-sale-won-guard.rollback.sql
- supabase/tests/after-sale-won-guard-isolated.sql
Prueba ejecutada únicamente con tablas y funciones temporales, finalizada con ROLLBACK: 9/9.
Incluye reproducción del fallo original, send_template y prepare_operator_review en Tramitado/Ganado/Perdido, regla pausada y contacto ausente.
La función pública continúa intacta. Aplicar la propuesta modifica el motor compartido, también para el estable; requiere resolver expresamente la restricción de no tocar estable. No recrear ni reenviar trabajos al aplicarla.

## Copias de seguridad
La copia automática de 2026-09-20 falló: Token has been expired or revoked.
Última copia registrada verified: 2026-09-19 01:30 UTC, 1.442.549 bytes.
Esto describe el registro de verificación existente, no una nueva descarga o restauración ensayada en esta revisión.
Se necesita reautorizar la conexión existente de copias en Estado del sistema → Copias externas en Google Drive → Volver a conectar, y ejecutar Crear copia ahora. No se han solicitado ni extraído credenciales.

## Chrome
La captura del usuario indica alerta de sitio engañoso/reutilización de contraseña y certificado válido.
Revisión acotada: login usa signInWithPassword de Supabase; bootstrap idéntico a main; no cambio en API/autenticación del servidor por este rediseño. Esto NO demuestra que la clasificación sea falsa ni sustituye una auditoría completa de seguridad.
Candidata: raíz HTTP 200; /api/green?action=state devuelve 401 sin sesión CRM; /api/crm-backup?action=status devuelve 403 sin administrador.
No se ha obtenido un veredicto específico del sitio desde Safe Browsing ni acceso al informe privado Search Console. No se ha solicitado revisión ni marcado el sitio como legítimo.
Documentación oficial: https://support.google.com/webmasters/answer/9044101?hl=es
Pendiente: revisar Problemas de seguridad en Search Console y seguir sus ejemplos; tras resolver la causa, solicitar revisión. No cambiar URL para eludir la alerta ni desactivar protección del navegador.

## Configuración del futuro enlace de uso real
El despliegue candidato sigue en preview: api/green.js permite envíos solo al número de pruebas cuando VERCEL_ENV no es production. No es todavía un enlace de uso comercial.
Para mantener el estable anterior operativo sin mover su dominio:
- Preparar un destino de producción independiente y explícito para la nueva interfaz.
- Conservar el proyecto Supabase y los ejecutores actuales; no instalar un segundo conjunto de cron ni duplicar colas.
- Revisar retornos OAuth Google/Drive y permisos del nuevo origen antes de usarlo.
- Verificar de nuevo API, identidad de despliegue y flujos sobre ese destino.
No se han cambiado estas configuraciones ni creado un destino de producción.

## Verificación de aplicación
- 188/188 archivos JavaScript válidos y guardas modulares aprobadas.
- 155/155 pruebas locales sin red aprobadas.
- La primera ronda dio 151/155: cuatro aserciones esperaban antiguos sufijos de caché. Se actualizaron a los archivos realmente cargados, conservando los controles funcionales de aislamiento, rendimiento y búsqueda. Las cuatro pasan y la suite completa también.
- Ronda Chrome del commit exacto: https://github.com/jramon07-lab/the_phone_face/actions/runs/35524452830
- Primera ejecución: cinco pruebas aprobadas; el segundo comando no seleccionó la prueba móvil porque el patrón estaba anclado al principio del título completo. Se corrigió el selector y se conserva la evidencia de ambas fases por separado.
- Repetición corregida: https://github.com/jramon07-lab/the_phone_face/actions/runs/35524760236 — detectó un fallo intermitente real al abrir Editar ficha; las otras cuatro pruebas pasaron. No se ocultó mediante reintentos.
- Alcance: controles de ficha, contactos, oportunidades y WhatsApp; abrir/cancelar editores y ofertas; filtros y pantalla completa; carga móvil y navegación de sus secciones. No guarda fichas ni envía ofertas.
- No prueba una entrega real de WhatsApp ni guardado real/sincronización Google. Tampoco equivale a probar Safari/iPhone físico.
- Revisión visual nueva: captura enmascarada 07-editor-1100.png de la ronda corregida. Campos, notas protegidas y pie con Cancelar/Guardar visibles; sin cambio de diseño. Esto no equivale a validar todas las pantallas visualmente.
- El navegador interactivo remoto no respondió a las consultas de pestañas; no se ha afirmado una revisión manual nueva de toda la aplicación.

## Comprobación posterior de integridad
Se repitieron las huellas SHA256 al terminar las consultas: las 23 reglas y los 36 trabajos pendientes conservan los mismos IDs y contenido completo que la instantánea inicial. No se aplicó la propuesta de base de datos.

## Corrección del editor y cierre de pruebas
La apertura de Editar ficha usaba un clic sintético en Agregar contacto y esperaba como máximo dos segundos. Si la apertura asíncrona tardaba más, el modo de edición no se preparaba. Se sustituyó por la espera de la promesa real del manejador, con bloqueo de aperturas simultáneas y aviso de error. Se conservaron los manejadores de guardado, cancelación, protección de notas y permisos existentes.
La regresión con carga de 2,2 segundos falla con el código original y pasa con el corregido. Los casos de edición durante carga y cancelación siguen pasando. Suite final: 155/155; sintaxis: 188/188.
- Chrome escritorio corregido: https://github.com/jramon07-lab/the_phone_face/actions/runs/35525237249 — SUCCESS, recorrido completo aprobado sobre 72a8c06.
- Navegación móvil: https://github.com/jramon07-lab/the_phone_face/actions/runs/35525490361 — SUCCESS, nueve secciones dentro de un escenario aprobado sobre 24c1998 (misma aplicación).
- El primer workflow móvil separado fue rechazado por sintaxis YAML del comando; no ejecutó pruebas. Se corrigió con un bloque YAML y se validó antes de repetir.
- WhatsApp, permisos y carga móvil: aprobados en las rondas anteriores sobre 8c9385d. La corrección posterior solo modifica la apertura del editor de ficha y sus referencias de caché.
- main continúa en aecd169; motor compartido y datos de automatizaciones no modificados.
Estado final: candidata corregida y preservada, NO promovida. Bloqueos: aplicar la corrección compartida de Ganado bajo autorización específica, renovar Drive y verificar una copia nueva, resolver la alerta de Chrome, preparar/verificar el destino de uso real con los ejecutores únicos existentes.
