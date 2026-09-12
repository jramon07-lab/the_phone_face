# Primera medición aislada

12 septiembre 2026. Código probado: a65e881196f0e95aa7b0bed66d21285b03a00530, basado en estable f149533c.

Ejecución completa y evidencias: https://github.com/jramon07-lab/the_phone_face/actions/runs/34674232396

129/129 comprobaciones de regresión y 2/2 pruebas de carga pasadas. Cada prueba ejecuta dos sesiones simultáneas de Chromium, cada una con 1.200 oportunidades ficticias. Sin peticiones a servicios externos.

| Variante | Sesión | Render inicial (ms) | Instalación (ms) | Buscar y comprobar resultado (ms) | Recorridos completos en reposo (3,2 s) |
| --- | --- | --- | --- | --- | --- |
| Original | 1 | 146 | 16 | 129 | 4 |
| Original | 2 | 198 | 11 | 134 | 4 |
| Modificada | 1 | 163 | 10 | 138 | 0 |
| Modificada | 2 | 129 | 16 | 127 | 0 |

Conclusión: se elimina el trabajo periódico de este módulo en reposo. Los tiempos de búsqueda son similares; una sola muestra no permite afirmar una mejora de velocidad general. Las operaciones de apertura y movimiento se validan en memoria; no son consultas o escrituras reales. La búsqueda se conserva tras redibujar y el menú vuelve a funcionar.

Producción no publicada ni modificada. La rama del laboratorio bloquea sus despliegues automáticos mediante configuración Git de Vercel y cancelación del build. No fusionar esta rama completa.

Pendiente: actualizar el esquema de una base aislada y comprobar consultas/sincronización real de dos PCs. La base antigua yebjacgqrycxcvpewmzq tiene sus 3 crons desactivados (lectura confirmada: 0 activos); no se ha usado para esta medición ni se ha copiado información real.

Hallazgo adicional anterior al cambio: la validación nocturna de estable f149533c falló en las dos pruebas multidevice. El error visible termina en browserContext.close al agotar la prueba; por sí solo no identifica si la causa está en el CRM, el entorno o el propio test. Investigar antes de dar por validada la sincronización. Evidencias: https://github.com/jramon07-lab/the_phone_face/actions/runs/34669206574
