# Documentos de clientes

Base conservada: 7cb453bdd9e603bac4a0d89e1d482162ffcc3c0d, Preview https://the-phone-face-app-whatsapp-fotos-y-multimedia-5uvip82o4.vercel.app/.

## Datos y proveedores

`records.data.TPF_DOCUMENTS` contiene `{version:1, provider:'google_drive', folder_id, folder_name, linked_at, linked_by}`. La identidad del enlace es proveedor + folder_id; folder_name es solo una referencia visual. En OneDrive se añadirá drive_id además del item/folder_id. No hay rutas locales ni nombres usados como clave. Los importadores conservan este campo en actualizaciones y no asignan carpetas automáticamente a nuevos contactos.

El adaptador de Google ofrece folder/list. Un adaptador futuro de OneDrive debe implementar las mismas operaciones y su autorización Microsoft; hoy OneDrive se rechaza explícitamente, nunca se interpreta como Google Drive. Migrar exige copiar los archivos, comparar cantidades y contenido y confirmar una nueva vinculación. No existe migración ni eliminación automática.

## Autorización

Documentos utiliza GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, CRM_BACKUP_ENCRYPTION_KEY, SUPABASE_SERVICE_ROLE_KEY y SUPABASE_PUBLISHABLE_KEY o SUPABASE_ANON_KEY existentes. Guarda una credencial cifrada separada bajo `crm_external_credentials.provider = 'google_drive_documents'`. No modifica la credencial `google_drive` ni las copias.

En el cliente OAuth web de Google Cloud hay que registrar exactamente:

`https://the-phone-face-app-whatsapp-git-4c8eb2-jramon-07-2402s-projects.vercel.app/api/crm-documents?action=callback`

Después el administrador abre la rama fija, una ficha > Documentos > Conectar Google Drive y autoriza su cuenta. El permiso `drive` permite buscar y trabajar con carpetas preexistentes; puede requerir configurar pantalla de consentimiento, usuario de prueba o verificación de Google. La conexión de ChatGPT no sustituye este consentimiento del CRM. No se deben compartir contraseñas ni pegar secretos en el chat. `CRM_DOCUMENTS_ORIGIN` permite cambiar el origen estable en otro despliegue autorizado; también requiere registrar su redirect URI.

El callback usa state cifrado con vencimiento, nonce en cookie HttpOnly/SameSite=Lax, PKCE y nueva comprobación del administrador. La sesión de CRM y las políticas RLS autorizan acceso a fichas. Solo el administrador busca/vincula carpetas. Subir requiere can_edit_records o administrador. No se devuelve ningún token de Google al navegador.

## Operación

1. Buscar por nombre del contacto o titular, o pegar enlace/ID; comprobar la carpeta y confirmar antes de Guardar vinculación.
2. Actualizar archivos consulta hasta 100 por página, solo los archivos directamente dentro de la carpeta (sin subcarpetas).
3. Ver abre el archivo en Google Drive. Subir crea una sesión de carga limitada a ese archivo/carpeta; el navegador transfiere el original directamente a Google, hasta 100 MB, PDF/JPEG/PNG/WebP/HEIC/HEIF. No se reconstruyen ni procesan las fotos.
4. Si no se confirma la subida, actualizar la lista antes de reintentar. No hay reintentos automáticos de escritura. Los archivos repetidos por nombre no se sobrescriben.
5. Vincular usa comparación de JSON previo para evitar pisar cambios concurrentes. Preserva identidad, titular, etiquetas, notas y el resto de datos.

Pendientes: adaptador OneDrive, asociación automática en importación (solo sugerencias hasta confirmación), captura desde WhatsApp. No se simulan estas funciones.

Validación: pruebas locales con todas las llamadas de red simuladas para permisos, IDs, datos conservados, conflicto de actualización y carga. No se ejecutó E2E, no se crearon clientes/tareas/oportunidades ni se enviaron mensajes. La autorización de Google y la transferencia real necesitan completarse en la cuenta del administrador; no se declaran verificadas antes de hacerlo.

Rollback: revertir el commit de Documentos en la rama temporal. Los enlaces ya guardados permanecen en los datos y los originales en Drive. Git no es copia de la base de datos.

Referencias: https://developers.google.com/workspace/drive/api/guides/manage-uploads y https://developers.google.com/workspace/drive/api/guides/api-specific-auth.

## Vinculación en bloque

Desde Documentos, el administrador puede abrir «Vincular carpetas en bloque», pegar el enlace/ID de una carpeta principal y cargar todas sus carpetas hijas directas. La consulta pagina a 100 carpetas y a 1.000 contactos; si supera 10.000 carpetas o 50.000 contactos se bloquea la revisión incompleta. No se recorre el contenido de las carpetas de clientes.

La comparación normaliza mayúsculas, tildes, espacios y puntuación, y exige nombre completo exacto del contacto o titular (same=false). No se seleccionan nombres de una sola palabra, coincidencias múltiples, varias carpetas por contacto ni fichas ya vinculadas. Las carpetas existentes con vínculo figuran como «Ya vinculada». Las coincidencias claras están seleccionadas en la vista previa pero no se guardan hasta marcar la confirmación y pulsar Guardar.

Al guardar, bulkLink exige administrador, confirmación explícita, ausencia de vínculo anterior, snapshot completo de datos sin cambios y carpeta con el nombre y padre de la revisión. El PATCH mantiene la protección de concurrencia del enlace individual. Guarda secuencialmente, muestra progreso y permite detener después de la ficha en curso. Se detiene ante la primera incidencia; conserva lo ya guardado y pide una nueva revisión antes de reintentar. No se reintentan escrituras automáticamente. No se crean, renombran, mueven ni eliminan carpetas/archivos.

Se añadieron tests locales de coincidencias y de permisos/conflictos/ubicación para bulkLink; todas las llamadas externas están simuladas. Ninguna vinculación real se realizó durante el desarrollo. La búsqueda y confirmación masiva en la cuenta de Ramón quedan para su revisión. Los nuevos contactos importados no se vinculan automáticamente: se puede repetir esta revisión en bloque y se conservan los enlaces anteriores.


## Fotos / cámara a PDF (2026-09-06)

Botón separado de la subida original en Documentos de la ficha de escritorio. Hasta 12 fotos, 30 MB por foto; selector de cámara en navegadores compatibles. Cuatro esquinas ajustables, giro, orden y retirada de páginas. Corrección proyectiva y muestreo bilineal, máximo 1800 px por lado de salida; no reconstrucción generativa ni texto añadido. PDF JPEG multipágina generado localmente y previsualizado antes de subir. Los originales están seleccionados para conservación y se transfieren sin modificación. No se sobrescriben archivos. Una subida incierta bloquea repetir desde ese diálogo: revisar la carpeta primero. No se crean carpetas.

OCR local mediante el motor Tesseract 5.1.1 ya configurado, cargado solo al pedirlo. Solo propone fechas válidas junto a VALIDEZ/CADUCIDAD/EXPIRY; no infiere la caducidad desde nacimiento ni reconoce automáticamente DNI existentes en Drive. Requiere confirmación de fecha y selección de contacto/titular; se permite entrada manual. No crea recordatorios ni envía mensajes.

POST expiry en crm-documents usa permisos actuales y RLS del usuario, snapshot completo y PATCH condicional. Conserva todos los demás campos. TPF_DNI_EXPIRY guarda por separado contact/holder, date, subject_name, subject_dni y autor/fecha de confirmación. No modifica nombre ni DNI. Si el PDF se guardó y la fecha falla, se informa del éxito parcial; no se repite el PDF automáticamente.

Verificado localmente: sintaxis, matriz proyectiva, fechas imposibles/ambiguas/nacimiento, PDF de dos páginas con pdfinfo y endpoint con red simulada (permisos, confirmación, concurrencia, preservación). No hubo subida real, OCR sobre datos de cliente ni prueba visual autenticada durante el desarrollo. La interfaz /movil/ se integra en la sección siguiente.


## Documentos en móvil (2026-09-06)

Pestaña Documentos entre Tareas e Historial en la ficha móvil. Lee las vinculaciones ya guardadas en records.data.TPF_DOCUMENTS; no crea carpetas adicionales. Consulta paginada de archivos, enlaces seguros para ver/abrir Drive, subida original, enlace manual de carpeta por administrador y escáner compartido de fotos/cámara a PDF. Muestra caducidad confirmada separada para contacto/titular. La conexión inicial de Google sigue realizándose desde el PC.

Módulo aislado js/mobile-documents.js con cliente autenticado móvil y contexto de contacto inyectados desde render. Conserva el contexto durante repintados del mismo cliente (incluido regresar de la cámara) y lo invalida al navegar a otra ficha/pestaña. Comprueba contexto antes y después de pedir sesión y antes de subir; mantiene expectedLink y expectedData en las escrituras. Utiliza las mismas API y permisos del escritorio. No envía WhatsApp ni modifica oportunidades/tareas.

Validación: pruebas locales con red simulada para ID/carpeta, cambio de ruta durante autenticación, cierre del contexto y URLs seguras; suite de ficha móvil pasa cargando su dependencia real contact-party. No se ha probado una captura/subida real desde iPhone durante el desarrollo.


## Papelera y preparación de fotos de DNI (2026-09-06)

Borrar en escritorio/móvil pide confirmación explícita y usa POST trash. Verifica permisos de edición, vínculo esperado, nombre actual, archivo (no carpeta), pertenencia directa a la carpeta vinculada y permiso canTrash de Google. Solo PATCH trashed=true; no hay borrado definitivo. No se ha eliminado ningún archivo real durante el desarrollo.

Una selección compuesta solo por fotos desde Subir PDF/fotos abre el escáner con esas fotos. Selecciones con PDF conservan la subida original. Tipo DNI por defecto: propone contorno de una región clara rectangular sobre fondo contrastado; si no hay candidato suficiente se conserva el encuadre completo y se pide ajuste manual. Es una sugerencia revisable, no detección garantizada. Los puntos siguen siendo editables antes de preparar. El PDF DNI usa página A4 blanca con imagen centrada, sin títulos. Otro documento conserva página ajustada a imagen. Leer caducidad se inicia al preparar un DNI; confirmación de persona/fecha sigue siendo obligatoria. Se conserva la opción de guardar originales.

Verificaciones locales adicionales: papelera con permisos, carpeta incorrecta, nombres cambiados, confirmación y vínculo concurrente (red simulada); detector con fondo uniforme y tarjeta contrastada; PDF A4 comprobado con pdfinfo. Pendiente de prueba real del recorte en las fotos del usuario.


## Automatic DNI outline (2026-09-06)
- The shared desktop/mobile scanner now combines oriented edges, quadrilateral geometry and local texture checks with the previous bright-region fallback. It runs locally on an image reduced to 360 pixels; it does not transmit photos for detection.
- Successful DNI detection immediately prepares the cropped preview and starts the existing expiry reader. Saving still requires the user action and expiry confirmation.
- DNI output preserves the standard 1.586 card ratio and masks the rounded exterior corners white. The PDF retains the white A4 page.
- If a page has no detected outline, preparation blocks until a replacement photo or explicit manual adjustment. Detection can still fail on reflections, missing edges, unusual perspectives or clutter; do not describe it as guaranteed.
- Verified with synthetic perspective/plain/patterned scenes, negative backgrounds and ephemeral image regions from the reported screenshot. User photos are not committed. Real iPhone camera/upload verification remains pending.


## DNI orientation before cropping (2026-09-06)
The shared scanner now evaluates document text at 0/90/180/270 degrees before detecting the outline. A single Spanish OCR worker per photo uses page segmentation 6 for this orientation check; it is terminated after use. Photos remain local until explicit Save. Distinct document keywords and a score margin are required; ambiguous or failed reads keep the photo unchanged and stop automatic preview, allowing manual rotation. Existing expiry recognition and confirmation are separate and unchanged.
Local validation executed the actual orientation helper with canvas rendering and native English Tesseract for both supplied original photos at all four rotations (eight cases); all returned upright landscape photos and preserved the front header in outline detection. This does not substitute for Spanish Tesseract WASM on a physical iPhone. Small background fringes remain a known limitation; no destructive fixed inward trim was added.


## Scanner latency (2026-09-06)
Orientation now stops at the first direction with at least two recognized document keywords (score >=4), instead of always evaluating all four and comparing their scores. Unrecognized inputs still try all four and require manual review on failure. One orientation worker is reused across the chosen photos and terminated in a finally block at the end of the batch. The selected OCR text is retained only in scanner memory: expiry extraction reuses it when possible and otherwise follows the existing cropped/original fallback. Original-photo rotation cases still passed the local canvas/native OCR pipeline for both faces at 0/90/180/270 degrees. Actual mobile duration depends on the device; no fixed latency claim is made.


## Fast DNI preparation (2026-09-06)
The scanner no longer uses OCR to orient a photo before cropping and it does not automatically read expiry immediately after preparing the PDF. This removes the slow pre-processing path. It detects/crops quickly and then waits for the explicit `Leer caducidad del DNI` button. A rotated photo can be corrected manually with `Girar 90°` before `Preparar PDF`; this is intentional, because automatic text orientation costs too much time on mobile. No files are saved until the existing explicit Save action.
