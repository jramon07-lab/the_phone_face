# Contacto y titular del contrato

Rama exclusiva: `tmp/contact-profile-recover-20260901`.
Punto previo a esta corrección: `f78d3898087bee67fe3ffa2ec29d3aeedd69b7f1`.
Preview anterior conservada: https://the-phone-face-app-whatsapp-fotos-y-multimedia-gubcvt85y.vercel.app/

## Comportamiento

- Crear y editar contacto en PC y móvil incluye «El contacto es también el titular», marcada inicialmente.
- Si son personas diferentes se guardan nombre, DNI y teléfono opcional del titular en `records.data.TPF_TITULAR`. El DNI de la persona de contacto sigue siendo opcional.
- El bloque morado identifica al titular. El bloque azul permite elegir el destinatario de los WhatsApp automáticos. Elegir titular exige un teléfono válido. Sin teléfono del contacto se puede guardar la ficha, pero los envíos automáticos sin destinatario válido quedan fallidos con explicación.
- La lista de contactos busca por nombre, DNI y teléfono de ambas personas. La ficha muestra el titular y el destinatario.
- Las oportunidades nuevas guardan una copia independiente en `sales_opportunities.contract_party`. Se puede editar desde la oportunidad. Cambiar después la ficha general no cambia la copia de otras oportunidades. Las oportunidades antiguas no se rellenan retroactivamente.
- Los trabajos automáticos nuevos congelan el destinatario. El saludo y la bienvenida usan su nombre. La oportunidad y la tarea mantienen la identidad y relación de la persona de contacto.
- Los WhatsApp manuales y la identificación de chats mantienen su funcionamiento actual. La elección de este bloque es para los mensajes automáticos; no renombra conversaciones.
- No se cambia el transporte de mensajes, multimedia, permisos ni envío aprobado. No se modifica `whatsapp-green-core.js`.

## Instalación y validación

SQL aplicado en el proyecto existente mediante las migraciones `contact_party_snapshots_and_recipient_context` y `contact_party_normalized_recipient_phone`. La referencia SQL final está en `db/proposals/contact-party.sql`; no repetir sobre el esquema ya instalado.
Se añadió una columna nullable y funciones/trigger privados con `SECURITY INVOKER`, búsqueda de esquema explícita y sin acceso anónimo. Se conserva la función de contexto pública existente y su control de acceso.
El runner se desplegó como versión 7, manteniendo la comprobación del secreto del cron y la configuración JWT anterior.

Verificación: análisis sintáctico JS/TS; `node tests/contact-party.cjs`; consultas de funciones puras SQL para los dos destinatarios, teléfono opcional, rechazo de titular sin teléfono, prefijos internacionales y contexto antiguo inalterado. No se crean registros de negocio, mensajes ni ejecuciones de prueba. Las automatizaciones DEMO continúan pausadas y la bienvenida no se activa.
La revisión visual autenticada queda pendiente: el navegador de revisión muestra el formulario de acceso.

## Reversibilidad

Para volver al diseño previo, revertir únicamente los archivos de interfaz de esta corrección en la rama temporal. Mantener la columna y el servidor permite conservar los titulares y destinatarios que se guarden posteriormente. No borrar `TPF_TITULAR` ni `contract_party`.
La versión anterior del contexto y del runner se conservan en `db/proposals/contact-party-context-before.sql` y `contact-party-runner-before.ts` como referencia. Restaurar el servidor requiere revisar previamente cualquier trabajo creado con destinatarios nuevos; no hacerlo como parte de un simple cambio de diseño.
No se modificaron contactos, oportunidades o tareas existentes para probar, ni se promovió ninguna Preview a Production. Git conserva el código; esta corrección no realiza una copia de la base de datos.

## Nombre y apellidos separados

Corrección posterior sobre `c168c9a0d4c11528c9c12754a7901581d19a3f44`: el formulario compartido de contacto y oportunidad (PC y móvil) presenta Nombre y Apellidos en dos campos. Se guardan `holder_first_name` y `holder_last_name`, manteniendo `holder_name` completo para búsqueda, ficha y compatibilidad. Los nombres compuestos se conservan cuando se introducen en Nombre. Para registros anteriores sin separación se propone primera palabra/resto con un aviso para revisarlo; el nombre completo no pierde palabras. No se reescriben registros existentes.
SQL aplicado: `contact_party_separate_holder_names`; referencia en `db/proposals/contact-party-separate-names.sql`. Verificado con funciones puras: nombre compuesto, apellidos, nombre completo, ida/vuelta y destinatario. No se ejecuta ningún envío ni se crean contactos de prueba. Se mantienen los colores y el comportamiento de automatizaciones.
