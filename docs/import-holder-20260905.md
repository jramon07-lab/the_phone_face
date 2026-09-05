# Assign imported person as contract holder

Adds an explicit holder action to visible valid contact import rows. Select an existing CRM contact, inspect the current and incoming holder, confirm the relationship/replacement, then confirm import. Uses existing TPFContactParty.validate and records.data.TPF_TITULAR; no new holder schema or messaging logic.

Only holder first/last name, DNI and primary phone are assigned. Source notes, observations and labels are not copied onto the contact. Existing contact data and WhatsApp recipient remain preserved. Assignments to a contact currently sending to its holder are blocked to avoid silently changing the destination. All CRM records are reread before saving; any change clears previous decisions, and JSON equality guards the target write. No database writes, messages or E2E during verification.

Checks: node --check js/modules/import-mapping.js; node tests/import-review.cjs; node tests/import-holder.cjs. These are local checks, not an authenticated import write test. Previous commit: 1256fa135e92386112543504253c49a765503e2a.
