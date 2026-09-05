# Contact import review

Contact import now displays every row, explicit skip/create/update choices, all CRM matches by phone/DNI/email, intra-workbook collisions and selected non-empty field diffs. Nothing is selected by default. Ambiguous phones never auto-merge. Duplicate DNI cannot create a separate record. Malformed phone/DNI/email and multiple DNI require Excel correction. Format validation does not certify document authenticity or phone reachability.

Updates preserve existing labels, holder data and custom fields and require explicit selected fields and confirmation. Empty cells do not erase fields. Conditional JSON data equality guards against concurrent record changes. Reanalysis clears decisions when source/matches changed. Import attempts guard against double clicks and retain completed-row tracking after partial failure. New labels are limited to selected creates. The sheet chooser defaults to REVISAR NO IMPORTAR when present.

Validation: node --check js/modules/import-mapping.js; node tests/import-review.cjs. Local supplied workbook: 123 rows, 98 with within-file/format warnings, zero selected by default. This is not a live CRM matching count. No customer records were imported or updated in verification, and no E2E or messaging test ran. Authenticated browser import/write behavior remains to be reviewed by the user in Preview before actual import.

Previous HEAD: 736931e3d8df5a379c2e5c6b53780b2294cd9a65. Previous fixed Preview: https://the-phone-face-app-whatsapp-fotos-y-multimedia-pgnsiwxtj.vercel.app/
