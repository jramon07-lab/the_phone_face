# Autoría y bienvenida — preparación del 5 de septiembre

Estado: código de interfaz preparado en la rama temporal. SQL propuesto NO aplicado. Bienvenida NO activada. No se ha enviado ningún mensaje ni creado registros de prueba.

La Preview usa la base principal `overfzbjtpjqxzbujezg`; desplegar una Preview no aísla la base ni el ejecutor de automatizaciones. Aplicar los scripts cambia el servidor compartido y requiere resolver la instrucción de no tocar Production.

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

1. Revisar y probar `db/proposals/contact_authorship_welcome.sql` en una copia aislada del esquema actual. No se ha ejecutado: falta autorización para el servidor compartido y no se ha usado la antigua rama de base de datos.
2. Validar permisos, triggers existentes, concurrencia y el contrato de la cola sin llamar a GREEN ni al ejecutor. La validación local de JavaScript no sustituye esta comprobación SQL.
3. Aplicar el SQL en una transacción tras aprobación. No rellena autores antiguos.
4. Revisar el texto y ejecutar `db/proposals/activate_welcome.sql` con sesión de administrador. Este script crea la configuración y la etiqueta sin asignarla a contactos y no encola mensajes. Falla si ya existe Bienvenida, para impedir reutilizar una etiqueta con efectos desconocidos.
5. Verificar catálogos/RLS y capacidad de la interfaz mediante consultas de lectura. No hacer E2E ni envíos de prueba.

La interfaz muestra la bienvenida pendiente y deshabilitada hasta que la capacidad del servidor indique activación. El móvil y los restantes formularios no cambian sus creaciones: se benefician de la autoría del servidor cuando se aplique, pero la casilla de bienvenida de esta entrega se prepara para Crear contacto de PC.

## Reversibilidad

Conservar el commit anterior `6e16ad40549fed060bd266b617efe3a7ff99493c` y su Preview m4r4qwufc. El rollback SQL conserva columnas y solicitudes para no perder auditoría. Antes de retroceder el servidor, revisar las bienvenidas pendientes: un rollback de Git no cancela trabajos ni restaura la base de datos.
