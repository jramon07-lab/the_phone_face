# Contact identity and enrichment review

Continues c02714b2a495a4c625c3ac89df75eb0fab521560 on temporary branch only.

Confirmed duplicates require normalized nonempty full name, DNI and at least one phone in common, with one confirmed CRM target and no competing DNI identity. Missing identifiers or ambiguous matches remain doubtful. Different nonempty name and DNI prevents updating that CRM record even with shared phone/email. Formatting differences in names, +34 phones, DNI and email are not offered as updates.

Exclusive row groups: duplicate without new primary data; duplicate with missing fields; duplicate with text to append; possible different person; no matches; doubtful. Shows new information before choosing an action. Existing labels, holder data and custom fields remain untouched on updates; these are not covered by the primary-field novelty count. Excel internal coincidences remain visible.

Notes/observations fill empty fields or append with an Importación Excel separator. Never replace existing text through this import update. Reimporting the same appended block is a no-op. Other nonempty conflicting fields remain explicit review choices. No fields preselected and no writes until confirmation. Existing concurrency guards preserved.

Validation: node --check js/modules/import-mapping.js; node tests/import-review.cjs. Local supplied workbook 123 rows also analyzed without CRM writes. No E2E, contacts, opportunities, tasks or messages created. Live CRM-specific counts are produced inside the user's authenticated preview session. Prior fixed preview retained: https://the-phone-face-app-whatsapp-fotos-y-multimedia-26swuqk28.vercel.app/.
