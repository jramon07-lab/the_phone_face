# Auditoría completa del CRM — 9 de septiembre de 2026

**EN CURSO. Este inventario no declara el CRM completamente validado.**

Base recuperada: estable `734db09915a7dbf0b6cbc876264274768120838e`; desarrollo `576bcf0870fe921bdbfffe5a6e18546fa4c94091`. El enlace estable se conserva.

Historia del usuario: una operación desde cualquier entrada del CRM debe llegar al servicio y a los datos correctos, persistir y aparecer de forma coherente en el segundo puesto y móvil.

## Criterios

- Contrastar esta matriz con `source-inventory.json`, pantallas, módulos, acciones de servidor, funciones SQL e integraciones; añadir cualquier recorrido no representado.
- PARCIAL conserva evidencia anterior pero tiene límites; PENDIENTE no se ha comprobado de extremo a extremo; FALLO requiere reproducción/corrección; BLOQUEADO identifica acceso o infraestructura faltante. Ninguno significa aprobado.
- Cada resultado final debe identificar commit, fecha, prueba y evidencia, tipo de datos real/simulado y limpieza.
- Solo registros sintéticos y el destinatario de prueba ya autorizado; nunca mensajes a clientes, exportaciones públicas ni restauraciones sobre la base de trabajo.
- La prueba de restauración queda bloqueada hasta disponer de destino aislado y conexión privada; Microsoft 365 hasta conexión/consentimiento administrativo. Revisar todo lo posible antes de pedir intervención.

## Matriz de recorridos — progreso comprobado

| ID | Área | Operaciones incluidas | Criterio | Evidencia inicial / fuente | Estado |
|---|---|---|---|---|---|
| 01 | Sesión | Entrar, persistir sesión, salir, caducidad y recuperación | Sesión correcta; datos inaccesibles tras salir; errores visibles | crm-smoke, crm-complete-flows | PARCIAL |
| 02 | Navegación | Todos los menús, Volver/Adelante, modales y borradores | Vuelve al origen y protege cambios reales independientemente del orden de carga | Corregido en c5d6936; pruebas de captura/retorno y Chrome 34324473084 | CORREGIDO / PARCIAL |
| 03 | Inicio y avisos | Tarjetas, contadores, filtros, ocultar avisos y accesos | Conteos iguales a datos y navegación al elemento correcto | mobile-home-alerts, crm-functional | PARCIAL |
| 04 | Buscador y hojas | Buscador general, Liquidación, Data, Clawback, Ajustes | Filtros, columnas, permisos, paginación y exportación en cada hoja | search-fallback; crm-contact-actions | PENDIENTE |
| 05 | Contactos | Alta, edición, teléfono, nombre, apodo, DNI, banco, correo, notas, observaciones | Persistencia por identificador, validación y campos vacíos conservados | crm-complete-flows, contact-form-unified | PARCIAL |
| 06 | Ficha y entradas | Abrir desde buscador, listas, ventas, agenda y WhatsApp | Misma ficha, mismo identificador, mismas operaciones y retorno | crm-whatsapp-right-panel, crm-consolidation | PARCIAL |
| 07 | Relaciones | Titular, gestor, varios titulares, creación y cambio de vínculos | No mezcla personas, detecta duplicados y preserva relaciones | contact-relations, crm-complete-flows | PARCIAL |
| 08 | Contactos masivos | Paginación, búsqueda, categorías, selección múltiple y acciones | Recorre todo el volumen; no actúa sobre filas fuera de la selección | mobile-contact-pagination, contacts-active-only | PARCIAL |
| 09 | Notas y actividad | Añadir, editar, borrar, filtrar historial y abrir elementos relacionados | Autoría, orden, protección de notas y persistencia en ambas sesiones | contact-notes, activity-clean-filters | PARCIAL |
| 10 | Ventas | Crear, editar, mover, ganar/perder, cancelar y abrir contacto | Identidad vinculada, importes, responsables, fechas y estado guardados | crm-complete-flows, opportunity-linked-contact | PARCIAL |
| 11 | Tablero y lista | Arrastrar, columnas, filtros, pantalla completa y desplazamiento | Contadores y posiciones coinciden; acciones también con nombres largos | crm-sales-click, crm-module-isolation | PARCIAL |
| 12 | Configuración de ventas | Pipelines, columnas, objetivos y campos personalizados | Cambios persistentes y permisos correctos; prueba con configuración sintética | sales core; crm_sales_goals | PENDIENTE |
| 13 | Agenda y tareas | Crear, editar, completar, reabrir, posponer, borrar, fechas y tipos | Misma tarea desde agenda, ficha, WhatsApp, inicio y móvil | crm-consolidation, shared-task-model | PARCIAL |
| 14 | Recordatorios | Aviso en aplicación, navegador, Telegram y segundo recordatorio | Entrega real a destinatario de prueba, una sola vez y en horario correcto | agenda-items, api/telegram.js | PENDIENTE |
| 15 | WhatsApp lectura | Listas, filtros, contador, historial, búsqueda y cambio rápido de chat | Dos sesiones coinciden; una respuesta atrasada no contamina otra conversación | crm-whatsapp-multidevice | PARCIAL |
| 16 | WhatsApp escritura | Texto, respuesta citada, fotos, audio, archivo y errores de envío | Envío real autorizado, receptor y contenido correctos, sin duplicados | whatsapp-seven-regressions; green-reply/file-safe | PENDIENTE |
| 17 | Archivo compartido | Archivar, recuperar, deshacer, nueva entrada y error de guardado | Guardar por API real con dos sesiones y limpiar solo identificador sintético | Supabase real y 2 sesiones: 34324454056 y 34325419583, ambos aprobados; proveedor simulado y limpieza de fila comprobada | COMPROBADO EN ENSAYO |
| 18 | WhatsApp programado | Crear, editar, cancelar, enviar ahora, listado y ejecución horaria | Una entrega real, estado confirmado y cancelación efectiva | whatsapp-programs-pro; scheduled-runner | PARCIAL |
| 19 | Plantillas | Crear, buscar, filtrar, favoritas, editar, variables y borrar | Mismo contenido guardado desde todos los selectores y destinatario correcto | crm-libraries-import; crm-whatsapp-schedule-templates | PARCIAL |
| 20 | Ofertas por operador | Vodafone, MásMóvil, Yoigo, O2 y catálogos disponibles | Todas las combinaciones, descuentos, extras, precio editable y texto final | offer-configurator; operator-after-sales | PARCIAL |
| 21 | Crear oferta y venta | Oferta, oportunidad, acepta al momento, tramitar y fecha futura | Se crean los elementos previstos; envío y programación no se duplican | offer/configurator unit; flujo real pendiente | PENDIENTE |
| 22 | Constructor de automatizaciones | Simple/avanzado; disparadores, acciones, esperas, condiciones y repeticiones | Guardar, reabrir, editar, activar/pausar, duplicar y borrar solo prueba | automation-lifecycle; crm-libraries-import | PARCIAL |
| 23 | Lista de automatizaciones | Categorías, filtros, organización, historial y reposo | Sin reconstrucciones repetidas al estar inactiva; filtros preservados | Corregido en c5d6936; Chrome 34324473084: AUTOMATION_IDLE 0 mutaciones | COMPROBADO |
| 24 | Ejecución de automatizaciones | Etiqueta, mensaje, palabra, columna, sin respuesta y reanudación | Disparador real, una ejecución, horario España y exclusión de domingos | cron y jobs consultados; prueba completa pendiente | PARCIAL |
| 25 | Acciones automáticas | Oportunidad, tarea, etiqueta, WhatsApp, plantilla, revisión y cancelación | Resultados reales con registros sintéticos; sin clientes alcanzados | runner y funciones SQL | PENDIENTE |
| 26 | Posventa y revisión | Día siguiente, tres meses, anual, etiquetas y cambio de columnas | Reglas de cada operador y pausa/reanudación verificadas con reloj de ensayo | operator-after-sales; vodafone-annual-flow | PARCIAL |
| 27 | Historial de ejecución | Detalle, fallos, reintentar, cancelar paso/cliente/grupo y exclusiones | Datos actuales al reintentar; ninguna repetición de envíos confirmados | automation-control-center; lifecycle | PARCIAL |
| 28 | Etiquetas | CRUD, categoría, color, búsqueda y asignación individual/masiva | Coherencia entre ficha, filtros, móvil y disparadores | CRUD Chrome 34324473084; RLS real: administrador/demo permitidos, rol limitado/anon denegados, ROLLBACK y limpieza | PARCIAL |
| 29 | Campos personalizados | Contactos y oportunidades, tipos, valores, permisos y eliminación | Lectura/edición homogénea en todas las entradas y tipos | crm_custom_fields; sales_custom_fields | PENDIENTE |
| 30 | Importación Excel | Previsualización, mapeo, decisiones, altas, actualizaciones y oportunidades | Identidad inequívoca, relaciones, errores y repetición sin duplicados | crm-libraries-import; import-* | PARCIAL |
| 31 | Documentos y Drive | Enlazar, crear carpeta, buscar, subir, listar, descargar y papelera | Archivo real sintético recuperable e idéntico; permisos y limpieza | PDF real guardado e idéntico por hash; confirmación de subida falla en Preview (CORS), corrección local preparada | FALLO / CORRECCIÓN EN PRUEBA |
| 32 | DNI y PDF | Cámara, galería, recorte, giro, multipágina, OCR y caducidad | PDF legible, fecha confirmada y subida real; cámara física pendiente | document-*; mobile-ocr-*; PDF Chrome | PARCIAL |
| 33 | Usuarios y permisos | Alta, edición, roles, permisos por campo, activación y restricciones | No eleva permisos ni expone datos; administración con sesión autorizada | sesión admin abierta; revisión RLS en curso | PENDIENTE |
| 34 | Estado del sistema | PC/móvil, incidencias, diagnóstico, exportación y borrado de avisos | Distingue error de aviso, no muestra secretos y no certifica lo omitido | diagnóstico admin visible; exportación pendiente; omisión CI conservada | PARCIAL |
| 35 | Papelera | Contactos, tareas, oportunidades, restauración y purga | Verifica relaciones e historial además de identidad; no restaurar clientes reales | trash-identity; restauración de relaciones pendiente | PARCIAL |
| 36 | Copias y horarios | Manual, diaria, cifrado, subida, descarga, integridad y antigüedad | Copia reciente completa y horario realmente activo | v3 incluye 42 tablas; producción antigua devuelve 404 en copia; última verified 2026-09-04 | FALLO DE PROGRAMACIÓN |
| 37 | Recuperación completa | Base, usuarios, reglas, archivos, credenciales y aplicación | Restauración en destino aislado con cotejo de relaciones y recorridos | Rama de ensayo yebjacgqrycxcvpewmzq existe pero está atrasada (30 tablas, 3 cron activos); faltan volcado y acceso PostgreSQL privado | BLOQUEADO |
| 38 | Microsoft 365 | Conexión, permisos, plantillas, envío y automatizaciones | Cuenta autorizada conectada y prueba de entrega real | 0 buzones; integración pausada | BLOQUEADO |
| 39 | Móvil completo | Todas las rutas, accesos rápidos, formularios, búsquedas y retorno | Sin desbordamiento; mismas entidades y permisos que PC | crm-complete-flows; mobile-* | PARCIAL |
| 40 | Dos puestos y resistencia | Usuarios distintos, sesiones largas, pestañas, desconexión y límites | Coherencia tras recuperar conexión; conflictos de edición visibles | dos contextos probados; ensayo prolongado pendiente | PARCIAL |
| 41 | Seguridad y API | Sin sesión, rol limitado, entradas inválidas y acceso directo | RLS y autorización por función; sin secretos en cliente, logs o diagnóstico | API WhatsApp/Telegram protegidas y probadas; etiquetas RLS corregido; app_settings/asignación de etiquetas requieren revisión adicional | PARCIAL |
| 42 | Despliegue y continuidad | Commit, alias, caché, versión PC/móvil y recuperación de código | Enlace estable conserva versión comprobada y evidencia de ese commit | Estable 734db09 READY; candidato b888d3b, 49 Chrome aprobadas + 3 omitidas; promoción pendiente | PARCIAL |

## Hallazgos de recuperación

- Actions `34287934209`: dos sesiones reales y ensayo WhatsApp pasaron; el bloque general terminó con 42 superadas, 2 fallidas y 3 omitidas. Total: 44 superadas, 2 fallidas y 3 omitidas. Fallos: protección de borrador de contacto y 12 mutaciones en reposo en automatizaciones.
- Drive está conectado; la demo permite subir, pero no administrar la conexión.
- Última copia verificada registrada: 4 de septiembre de 2026, 18:04 UTC. No hay una copia posterior registrada al iniciar la auditoría.
- Cron de Supabase registra invocaciones cada minuto; su estado succeeded no prueba por sí solo la entrega HTTP ni cada acción. Se comprobarán respuestas y resultados.
- Todas las tablas public examinadas tienen RLS habilitado; faltan las comprobaciones de políticas, funciones y roles.
- Navegador de revisión abierto en el CRM estable, pantalla de acceso. La demo de GitHub Actions sigue disponible; no se pedirán contraseñas en el chat.

## Evidencia nueva del 9 de septiembre

- `62b2f40`: Actions [34322723611](https://github.com/jramon07-lab/the_phone_face/actions/runs/34322723611), 46 aprobadas y 3 omitidas.
- `f515d84`: Actions [34323161462](https://github.com/jramon07-lab/the_phone_face/actions/runs/34323161462), 49 aprobadas y 3 omitidas.
- `dec9ad6`: Actions [34323708131](https://github.com/jramon07-lab/the_phone_face/actions/runs/34323708131), 49 aprobadas y 3 omitidas.
- `7ca4b1f`: Actions [34324473084](https://github.com/jramon07-lab/the_phone_face/actions/runs/34324473084), 49 aprobadas y 3 omitidas. Los contadores de las dos sesiones coincidieron (2266 conversaciones, 69 recientes); la firma completa de los resúmenes coincidió en la tercera comprobación, unos 37 segundos después de la primera. Esto prueba convergencia en ese ensayo, no sincronización instantánea ni ausencia de discrepancias futuras.
- Las tres omisiones corresponden a Microsoft 365 (dos pruebas) y diagnóstico administrador (una). No son aprobados.
- Regresiones locales: 98/98 en el candidato de autorización. Las pruebas nuevas de la API de configuración también pasaron.
- Las llamadas a WhatsApp en escritorio exigían protección de Vercel pero no verificaban por sí mismas la sesión del CRM. El candidato ahora exige sesión y permiso; también protege respuestas, archivos, estado, marcado de lectura, Telegram y configuración de confirmaciones. Las descargas reciben el token en cabecera, nunca en la URL.
- Migración SQL `20260909073937 crm_label_management_permissions`: se reprodujo que el rol limitado podía insertar etiquetas; se probaron reglas propuestas con ROLLBACK, se aplicaron y se repitieron las pruebas. Permitidos: demo y administrador. Denegados: escritura del rol limitado y acceso anónimo. Cero etiquetas sintéticas restantes. Chrome CRUD de etiquetas pasó después de aplicar la migración (07:39:46 UTC).
- Funciones públicas SECURITY DEFINER ejecutables por anon: 0; vistas públicas: 0. Siguen existiendo políticas amplias para otras tablas; RLS habilitado por sí solo no demuestra autorización correcta.
- Los cron duplicados 1 y 2 llaman al ejecutor heredado, que usa bloqueo SKIP LOCKED; su tabla de trabajos está vacía. No se han eliminado horarios basándose únicamente en la duplicidad.
- Hay una rama antigua de pruebas en Supabase. No es una restauración actual: solo tiene 30 tablas, datos de ensayo y 3 cron activos. Se conserva sin cambios hasta preparar un destino con envíos desactivados.

### Límites operativos que impiden cerrar la auditoría

1. Microsoft 365 sigue pausado y sin buzones; falta conexión y consentimiento administrativo.
2. Acceso administrativo resuelto mediante entrada segura del usuario. El navegador dejó de responder al abrir la confirmación de copia; exportación y copia manual siguen pendientes. La cuenta automática es demo.
3. La recuperación completa necesita un volcado con acceso privado a PostgreSQL y la configuración externa; no basta con validar un archivo cifrado.
4. Producción Vercel conserva el despliegue antiguo del 29 de agosto. Sus ejecutores de Supabase llaman a ese dominio sin sesión CRM. Antes de promoverlo hay que preparar autenticación de servicio y probar los ejecutores; cambiarlo ahora podría detener automatizaciones. No hay credenciales de administración de Vercel disponibles para cambiar sus variables privadas.
5. Los recorridos que crean ventas/configuración y disparan automatizaciones necesitan un entorno de ensayo actualizado para probar todas sus combinaciones sin alcanzar clientes. Las pruebas físicas de cámara/notificaciones y los dos ordenadores del usuario no se sustituyen por emulación de navegador.

La matriz permanece abierta. Las filas PARCIAL/PENDIENTE conservan los pasos concretos pendientes; este documento no certifica todo el CRM.

### Acceso administrativo y Drive ampliados

La sesión administrativa ya se abrió mediante entrada segura. Estado del sistema y procesos reales cargaron. La exportación del diagnóstico y la copia manual aún no terminaron: el navegador dejó de responder al abrir la confirmación. Se conserva el estado para recuperarlo.

Drive: ensayo 34325419583 mostró error de confirmación aunque el PDF se guardó; descarga independiente e igualdad de bytes comprobadas (618 bytes, SHA256 76b734f8fbe3f8304fd29f77373ce6c2a73c4a3d87a3d128fdf33b9e39c3534d). Corrección del origen de subida preparada y probada localmente. Dos artefactos sintéticos de esa ejecución siguen conservados porque la revisión automática rechazó su borrado permanente; no se reintentará por otra vía.
