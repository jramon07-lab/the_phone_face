# Validación funcional del CRM

Esta revisión usa la cuenta demo y el despliegue de pruebas. La base de datos contiene también contactos reales: las altas, modificaciones y borrados de las pruebas se limitan a registros sintéticos con nombres únicos y sin destinatarios ni notificaciones.

## Cómo repetirla

- `npm run verify`: estructura, sintaxis y 63 comprobaciones de regresión.
- El flujo **CRM Browser Validation** instala Chromium y WebKit, usa las credenciales demo de los secretos de GitHub y prueba el despliegue que acaba de publicarse.
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
| WebKit | Apertura y edición sin guardar en PC; ficha y agenda móvil. No equivale a una prueba en un iPhone físico |
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
