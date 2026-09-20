# Nuevo destino de producción preparado

Base: candidata 24c1998, más documentación y la corrección compartida de Ganado ya aplicada.

Cambios preparados, todavía sin publicar en producción:
- api/index-clean.js muestra «🟠 Phone Face CRM» cuando VERCEL_ENV=production; preview conserva Pruebas.
- vercel.new-production.json conserva todas las rutas y tiene crons=[] para un proyecto independiente. No sustituye la configuración del proyecto estable actual.
- Las protecciones de WhatsApp permanecen activas en preview; solo un despliegue realmente production habilita el modo estable.

Verificación local: sintaxis del archivo, prueba existente crm-environment-mode y comparación exacta de las rutas/configuración, correctas.

La copia de datos del 20/09/2026 17:41:34 UTC figura verified a las 17:41:56 UTC, 1.496.152 bytes, sin errores. No equivale a restauración integral.

Antes de publicar: crear proyecto independiente en el mismo equipo, conectar configuración privada mediante mecanismos autorizados de Vercel, usar la configuración sin cron y conservar Supabase/runner/Telegram existentes. No mover dominios ni promover sobre el proyecto antiguo. Revisar callbacks OAuth y comprobar health, entorno, modo estable, acceso y navegación en el destino real. El aviso de Chrome del antiguo enlace fijo sigue sin resolución confirmada; comprobar también el estado del destino definitivo sin asumir que cambiar URL lo resuelve.

Bloqueo de acceso: deploy_to_vercel devuelve Tool not found. La CLI 59.23.2 indica loggedIn=false, login_required; no hay VERCEL_TOKEN disponible. Es necesaria autorización de Vercel antes de crear el destino comercial. No se ha creado una URL definitiva ni modificado main.
