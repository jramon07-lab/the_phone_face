# Automatizaciones: ampliación del motor existente

Base revisada: `9a5ee8b538f04b9ea648ed74f7454277a4caf3f1`, rama `tmp/contact-profile-recover-20260901`.
Preview anterior: https://the-phone-face-app-whatsapp-fotos-y-multimedia-h8v3xzwsr.vercel.app/

## Auditoría

Se encontraron cuatro reglas: OFERTA VODAFONE, CAMBIO VODAFONE y prueba pausadas;
PRUEBA E2E COMPLETA · RAMON · 04-09-2026 activa. Se conservan sin editar ni ejecutar.
El motor ya tenía disparadores de etiqueta/columna, varias acciones, esperas,
plantillas, condiciones sin respuesta, repeticiones, exclusiones, cancelación e
historial. También tenía etiquetas dinámicas con mes/año. No se sustituye el motor.

## Implementación

El constructor ofrece dos borradores pausados y un selector de protecciones para
adaptar una regla existente conservando sus pasos. Cambiar las protecciones deja
el editor pausado; guardar es explícito. Ninguna regla real se crea en el despliegue.
Los borradores pueden guardarse incompletos; la activación se valida también en
el servidor, incluso desde otros botones del CRM.

Oferta: etiqueta elegida → oportunidad → envío de oferta → OFERTA MES AÑO →
esperas/plantillas. Quitar la etiqueta, recibir una respuesta o entrar en las dos
columnas elegidas cancela los mensajes pendientes. Una campaña por cliente y regla:
reponer la misma etiqueta no reinicia esa campaña. Para otra campaña se configura
otra regla; no se reenvía automáticamente una campaña cancelada.

Después de tramitar: la columna elegida fija el instante de inicio → VENTAS MES AÑO
→ esperas/plantillas. Los días en Pendiente de tramitar no cuentan. Salir de Tramitado
cancela los mensajes pendientes. No depende de la etiqueta de seguimiento de oferta.
Las esperas son acumulativas: 2 días y después 5 equivalen a días 2 y 7 desde el inicio.

Los pasos nuevos esperan al anterior. Un fallo o cancelación evita ejecutar los
dependientes. Reintentar una expansión reutiliza las mismas claves de trabajo.
Cada trabajo vuelve a comprobar estado y contexto; también se comprueba justo antes
del transporte WhatsApp. El transporte `sendGreen` y `whatsapp-green-core.js` no cambian.
Una petición que ya haya sido aceptada por el proveedor no puede retirarse después.

La etiqueta OFERTA toma el mes de la confirmación del envío, en Europe/Madrid.
VENTAS toma el mes de entrada en Tramitado. El vínculo mensual es por oportunidad:
solo se retira una etiqueta de oferta si ninguna otra oportunidad registrada aún
la necesita. No se borran otras etiquetas ni se adivinan vínculos históricos.
El registro mensual pendiente tras un envío confirmado puede completarse aunque
el cliente responda; registrar ese hecho no envía un mensaje.

Las bajas explícitas reconocidas (BAJA, STOP, «no me escribáis más», «no quiero
recibir más mensajes», variantes de trato/acentos y «por favor») bloquean estos
flujos comerciales futuros. «No me interesa esta oferta» detiene su seguimiento,
sin convertirlo en una baja global. No se usa clasificación generativa.
El bloqueo se aplica a los flujos con estas protecciones; no se atribuye carácter
comercial a reglas antiguas arbitrarias ni afecta al chat manual.

## Instalación y límites

SQL `db/proposals/automation_lifecycle.sql`: soporte instalado, sin activar reglas.
Runner anterior conservado en `automation_lifecycle_runner_before.ts`; autenticación
por secreto existente preservada. Las tablas auxiliares están en `crm_private`,
con RLS y sin acceso anon/authenticated. Las RPC de ejecución solo admiten service_role.
El aviso INFO de RLS sin políticas en esas dos tablas es intencional: acceso denegado
por defecto y uso exclusivo desde funciones privadas. Véase
https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

Falta elegir con Ramón la etiqueta, las dos columnas, las plantillas y los intervalos
definitivos; después guardar/revisar y activar las reglas elegidas. Los días incluidos
en los borradores son ejemplos editables. Bienvenida continúa desactivada.

## Verificación y reversión

`node tests/automation-lifecycle.cjs`: pruebas locales sin red ni registros reales;
orden, días desde Tramitado, claves sin duplicados, cancelación, reintentos,
compatibilidad con flujos anteriores y transporte idéntico.
SQL de lectura verifica mes/año Madrid, frases de baja, falsos positivos y permisos.
No se ejecuta E2E ni se crean contactos, tareas, oportunidades o envíos de prueba.
La revisión autenticada de los formularios con Ramón queda pendiente; no se afirma
haber probado el envío de WhatsApp real.

Para volver: ejecutar rollback revisado para pausar/cancelar solo los nuevos flujos,
restaurar el runner anterior y revertir este commit de interfaz en la rama temporal.
Conservar las tablas privadas de bajas y meses. Git preserva código, no una copia
de la base de datos. No promover a Production ni a ramas estables.
