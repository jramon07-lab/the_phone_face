# Investigación de entrega WhatsApp — 2026-09-10

## Alcance

Diagnóstico de las dos comprobaciones Vodafone “día siguiente” enviadas al número de prueba autorizado terminado en 409. No se enviaron mensajes adicionales durante esta investigación.

## Evidencia

- Trabajo con Netflix: `34835fcb-e649-40cc-9189-9f36766f55cb`.
- Trabajo sin Netflix: `9ef3d9cd-8f5d-4c59-8540-5411ab441f9e`.
- Ambos trabajos quedaron marcados como `done` por el motor antiguo tras recibir HTTP 200, sin conservar el identificador del proveedor.
- Vercel registró los POST a `/api/green` a las 06:07:02 y 06:08:01 UTC con HTTP 200.
- Una consulta posterior de solo lectura al historial protegido de GREEN-API encontró:
  - Con Netflix: `3EB08E924A825FB156C086`, 06:07:03 UTC, estado `read`.
  - Sin Netflix: `3EB022FD11D07B8CC017B3`, 06:08:02 UTC, estado `read`.
- La instancia emisora de GREEN-API termina en 8554 y el chat destinatario termina en 1409; no es un envío a la misma cuenta.
- Los textos recuperados corresponden respectivamente a las plantillas Vodafone con y sin Netflix.
- El usuario informó que no vio ninguno de los dos mensajes en el WhatsApp esperado.

## Conclusión

La selección de plantillas funcionó y GREEN-API registró ambos mensajes como salientes y leídos desde la cuenta terminada en 8554 hacia la terminada en 1409. Existe una discrepancia entre el estado registrado por el proveedor y el WhatsApp en el que el usuario esperaba recibirlos. El estado `done` anterior era insuficiente como prueba de entrega visible porque el motor no persistía `idMessage` ni verificaba posteriormente el historial.

## Corrección preparada

La rama `codex/verify-whatsapp-delivery-20260910` exige un `idMessage`, conserva el recibo, consulta el historial sin repetir el envío y solo completa el trabajo ante `sent`, `delivered` o `read`. Los estados `failed`, ausentes o agotados quedan registrados como error.

Validación local: 106/106 pruebas superadas. La corrección no está desplegada en el motor compartido de Supabase y la rama estable no fue modificada.
