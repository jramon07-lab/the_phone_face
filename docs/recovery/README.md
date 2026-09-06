# Recuperación del CRM

El código está en Git; los datos cambian a diario. Un ZIP del código y una copia de datos cumplen funciones distintas. Este procedimiento no declara una restauración completa hasta probarla en otro entorno.

## Copia diaria de datos

`api/crm-backup.js` exporta 38 tablas, cifra el archivo, lo sube a Drive, lo vuelve a descargar y comprueba su hash, descifrado y recuentos. Si falta una tabla o falla la descarga, el resultado es `failed`. `crm-backup-core.js` contiene el inventario y las exclusiones. La consulta de tablas mediante la API no ofrece una instantánea transaccional entre tablas.

Para validar una copia descargada:

```sh
node scripts/check-backup.cjs /ruta/copia.tpfbak
```

La clave se proporciona mediante `CRM_BACKUP_ENCRYPTION_KEY`, fuera del repositorio. Sin la clave original no se puede recuperar el contenido. No publicar el archivo descifrado.

`verified` significa integridad comprobada. No significa que se hayan restaurado SQL, usuarios, archivos externos y servicios en otro proveedor. Una copia de más de 36 horas muestra aviso.

## Paquete de recuperación completo

Desde una máquina de confianza, con las herramientas PostgreSQL compatibles con la versión del servidor y acceso directo a la base:

1. Guardar el código y confirmar que Git no tiene cambios pendientes.
2. Configurar las variables libpq `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER` y `PGPASSFILE` o `PGPASSWORD`. Usar conexión directa o pool en modo sesión compatible con pg_dump.
3. Establecer `CRM_RECOVERY_DIRECTORY` en una ubicación privada fuera del repositorio.
4. Ejecutar `node scripts/export-recovery.cjs`.

Genera `codigo.zip`, `database.dump`, `roles.sql` sin contraseñas de roles y un manifiesto con hashes. El volcado PostgreSQL incluye la estructura y los datos accesibles; falla si no tiene permiso para exportarlos. `pg_restore --list` solo valida que el archivo es legible.

Guardar por separado: valores de entorno privados, la clave de cifrado, archivos binarios de Supabase Storage, documentos de Drive, configuración de autenticación, OAuth, webhooks y horarios. Los metadatos SQL de Storage no contienen los archivos. Los datos cifrados de integraciones siguen necesitando sus claves originales.

## Ensayo de restauración

Debe utilizar un proyecto nuevo y aislado. No restaurar sobre el CRM utilizado por usuarios.

- Revisar y adaptar roles, extensiones y esquemas administrados del proveedor de destino.
- Restaurar el volcado con `pg_restore --exit-on-error`; verificar estructura, políticas, recuentos, claves y relaciones. No ignorar errores de tablas, políticas o funciones.
- Importar los objetos de Storage y recuperar los documentos externos.
- Configurar Auth y variables privadas; dejar desactivados los envíos, automatizaciones, webhooks y cron en el ensayo.
- Arrancar el código, iniciar sesión de prueba, buscar contactos, abrir oportunidades y guardar/editar una tarea de prueba en PC y móvil.
- Solo después registrar fecha, commit, archivo, destino y resultados. Hasta entonces `restoreTested` debe permanecer `false`.

No se ha ejecutado un ensayo completo desde este espacio: no hay conexión PostgreSQL privada ni un destino aislado configurados.

## Programación

`vercel.json` contiene el cron de copias. Vercel ejecuta cron en despliegues de producción; publicar una rama Preview no activa el horario de esa rama. Verificar el destino que realmente ejecuta el cron y su historial. No marcar la programación como operativa basándose solo en la presencia del archivo de configuración.

Referencias: [PostgreSQL pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html), [pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html), [restauración Supabase](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [cron de Vercel](https://vercel.com/docs/cron-jobs/manage-cron-jobs).
