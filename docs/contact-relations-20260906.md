# Linked holders — desktop preview

Branch: tmp/contact-profile-recover-20260901. Previous preview: b855a50b.

- Isolated UI: js/modules/contact-relations.js.
- Existing create/edit saves call applyContactData; opportunity save awaits prepareOpportunity.
- Manager stores links under records.data.TPF_RELACIONES.managed_contacts.
- TPF_TITULAR remains unchanged: its database trigger deliberately normalizes known keys. No database schema, trigger, permission, automation or production deployment changed.
- Linking uses existing active BASE DE DATOS records under the signed-in user's RLS. Search pages records, stops obsolete searches and displays at most 30 choices.
- Selecting or removing a link changes only the draft; existing Save persists the manager record. No automatic contact creation or duplicate matching.
- The previous embedded holder remains visible in a collapsed section. It can still be selected for a new opportunity, without requiring a separate record. Its data are not automatically migrated to another person's record.
- New opportunities selected for a linked holder store the holder record_id/client_name and a frozen contract_party with manager contact/recipient data. Direct creation from a holder finds incoming manager links. Ambiguous managers require explicit choice.
- Existing opportunity snapshots are preserved on ordinary edits. Server-normalized snapshots do not retain arbitrary relation IDs; historical clickable links therefore require an unambiguous current identity match, otherwise names remain plain text.
- No changes to WhatsApp transport, multimedia, tasks, scanner or document folders. No automatic aggregation of another record's opportunities into the existing contact summary.
- Contact field editors and opportunity form covered here are desktop. Existing mobile contact edits preserve the separate relationship field through their normal data merge; no new mobile picker is added.

Verification: contact-relations.cjs exercises persistence payload, multi-links, owner vs recipient, frozen edits, legacy, ambiguity, deleted records and stale contexts using mocks. Existing party/scanner/document/navigation tests retained. Live read-only check confirmed JSONB containment query supported. Authenticated end-to-end save still needs testing with the user's session; no real contact or opportunity was created for testing.
