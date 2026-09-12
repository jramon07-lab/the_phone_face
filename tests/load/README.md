# Laboratorio aislado, 12 septiembre 2026

Base: estable f149533c. No publicar ni fusionar esta rama completa.

Ejecutar `npm install`, `npx playwright install chromium` y `npx playwright test --config=playwright.load.config.js`.

Se extrae la función real renderSales del CRM y se compara el módulo original sales-fullscreen-ui (baseline-sales.js) con el cambio propuesto. Cada variante abre dos sesiones de Chromium simultáneas, con 1.200 oportunidades ficticias por sesión. Se comprueba búsqueda, apertura y movimiento de tarjeta; en la variante nueva también menú tras redibujar y conservación de la búsqueda. Se miden renderizado, instalación, búsqueda y recorridos del panel durante 3,2 segundos de reposo.

El servidor solo sirve cinco rutas GET en 127.0.0.1. No carga Supabase, GREEN-API ni Telegram, no recibe credenciales y CSP bloquea conexiones. Playwright bloquea además cualquier petición externa. El workflow no consume secretos. Vercel tiene desactivado el despliegue automático de esta rama y un ignoreCommand de cancelación adicional. Documentación: https://vercel.com/docs/project-configuration/git-configuration

Esto mide el panel en memoria, no el CRM completo ni la sincronización entre dos PCs reales. Los manejadores de apertura y movimiento son sustitutos en memoria. No permite concluir la capacidad máxima del servicio ni garantizar ausencia de bloqueos en otros módulos. Falta actualizar un backend de pruebas aislado para medir consultas y sincronización compartida.

Cambio propuesto: sustituir el recorrido fijo cada 1,5 segundos por actualización agrupada con requestAnimationFrame ante cambios de tarjetas, retorno de foco y cambio de día. Mantener el filtro tras redibujar. Instalación idempotente.

Ver métricas y evidencias en el workflow CRM isolated load laboratory. La versión estable no se modifica.
