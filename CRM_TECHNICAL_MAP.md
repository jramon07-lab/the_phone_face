# The Phone Face CRM — mapa técnico

Base de recuperación objetiva: `5d48880e4b26377018f08c5edd771805f1095b7a`.
Rama temporal: `tmp/crm-complete-recovery-20260901`.

## Propiedad funcional

| Dominio | Módulo propietario | Entrada principal | DOM / modal | Datos | Volver | Protegido |
|---|---|---|---|---|---|---|
| Ficha contacto | `js/modules/contacts-sales-core.js` + `js/modules/contact-profile.js` | `openContact(id)` | `#contactModal` | `records` | `tpfBackExactly()` | Sí |
| Edición contacto | `contact-profile.js` sobre campos reales de `contactModal` | `#tpfContactEditToggle` → `setEditMode()`; guardado por `#contactSave` | campos `contactFirstName`, `contactLastName`, `contactPhone`, `contactDni`, `contactEmail`, etc. | `records` / RPC DNI | permanece en ficha | Sí; no crear editor paralelo |
| Crear contacto | módulo moderno de Contactos | entrada nativa de creación | formulario moderno de Contactos | `records` | origen previo | Sí; reutilizar desde WhatsApp |
| Oportunidades | `contacts-sales-core.js` + módulos nativos de ventas | `openContactNewOpportunity()` / `openOpportunityCard(id)` | `#oppDetailModal` | `sales_opportunities`, etapas/campos de ventas | origen capturado por flujo nativo | Sí; sin interceptores capture |
| Tarea nueva de contacto | `contacts-sales-core.js` | `openContactTaskPage()` | `#cpTaskPage` | `agenda_items` | `tpfBackExactly()` | Sí |
| Detalle tarea | `contacts-sales-core.js` | `openContactTaskDetail(id)` | `#cpTaskDetailPage` | `agenda_items` | `tpfBackExactly()` | Sí |
| Agenda | `agenda-core.js` y módulos de agenda | flujo nativo Agenda | `#view-agenda` | `agenda_items` | navegación app | Sí |
| WhatsApp | `whatsapp-green-core.js` + módulos de presentación específicos | entradas WhatsApp | `#view-whatsapplive` | GREEN API + datos CRM | conversación activa | **NO TOCAR `whatsapp-green-core.js`** |

## Reglas de arquitectura

- Una función real, varios puntos de entrada.
- `contact-actions-bridge.js` queda sin interceptar: no debe crear un segundo editor.
- `contact-opportunity-actions.js` queda limitado a layout: no debe capturar clics ni duplicar el propietario de oportunidades.
- No usar `whatsapp-task-bridge.js`.
- No añadir listeners `capture`, polling, `setTimeout` de reparación ni capas DOM para sustituir propietarios nativos.
- WhatsApp debe llamar a los propietarios nativos después de validar primero la ficha de cliente.

## Hallazgo DOM de tareas

En la base recuperada, `#cpTaskDetailPage` está anidado dentro de `#cpTaskPage`. Por tanto, ocultar `#cpTaskPage` puede ocultar también el detalle aunque `openContactTaskDetail(id)` quite `hidden` al detalle. La corrección debe ser estructural: ambos paneles deben ser hermanos dentro de la ficha, sin reconstruir la lógica de tareas.

## Validación de release

Antes de entregar Preview:

1. Vercel `READY`.
2. `githubCommitSha` coincide exactamente con HEAD de la rama temporal.
3. Ficha cliente abre.
4. Editor real precarga y guarda.
5. Crear y editar oportunidad funcionan con editor nativo.
6. Crear/editar/guardar/completar/reabrir/eliminar tarea funcionan.
7. Volver restaura origen.
8. Smoke WhatsApp, conversaciones, multimedia, Programar WhatsApp, Contactos y Panel de ventas.
9. `npm run test:e2e` valida DOM/pantalla final autenticada.
