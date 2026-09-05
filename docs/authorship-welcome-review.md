# Autoría y bienvenida — preparación del 5 de septiembre

Estado: SQL aplicado el 5 de septiembre tras autorización expresa del usuario sobre la base compartida. Migraciones `contact_authorship_welcome_disabled` y `contact_authorship_explicit_function_grants`. Bienvenida NO activada. No se ha enviado ningún mensaje ni creado registros de prueba. El archivo SQL recoge la definición consolidada; no volver a aplicarlo sobre tablas ya existentes.

La Preview usa la base principal `overfzbjtpjqxzbujezg`; desplegar una Preview no aísla la base ni el ejecutor de automatizaciones. El usuario autorizó esta actualización compartida manteniendo la bienvenida desactivada. No se ha promovido ninguna rama ni despliegue a Production.

## Resultado preparado

- Autoría diferenciada del responsable. Los registros antiguos sin autor no se atribuyen al usuario conectado. Cuando hay ID pero no permiso para resolver el nombre se indica esa limitación.
- Los nuevos autores se capturan en servidor desde auth.uid(), con su nombre en ese momento. Un cambio de responsable no cambia al creador. Las operaciones sin sesión humana se identifican como sistema, sin inventar un nombre de automatización.
- Historial de cambios de contacto, oportunidad y tarea mediante disparadores adicionales. Las notas usan el autor real de contact_activity.
- Creación manual mediante RPC atómico: contacto, solicitud explícita y etiquetas. Checkbox desmarcado por defecto. Importaciones y clientes anteriores no tienen solicitud y no reciben bienvenida.
- La etiqueta configurada captura al usuario que la añade. El texto definitivo se compone antes de entrar en la cola, por lo que conserva el nombre aunque cambie posteriormente.
- Una solicitud por cliente, bloqueo de fila y una clave estable welcome:contact_id impiden duplicados por pulsaciones repetidas y quitar/reponer la etiqueta. Un envío ambiguo queda sujeto a revisión, no se autoriza reintentarlo a ciegas.
- El estado enviada depende del resultado done del ejecutor, no del clic del usuario. No equivale a confirmación de lectura del destinatario.
- Texto inicial: «Hola {{nombre_cliente}}, soy {{nombre_usuario}}, de The Phone Face. Estoy aquí para ayudarte.»

## Activación pendiente

1. Instalación confirmada: cinco triggers de autoría y tres de auditoría. Nuevas tablas con RLS y permisos explícitos; acceso anónimo a los RPC nuevos revocado.
2. Lectura de capacidad comprobada con rol authenticated: installed=true, enabled=false. Petición de creación sin identidad rechazada antes de insertar. Cero solicitudes y cero trabajos welcome al terminar.
3. No se ha probado creación real ni envíos, respetando la prohibición de E2E y registros de prueba. Queda pendiente validar el recorrido de bienvenida antes de activarlo; comprobar permisos no equivale a verificar entrega de WhatsApp.
4. `db/proposals/activate_welcome.sql` NO ejecutado. Requiere sesión de administrador y revisión del texto. Crea configuración y etiqueta sin asignarla a contactos; falla si ya existe Bienvenida.
5. Asesor de seguridad consultado: sus avisos devueltos sobre funciones de automatización anteriores no se han modificado en esta entrega. Catálogos actuales de las nuevas funciones y tablas comprobados directamente.

La interfaz muestra la bienvenida pendiente y deshabilitada hasta que la capacidad del servidor indique activación. El móvil y los restantes formularios no cambian sus creaciones: se benefician de la autoría del servidor desde esta instalación, pero la casilla de bienvenida de esta entrega se prepara para Crear contacto de PC.

## Reversibilidad

Conservar el commit anterior `6e16ad40549fed060bd266b617efe3a7ff99493c` y su Preview m4r4qwufc. El rollback SQL conserva columnas y solicitudes para no perder auditoría. Antes de retroceder el servidor, revisar las bienvenidas pendientes: un rollback de Git no cancela trabajos ni restaura la base de datos.
