# Production consistency review — 1 October 2026

Scope: monthly sales imports, contact verification, pending message recipients, concurrent contact edits, backup coverage. Production baseline: `e08973867bd8a176d80d5380c795a5fd0d46181c`.

## Read-only audit results

- 57 saved import rows: 4 imported, 53 awaiting confirmation. Of the pending rows, 31 have one same-operator opportunity candidate, 2 have multiple candidates, 12 have a contact but no matching opportunity, and 8 lack a matched contact. Candidates are not proof of the same transaction. No rows were imported, opportunities created, or identities merged by this audit.
- 1,303 CRM contacts and queue entries: 1,207 verified; 96 require review. These are 67 provider reports of numbers not on WhatsApp, 22 missing name/valid phone, 3 Google phone conflicts, and 4 invalid-number provider errors.
- The 4 invalid-number entries were moved from retry to review with an exact error/status predicate. Names, phone numbers, and other customer fields were unchanged. The application now classifies this permanent error as review; 429/503 remain retryable.
- 56 pending WhatsApp/template jobs were joined to their opportunities and their normalized phone numbers compared with the saved recipient. All 56 matched. The 4 won opportunities retain 4 pending template jobs and 4 pending operator-review jobs. This is a point-in-time consistency check, not proof of future delivery.

## Corrections and validation

- Contact correction retry rejects a changed field when another writer saved a different value. Unrelated concurrent changes are retained. Nickname normalization now uses an optimistic data comparison too.
- Behavioral tests exercise conflicting identities, unrelated field edits, and identical concurrent changes. Existing inline-editor regression tests cover stale reads and compare-and-swap failures.
- Backup v4 covers all 52 public application tables, including 10 previously omitted tables for imports, synchronization, history, message receipts and offer follow-up. Pagination keys were checked against the live schema inventory. Four technical/recursive public tables remain explicitly excluded.
- v2 and v3 backups remain readable with their original table requirements. Tests check encryption, decryption, corrupted downloads, missing tables, primary keys, and API failure handling.
- Full local verification: 219 regression files passed, JavaScript syntax and modular structure passed.

## Remaining limits

- Existing backup recorded as verified at 03:30 Europe/Madrid on 1 October passed download/decrypt/count checks. It predates this coverage correction.
- A full restoration has NOT been demonstrated. The application correctly retains `restoreTested: false`. The CRM browser session requires login, preventing authenticated retrieval/creation of a real backup in this session. An isolated Supabase development branch exists but was not modified.
- Private schema tables, database schema/roles, Auth, Storage and deployment/encryption configuration require a separate database/platform recovery plan. Application JSON backups alone are not a complete platform restore.
- The 96 contact review cases require authoritative missing data or an identity decision. They must not be marked verified or merged by guessing.
- No real WhatsApp messages were sent and no production restore was attempted.
