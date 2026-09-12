# Revisión de capacidad del CRM — 12 de septiembre de 2026

La revisión nocturna está corregida en main mediante [PR 32](https://github.com/jramon07-lab/the_phone_face/pull/32). La mejora de rendimiento está preparada para revisión en [PR 33](https://github.com/jramon07-lab/the_phone_face/pull/33). No se han ampliado planes.

## Cambios concretos

- El destino nocturno es la URL estable actual. La URL configurada anteriormente apuntaba a otro origen, sin el módulo actual de sincronización. Se conservaron todos los controles y se mejoró el diagnóstico de los tiempos de espera.
- El tablero de ventas se actualiza al cambiar su contenido, recuperar el foco o cambiar el día. Se elimina el recorrido de todas las tarjetas cada 1,5 segundos en reposo.
- Agenda consulta los contactos vinculados en grupos de hasta 100 identificadores. Cada carga conserva su propia caché. El enlace por teléfono sigue rechazando coincidencias ambiguas.

## Mediciones

La comparación de navegador usó Chromium, la aplicación estable y lecturas autenticadas. En el candidato se sustituyó únicamente el módulo Agenda por la versión propuesta. Se bloquearon escrituras de negocio, envíos y marcado de mensajes como leídos. [Ejecución 34678203304](https://github.com/jramon07-lab/the_phone_face/actions/runs/34678203304).

| Comprobación | Estable | Candidato Agenda |
| --- | ---: | ---: |
| Conversaciones disponibles | 2.271 | 2.271 |
| Búsqueda WhatsApp, 3 mediciones | 356 / 431 / 394 ms | 346 / 433 / 495 ms |
| Abrir ficha | 233 ms | 210 ms |
| Cargar ventas, 13 oportunidades | 223 ms | 236 ms |
| Cargar Agenda, 15 filas | 410 ms | 365 ms |
| Consultas de registros durante carga de Agenda | 12 | 5 |
| Errores JavaScript | 0 | 0 |

El contenido visible de Agenda produjo el mismo SHA-256 en ambas variantes, incluidos clientes y DNI. La mejora demostrada es la reducción de consultas; estos tiempos de una ronda no representan una garantía ni un porcentaje general de aceleración.

El laboratorio del tablero usó 1.200 tarjetas y dos contextos de Chromium. Se probaron búsqueda, apertura, cambio de columna y conservación del filtro. En reposo se pasó de 4 recorridos de tarjetas a 0 durante 3,2 segundos. Evidencia previa: [34674232396](https://github.com/jramon07-lab/the_phone_face/actions/runs/34674232396).

## Base de datos aislada

Se reutilizó el proyecto de pruebas existente y se alinearon columnas pasivas e índices de los tres modelos medidos. Las funciones sales_board, search_records y contact_related_items coinciden con estable. Se añadieron 4.000 registros, 1.200 oportunidades y 600 tareas ficticias, sin teléfonos ni correos. Se conservaron dos tareas antiguas de prueba.

Dos sesiones SQL concurrentes hicieron 12 iteraciones cada una:

| Consulta | Mediana sesión 1 | Mediana sesión 2 | Máximo conjunto |
| --- | ---: | ---: | ---: |
| sales_board | 32,78 ms | 34,03 ms | 40,83 ms |
| search_records | 26,66 ms | 25,75 ms | 32,67 ms |
| contact_related_items | 0,61 ms | 0,65 ms | 1,82 ms |
| Agenda y contadores | 0,61 ms | 0,61 ms | 0,98 ms |

Estas cifras son ejecución SQL como propietario de la base. No incluyen red, HTTP ni coste de políticas de una sesión de usuario. No constituyen una prueba integral de todos los módulos del CRM conectados a 1.200 oportunidades. El entorno de pruebas mantiene otros módulos antiguos, por lo que no se presenta como una copia completa de producción.

Comprobación posterior: 0 cron activos, 0 automatizaciones activas, 0 tareas ficticias con envíos o avisos habilitados y 0 trabajos automáticos. Las tablas mantienen RLS. Los asesores muestran advertencias heredadas en funciones del entorno antiguo; no se modificaron sus permisos. [Referencia de revisión de funciones](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).

## Capacidad y planes

Producción ocupa aproximadamente 110 MB; conservaba 13 oportunidades y ningún registro de esta prueba de carga. Esto mide espacio y un momento concreto, no la capacidad total del CRM ni los picos de consumo.

No se ha demostrado una necesidad de subir de Pro. [Supabase Pro](https://supabase.com/pricing) permite ampliar cómputo y recursos sin cambiar a Team. [Vercel Pro](https://vercel.com/pricing) permite consumo adicional según uso. Añadir funcionalidades por sí solo no obliga a cambiar de plan; se decide por tráfico, memoria, CPU, almacenamiento y requisitos de servicio.

## Publicación

Main 080166ff solo cambió el workflow nocturno y el diagnóstico de la prueba de dos PCs; el código de la aplicación coincide con f149533c. PR 33 contiene únicamente dos módulos de PC y una prueba. No se debe fusionar la rama perf/isolated-1200-20260912 completa, porque contiene configuración destinada a impedir despliegues experimentales.
