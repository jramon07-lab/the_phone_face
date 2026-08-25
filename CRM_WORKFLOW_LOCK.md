# The Phone Face — Rama y proceso de trabajo oficial

Fecha: 2026-08-25

## Rama oficial única

- `work/crm-unica-20260825`
- Base: commit `bdc95e785d013ebc74cb96636a6c945029c22f19`
- Motivo: en esta base el usuario confirmó que WhatsApp había mejorado.

## Regla obligatoria

No se usará ninguna otra rama o preview para nuevas correcciones del CRM salvo que este archivo se actualice explícitamente.

## Flujo de validación antes de enseñar una versión

1. El cambio debe existir en la rama oficial.
2. El despliegue de Vercel debe corresponder exactamente al último commit de la rama oficial.
3. La URL de preview debe servir ese despliegue, no otro.
4. Verificación visual obligatoria de cada cambio pedido antes de compartir la URL.
5. WhatsApp no se tocará salvo necesidad explícita, porque su mejora actual debe conservarse.
6. No se fusionará a `main` hasta que el usuario confirme la preview.

## Cambios pendientes actuales

- Plantillas WhatsApp: mostrar solo las del usuario y acceso visible en la barra lateral.
- Automatizaciones: recuperar la versión avanzada, no la versión básica reducida.

## Prevención de regresiones

- No crear nuevas ramas de prueba para estos dos puntos.
- No reutilizar previews antiguas.
- No marcar una corrección como terminada solo porque el código esté escrito: debe verse en la preview correcta.
- Cualquier revisión de los 6 debe usar esta rama y este documento como fuente de verdad.
