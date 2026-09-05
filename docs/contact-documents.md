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

Pendientes: adaptador OneDrive, asociación automática en importación (solo sugerencias hasta confirmación), captura desde WhatsApp, escaneo/recorte/perspectiva y confirmación de caducidad del DNI; interfaz /movil/ de Documentos. No se simulan estas funciones.

Validación: pruebas locales con todas las llamadas de red simuladas para permisos, IDs, datos conservados, conflicto de actualización y carga. No se ejecutó E2E, no se crearon clientes/tareas/oportunidades ni se enviaron mensajes. La autorización de Google y la transferencia real necesitan completarse en la cuenta del administrador; no se declaran verificadas antes de hacerlo.

Rollback: revertir el commit de Documentos en la rama temporal. Los enlaces ya guardados permanecen en los datos y los originales en Drive. Git no es copia de la base de datos.

Referencias: https://developers.google.com/workspace/drive/api/guides/manage-uploads y https://developers.google.com/workspace/drive/api/guides/api-specific-auth.
