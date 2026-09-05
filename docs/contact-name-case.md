# Contact name capitalization
User-authorized normalization of existing and newly saved contact names.
Applied on 2026-09-05 to the shared database. UI code and WhatsApp transport unchanged.

- Before INSERT / UPDATE OF data: normalize only NOMBRE, APELLIDOS, APELLIDO, NOMBRE Y APELLIDOS, CLIENTE, CLIENTE FINAL string values.
- Unicode initcap, trim and collapse whitespace. Existing accents and ñ survive; missing accents are not inferred. Every word receives an initial capital; special brand/acronym casing is not inferred.
- 294 existing records corrected; 0 remaining mismatches; 0 changes to other JSON fields.
- Private RLS-protected original/normalized data backup in crm_private.contact_name_case_backup. No customer data is committed to Git.
- Existing audit/actor/timestamp triggers remain enabled; corrections generate normal audit entries.
- Pure function examples checked: RAMON SANCHEZ LUPIAÑEZ -> Ramon Sanchez Lupiañez; MARÍA JOSÉ MUÑOZ -> María José Muñoz; extra-space lowercase -> Ana Pérez.
- No test contacts, opportunities, tasks or messages created. Automation definitions untouched.
- SQL is already applied; Vercel does not execute this file. Reload contacts to see corrected stored names.
- Rollback script restores only name values still equal to the correction, preserving subsequent edits and other fields. Review before running.
