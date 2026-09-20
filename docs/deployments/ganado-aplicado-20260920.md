# Corrección de Ganado aplicada — 20/09/2026

Autorización: el usuario confirmó «hazlo todo» después de explicar expresamente el efecto sobre el motor compartido.

Migración remota: `20260920173041_preserve_after_sale_jobs_in_won`, proyecto `overfzbjtpjqxzbujezg`.

Se aplicó la propuesta `db/proposals/20260920-after-sale-won-guard.sql`, con una comprobación transaccional adicional que aborta si la definición original ha cambiado desde la lectura previa. La función instalada coincide con la propuesta. La reversión está en el archivo `.rollback.sql` de la misma carpeta.

## Resultado comprobado
- `after_sale` admite la fase original de Tramitado y Ganado.
- Las demás condiciones, permisos y `search_path` se conservan. Solo postgres y service_role mantienen permiso de ejecución.
- Las 23 reglas y los 491 trabajos conservan los mismos IDs y hashes de contenido antes/después.
- 377 terminados, 78 cancelados, 36 pendientes; no se recrearon trabajos ni se enviaron mensajes de prueba.
- Las nueve pruebas aisladas con datos sintéticos pasan antes y después. La definición pública coincide exactamente con la función corregida ensayada. No se ensayó una entrega real ni se movieron oportunidades reales.
- Advisors: avisos preexistentes de funciones SECURITY DEFINER accesibles a usuarios autenticados y tablas con RLS sin políticas; la función modificada no concede acceso a esos usuarios. No se modificaron permisos ajenos a esta corrección.

## Pendiente, sin ocultar los bloqueos
- Drive: copia del 20/09 fallida por `Token has been expired or revoked.` Última verificada: 19/09 01:30 UTC. Requiere reconectar la autorización existente desde Estado del sistema → Copias externas en Google Drive → Volver a conectar, y crear/verificar copia nueva.
- Chrome: no se obtuvo diagnóstico específico desde Safe Browsing ni acceso a Search Console. El aviso no está resuelto y no se ha solicitado una revisión sin diagnóstico.
- El navegador remoto volvió a agotar el tiempo al listar pestañas, incluso tras recuperar la conexión; no se pudo abrir la reconexión de Google ni completar recorridos nuevos de estable.
- No se ha promovido la interfaz ni creado un nuevo destino comercial. La interfaz estable continúa en aecd169; su motor compartido SÍ contiene ahora esta corrección autorizada.

Este documento actualiza el estado posterior al informe candidate-readiness-20260920.md, que describe la auditoría previa.
