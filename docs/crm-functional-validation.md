# Validación funcional del CRM

Esta revisión usa la cuenta demo y el despliegue de pruebas. La base de datos contiene también contactos reales: las altas, modificaciones y borrados de las pruebas se limitan a registros sintéticos con nombres únicos y sin destinatarios ni notificaciones.

## Cómo repetirla

- `npm run verify`: estructura, sintaxis y todas las comprobaciones de regresión descubiertas en `tests/` (92 tras el refuerzo de archivado y recuperación de lecturas del 8 de septiembre).
- El flujo **CRM Browser Validation** instala Chromium, usa las credenciales demo de los secretos de GitHub y prueba el despliegue que acaba de publicarse. Chrome es el navegador oficial acordado; WebKit es una comprobación adicional fuera de esta validación.
- Los escenarios se ejecutan con un solo proceso y sin reintentos: comparten la cuenta demo y la prueba de cierre de sesión puede revocar las sesiones de otras pruebas si se ejecutan a la vez.
- Las capturas y los resultados se adjuntan a cada ejecución como **crm-browser-evidence**. Las grabaciones y trazas de autenticación están desactivadas.

## Cobertura y límites

| Área | Comprobación |
|---|---|
| Sesión y navegación | Entrada, salida, protección, aperturas principales, aislamiento de módulos y errores JavaScript |
| Contactos | Crear, buscar, editar en PC y móvil, exportar, borrar y restaurar el mismo identificador |
| Titulares y oportunidades | Relación gestor/titular, persistencia de la oportunidad, identidad y DNI, edición móvil y conteos coherentes |
| Ventas | Lista, tablero y modo tablero; abrir ficha y desplazar su contenido |
| Agenda | Crear, editar, completar, reabrir, posponer; calendario y accesos de Contactos, Ventas, WhatsApp, Avisos e inicio |
| Plantillas y etiquetas | Crear, buscar, editar, persistencia y eliminación de las pruebas; favoritas y sustitución de variables con adaptadores aislados |
| Excel | Vista previa, revisión obligatoria e importación real de una fila sintética |
| WhatsApp | Salud de GREEN-API, búsqueda, conversaciones, selección de plantilla y retornos entre pantallas; cola de avatares aislada del servicio |
| PDF | Selección de foto sintética, giro, preparación, nombre, bytes PDF válidos y prevención de doble guardado; destino de subida simulado |
| Google Drive | Estado autenticado y lectura de la carpeta vinculada. No prueba subida real, cámara física ni eliminación de carpetas |
| Automatizaciones | Constructor y CRUD de borradores pausados sin trabajos ejecutados; motor y reintentos comprobados con pruebas aisladas |
| WebKit (adicional) | Fuera del criterio de entrega de Chrome. Pruebas disponibles de apertura y edición sin guardar; la cancelación del editor requiere revisión. No equivale a una prueba en un iPhone físico |
| Copias y administración | La demo recibe 403 al intentar una copia administrativa; no se considera una copia completada |

## Pendiente de un entorno específico

- Envío y recepción final de WhatsApp/correo con destinatarios de prueba autorizados.
- Ejecución programada real de automatizaciones y copias.
- Copia administrativa y restauración completa en una base aislada.
- Alta de usuarios y cambios de permisos; la cuenta demo no es administradora.
- Microsoft 365 sigue pausado; sus pruebas se omiten explícitamente.
- La restauración desde Papelera conserva el identificador del contacto, pero el borrado de la base puede haber desvinculado oportunidades/tareas o eliminado actividad relacionada. No debe tratarse como restauración completa de relaciones e historial.

Un resultado verde demuestra los casos ejecutados; no certifica funciones omitidas ni garantiza ausencia de cualquier fallo futuro.

## Corrección de la ejecución 34041794297

- El nombre largo del cliente en el tablero quedaba oculto por el recorte de su contenedor; el enlace ocupa ahora una línea propia con ajuste de texto y área de clic visible. La selección de la columna recupera sus eventos normales.
- PC y móvil cargan la misma copia local de Supabase 2.57.4, la versión ya fijada en móvil. La biblioteca no depende de que responda un CDN externo. Se añaden pruebas en Chromium y WebKit con los CDN bloqueados.
- Las pruebas de Safari envían las cabeceras de acceso a la preview únicamente al dominio de la aplicación y registran fallos de red sin consultas, cuerpos ni credenciales.
- Un contacto vinculado explícitamente que ya no existe no se sustituye por otra persona con nombre o teléfono coincidente.
- La comprobación de permisos de copias usa una consulta de estado, sin ejecutar una exportación de la base compartida.
- Verificación local previa: 134 archivos JavaScript válidos y 63/63 comprobaciones. El resultado de navegador debe consultarse en la ejecución del commit publicado, sin reutilizar el verde de un commit anterior.


## Recuperación y refuerzo de archivado — 8 de septiembre de 2026

Consultar `docs/crm-continuity.md` antes de continuar. La recuperación contrastó ambas ramas y el alias estable con `d37c77c19d12b270e2a788c15e07e0df18a4c746`.

- Base repetida localmente: 90/90. Evidencia remota revisada: Actions `34275237368` y `34275954839`, ambas con 2 pruebas de dos sesiones + 44 generales superadas, 3 omitidas (2 Microsoft 365 y diagnóstico administrativo).
- Dos sesiones autenticadas compararon resúmenes reales de 2.266 conversaciones y un historial, con contadores iguales. No se enviaron mensajes ni se marcaron como leídos.
- Archivado, fallos de red y respuestas atrasadas se prueban en navegador contra un almacén simulado compartido. No confundir esta prueba con una modificación de una conversación real.
- Regresiones nuevas: lectura atrasada que revierte un clic confirmado, error de escritura que queda solo en local, archivar/deshacer con peticiones que se cruzan, más de 1.000 estados y fallo de una página. Se reprodujeron antes de corregir; las pruebas permanecen en `tests/whatsapp-archive-reliability.cjs`.
- PC serializa las escrituras de cada conversación, protege las lecturas frente a cambios en curso y recupera el último estado confirmado si el guardado falla, con aviso visible. No reintenta una escritura antigua automáticamente.
- PC y móvil leen todas las páginas por identificador y conservan la instantánea anterior si una página falla. La migración de archivos locales antiguos solo inserta registros inexistentes, sin reemplazar decisiones de otro PC.
- Prueba SQL transaccional adicional: usuario con permiso WhatsApp sin rol administrador; archivar y recuperar un identificador sintético, comprobando RLS, fechas y atribución, seguido de ROLLBACK. No cambia conversaciones ni datos persistentes.
- Los intervalos actuales son 15 segundos para resumen/historial de escritorio y 20 segundos para archivado, con consulta adicional al recuperar foco o conexión. La sincronización es eventual; no implica igualdad instantánea en el milisegundo del clic.
- Microsoft 365, diagnóstico administrativo, envío final a destinatarios y restauración completa conservan los límites anteriores.

La primera validación de desarrollo de este refuerzo (`34277615556`) detectó un 429 real con respuestas distintas entre servidores. La nueva regresión `green-multiserver-recovery.cjs` reproduce ese caso sin red y comprueba recuperación de resumen e historial, espera solicitada larga, límite persistente y ausencia de reintentos de envío. El cambio está en la recuperación del servidor; no se relajan los criterios de la prueba Chrome ni se oculta el 429. Ver la explicación y el estado de entrega en `docs/crm-continuity.md`.
