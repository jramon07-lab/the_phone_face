# Revisiones del mes

Las oportunidades que estaban en Próximo o Este mes al activar el cambio se registran en una exclusión permanente. Conservan sus fechas, etiquetas y automatizaciones anteriores. No se convierten a este flujo.

Para ventas con instalación real registrada, se prepara una revisión en la misma oportunidad: aniversario al año, fecha prevista cinco días antes, inicio y mensaje un mes antes del aniversario. Para revisiones manuales nuevas, se introduce el operador y el fin del descuento; no se le restan cinco días. Se usan meses naturales, con ajuste al último día si el mes es más corto. Los inicios previstos para el día 1 se aplazan al 2. Los mensajes respetan el horario de atención de Phone House Albolote en Madrid.

La lista está en el menú junto al Panel de ventas y tiene acceso desde Inicio. El mes corresponde al inicio del seguimiento. Permite editar el mensaje y la fecha, cancelar solo el envío, completar o cancelar toda la revisión. Cada mensaje incluye el nombre del responsable y conserva titular, gestor y destinatario. Las revisiones tardías y los datos incompletos requieren confirmación antes de programar envíos.

Al iniciar se mueve la oportunidad a Este mes y se etiqueta REVISIÓN MES AÑO. Se retira la etiqueta del mes de la venta original si no corresponde también a otro contrato del mismo cliente. El historial y la instantánea de la venta se conservan. Completar o cancelar la revisión retira su etiqueta activa; cancelar solo el envío conserva la revisión.

WhatsApp usa una carpeta Este mes basada en revisiones activas, sin modificar mensajes pendientes ni estados de lectura. Los clientes que responden siguen en Pendientes. Enviado exige una confirmación de entrega guardada por el motor; aceptar un mensaje en GREEN-API queda como Pendiente de confirmar.

No se reenvía una revisión en caso de repetición del cron: la revisión es única por oportunidad y fecha y el trabajo es único por revisión. Edición y cancelación bloquean el trabajo en una transacción y no modifican envíos ya en curso o aceptados. Las bajas comerciales y los destinatarios eliminados se comprueban antes de enviar.

Validación: suite de regresiones, navegador con datos aislados en PC y móvil, SQL transaccional con disparadores desactivados y ROLLBACK. Las pruebas no realizan envíos reales.
