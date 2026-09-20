# CRM reference adaptation — test only

Reference: `/workspace/sites/phone-face-design/public/maqueta.html` and `completo.css`.
Base: c476c2e9b38d5387fea1f395717004f8d9d72f8a, test/estable-clon-20260919-v2.

## Implemented
- Light navigation with outlined icons, shared reference typography and surfaces.
- Actual Inicio metrics, tables and analytics retained; reference light palette and spacing.
- Contacts worktable, profile header, tabs and original protected inputs retained.
- Opportunity reading view: dossier plus linked-contact side column.
- Opportunity editing: original inputs adopted (not cloned), contextual summary reflects input/change/open events; original save/delete/back handlers retained.
- Settings: original cards adopted into content column with section navigation. No settings hidden or data saved.
- Sales board, monthly closing, agenda, WhatsApp, templates, scheduled messages, email, labels, automation and administrative surfaces receive scoped reference styling.
- Browser inspection found sidebar overlap on opportunity editor and weak icon/offer-action contrast; corrected in follow-up.
- Email navigation was observed staying on the previous view with its lazy script present but no email section. Load the existing lightweight email UI directly and bind existing navigation; lazy fallback recognizes the existing view. No Microsoft connection or mail operation performed.

## Verification
- Initial implementation: `npm run verify`, 146/146 regressions and syntax checks passed.
- Authenticated browser on preview ac3d3545 as Ramón/Administrador. This is not a disposable-data account.
- Inicio renders current rows/metrics. New opportunity opens; original controls and contextual summary present; cancelled without saving.
- Settings section navigation and original Google/notification fields present.
- Contact search Demo produces three results; Demo Clienteshub opens. All six profile tabs select correctly.
- Offer configurator opens with all current options and preview; cancelled without sending.
- Read-only navigation: alerts, search, sales, import, agenda, WhatsApp, templates, scheduled messages, labels, automations, users, system, trash. Templates completed deferred loading with 22 templates.
- Monthly close: sales and pending-offers tabs load; cancelled without transitioning records.
- Email failed to open during initial browser review; follow-up fixes documented above require final-preview verification.
- One WhatsApp request AbortError appeared while rapidly switching modules. Do not claim zero runtime errors or all integration operations verified.

## Limits
This is a real-code adaptation of the reference, not a pixel-identical copy of every fictional mockup screen. Real CRM fields, controls and permissions are preserved. Mobile's separate `/movil/` implementation is unchanged in this revision. No production alias, database records, jobs or integration credentials changed. No external messages sent.
