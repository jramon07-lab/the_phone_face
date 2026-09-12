# Comprobación entre dos PCs — 12 septiembre 2026

Estable comprobado: https://the-phone-face-app-whatsapp-fotos-y.vercel.app, código f149533c. No se ha publicado ningún cambio del CRM.

Dos rondas consecutivas superadas:

- https://github.com/jramon07-lab/the_phone_face/actions/runs/34677106393 — 2/2 en 46,8 s.
- https://github.com/jramon07-lab/the_phone_face/actions/runs/34677202826 — 2/2 en 50,7 s.

La primera prueba abre Chromium en dos contextos (1280×720 y 1920×1080), sobre la aplicación estable. Sustituye los mensajes y escrituras de archivo por un estado compartido ficticio. Comprueba actualización periódica sin avisos, archivo/desarchivo, rechazo de escrituras, deshacer con respuesta lenta, cambio de chat sin mezclar historial/borrador y recuperación de resumen e historial tras interrupciones.

La segunda abre dos sesiones autenticadas y lee datos reales: 2.271 conversaciones en ambos resúmenes, 86 con mensaje reciente, misma firma del resumen y del historial seleccionado. Los identificadores se comparan mediante hashes; no se publican conversaciones. No se envían mensajes, no se marca leído y las escrituras de negocio están interceptadas.

Esto verifica el comportamiento en dos sesiones de navegador y la consistencia de lectura real. No equivale a medir latencia entre dos equipos físicos con redes distintas ni a probar escrituras en una nueva base aislada. No garantiza ausencia de cualquier fallo futuro.

## Causa del fallo nocturno

La ejecución nocturna 34669206574 usó PLAYWRIGHT_BASE_URL, cuyo origen difiere del estable. El diagnóstico respondió HTTP 200 y mostró formulario de acceso, pero no la referencia al módulo whatsapp-performance-max. La prueba esperaba ese módulo y agotaba su plazo. Al cerrar los contextos se ocultaba además el error original.

Evidencia de 34677202826:

`NIGHTLY_TARGET_CHECK {"sameStableOrigin":false,"pathIsRoot":true,"status":200,"redirected":false,"hasLogin":true,"hasCurrentSyncModule":false}`

Corrección preparada: destino estable explícito en el workflow nocturno, manteniendo la URL de despliegue para validaciones de previews. La prueba tiene límites por fase, mensajes sin datos privados y cierre con allSettled que conserva el error principal. Ambas rondas usaron el destino corregido.

## Estado de publicación

Los cambios y resultados están guardados en la rama de pruebas. La ejecución nocturna de main todavía conserva el destino antiguo hasta aplicar el ajuste del workflow o actualizar el secreto PLAYWRIGHT_BASE_URL. No se ha alterado main ni el CRM diario. La conexión GitHub disponible no expone modificación de secretos; el navegador de ajustes requiere iniciar sesión.
