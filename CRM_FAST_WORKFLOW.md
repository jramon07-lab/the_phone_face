# Flujo rápido y seguro — The Phone Face CRM

## Objetivo
Reducir iteraciones, evitar previews equivocadas y detectar regresiones antes de que lleguen al usuario.

## Flujo obligatorio
1. Trabajar solo en `work/crm-unica-20260825`.
2. Hacer cambios pequeños y localizados.
3. No modificar áreas congeladas salvo necesidad explícita.
4. Ejecutar guardas de repositorio.
5. Esperar deployment de Vercel de ese mismo commit.
6. Verificar `/api/health` y exigir rama/commit exactos.
7. Verificar `/api/smoke` y exigir PASS.
8. Hacer comprobación visual de las pantallas afectadas.
9. Solo entonces marcar el cambio como válido.
10. Producción requiere aprobación explícita del usuario.

## Reglas de velocidad
- No crear ramas nuevas para un arreglo normal.
- No reutilizar previews antiguas.
- No acumular varios fallos no relacionados en un mismo cambio.
- Si una modificación rompe una zona congelada, revertir antes de seguir.
- Mantener un único punto de entrada del CRM; eliminar progresivamente wrappers redundantes cuando la ruta consolidada esté verificada.
- Separar progresivamente módulos grandes (WhatsApp, Contactos, Agenda, Ventas, Automatizaciones) para reducir efectos colaterales.

## Controles a implantar/mantener
- Health de deployment.
- Smoke test funcional.
- Release guard de código.
- Identificador de build visible.
- Pruebas de regresión por módulo.
- Pruebas visuales de pantallas críticas.
- Umbrales de rendimiento y tamaño.
- Backups antes de cambios de datos/esquema.
- Registro de releases aprobadas para rollback.
- Feature flags para funcionalidades nuevas o de riesgo.

## Criterio de DONE
DONE significa: mismo commit en GitHub + Vercel + health + smoke + validación visual. El código por sí solo no cuenta como terminado.
