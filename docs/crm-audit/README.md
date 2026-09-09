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

## Matriz inicial de recorridos

| ID | Área | Operaciones incluidas | Criterio | Evidencia inicial / fuente | Estado |
|---|---|---|---|---|---|
| 01 | Sesión | Entrar, persistir sesión, salir, caducidad y recuperación | Sesión correcta; datos inaccesibles tras salir; errores visibles | crm-smoke, crm-complete-flows | PARCIAL |
| 02 | Navegación | Todos los menús, Volver/Adelante, modales y borradores | Vuelve al origen y protege cambios reales independientemente del orden de carga | browser-navigation, crm-contact-actions | FALLO |
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
| 17 | Archivo compartido | Archivar, recuperar, deshacer, nueva entrada y error de guardado | Guardar por API real con dos sesiones y limpiar solo identificador sintético | whatsapp-archive-reliability; RLS SQL; simulación Chrome | PARCIAL |
| 18 | WhatsApp programado | Crear, editar, cancelar, enviar ahora, listado y ejecución horaria | Una entrega real, estado confirmado y cancelación efectiva | whatsapp-programs-pro; scheduled-runner | PARCIAL |
| 19 | Plantillas | Crear, buscar, filtrar, favoritas, editar, variables y borrar | Mismo contenido guardado desde todos los selectores y destinatario correcto | crm-libraries-import; crm-whatsapp-schedule-templates | PARCIAL |
| 20 | Ofertas por operador | Vodafone, MásMóvil, Yoigo, O2 y catálogos disponibles | Todas las combinaciones, descuentos, extras, precio editable y texto final | offer-configurator; operator-after-sales | PARCIAL |
| 21 | Crear oferta y venta | Oferta, oportunidad, acepta al momento, tramitar y fecha futura | Se crean los elementos previstos; envío y programación no se duplican | offer/configurator unit; flujo real pendiente | PENDIENTE |
| 22 | Constructor de automatizaciones | Simple/avanzado; disparadores, acciones, esperas, condiciones y repeticiones | Guardar, reabrir, editar, activar/pausar, duplicar y borrar solo prueba | automation-lifecycle; crm-libraries-import | PARCIAL |
| 23 | Lista de automatizaciones | Categorías, filtros, organización, historial y reposo | Sin reconstrucciones repetidas al estar inactiva; filtros preservados | crm-visual: ejecución 34287934209 | FALLO |
| 24 | Ejecución de automatizaciones | Etiqueta, mensaje, palabra, columna, sin respuesta y reanudación | Disparador real, una ejecución, horario España y exclusión de domingos | cron y jobs consultados; prueba completa pendiente | PARCIAL |
| 25 | Acciones automáticas | Oportunidad, tarea, etiqueta, WhatsApp, plantilla, revisión y cancelación | Resultados reales con registros sintéticos; sin clientes alcanzados | runner y funciones SQL | PENDIENTE |
| 26 | Posventa y revisión | Día siguiente, tres meses, anual, etiquetas y cambio de columnas | Reglas de cada operador y pausa/reanudación verificadas con reloj de ensayo | operator-after-sales; vodafone-annual-flow | PARCIAL |
| 27 | Historial de ejecución | Detalle, fallos, reintentar, cancelar paso/cliente/grupo y exclusiones | Datos actuales al reintentar; ninguna repetición de envíos confirmados | automation-control-center; lifecycle | PARCIAL |
| 28 | Etiquetas | CRUD, categoría, color, búsqueda y asignación individual/masiva | Coherencia entre ficha, filtros, móvil y disparadores | crm-libraries-import; contact-label-picker | PARCIAL |
| 29 | Campos personalizados | Contactos y oportunidades, tipos, valores, permisos y eliminación | Lectura/edición homogénea en todas las entradas y tipos | crm_custom_fields; sales_custom_fields | PENDIENTE |
| 30 | Importación Excel | Previsualización, mapeo, decisiones, altas, actualizaciones y oportunidades | Identidad inequívoca, relaciones, errores y repetición sin duplicados | crm-libraries-import; import-* | PARCIAL |
| 31 | Documentos y Drive | Enlazar, crear carpeta, buscar, subir, listar, descargar y papelera | Archivo real sintético recuperable e idéntico; permisos y limpieza | crm-documents unit; estado Drive conectado | PARCIAL |
| 32 | DNI y PDF | Cámara, galería, recorte, giro, multipágina, OCR y caducidad | PDF legible, fecha confirmada y subida real; cámara física pendiente | document-*; mobile-ocr-*; PDF Chrome | PARCIAL |
| 33 | Usuarios y permisos | Alta, edición, roles, permisos por campo, activación y restricciones | No eleva permisos ni expone datos; administración con sesión autorizada | demo no administradora; revisión RLS en curso | PENDIENTE |
| 34 | Estado del sistema | PC/móvil, incidencias, diagnóstico, exportación y borrado de avisos | Distingue error de aviso, no muestra secretos y no certifica lo omitido | system-monitoring; admin omitido | PARCIAL |
| 35 | Papelera | Contactos, tareas, oportunidades, restauración y purga | Verifica relaciones e historial además de identidad; no restaurar clientes reales | trash-identity; restauración de relaciones pendiente | PARCIAL |
| 36 | Copias y horarios | Manual, diaria, cifrado, subida, descarga, integridad y antigüedad | Copia reciente completa y horario realmente activo | última verified: 2026-09-04; investigar ejecución | FALLO |
| 37 | Recuperación completa | Base, usuarios, reglas, archivos, credenciales y aplicación | Restauración en destino aislado con cotejo de relaciones y recorridos | docs/recovery/README.md | BLOQUEADO |
| 38 | Microsoft 365 | Conexión, permisos, plantillas, envío y automatizaciones | Cuenta autorizada conectada y prueba de entrega real | 0 buzones; integración pausada | BLOQUEADO |
| 39 | Móvil completo | Todas las rutas, accesos rápidos, formularios, búsquedas y retorno | Sin desbordamiento; mismas entidades y permisos que PC | crm-complete-flows; mobile-* | PARCIAL |
| 40 | Dos puestos y resistencia | Usuarios distintos, sesiones largas, pestañas, desconexión y límites | Coherencia tras recuperar conexión; conflictos de edición visibles | dos contextos probados; ensayo prolongado pendiente | PARCIAL |
| 41 | Seguridad y API | Sin sesión, rol limitado, entradas inválidas y acceso directo | RLS y autorización por función; sin secretos en cliente, logs o diagnóstico | 47 tablas con RLS; políticas/funciones pendientes | PARCIAL |
| 42 | Despliegue y continuidad | Commit, alias, caché, versión PC/móvil y recuperación de código | Enlace estable conserva versión comprobada y evidencia de ese commit | alias 734db09 READY; informe GitHub | PARCIAL |

## Hallazgos de recuperación

- Actions `34287934209`: dos sesiones reales y ensayo WhatsApp pasaron; el bloque general terminó con 42 superadas, 2 fallidas y 3 omitidas. Total: 44 superadas, 2 fallidas y 3 omitidas. Fallos: protección de borrador de contacto y 12 mutaciones en reposo en automatizaciones.
- Drive está conectado; la demo permite subir, pero no administrar la conexión.
- Última copia verificada registrada: 4 de septiembre de 2026, 18:04 UTC. No hay una copia posterior registrada al iniciar la auditoría.
- Cron de Supabase registra invocaciones cada minuto; su estado succeeded no prueba por sí solo la entrega HTTP ni cada acción. Se comprobarán respuestas y resultados.
- Todas las tablas public examinadas tienen RLS habilitado; faltan las comprobaciones de políticas, funciones y roles.
- Navegador de revisión abierto en el CRM estable, pantalla de acceso. La demo de GitHub Actions sigue disponible; no se pedirán contraseñas en el chat.
