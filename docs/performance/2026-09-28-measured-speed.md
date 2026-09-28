# CRM performance check — 28 September 2026

Baseline production commit: cf7e31db0b816e06ec9200d428f274ae0153cdf7.

## Reproducible improvements

- Sales list refresh used to generate the complete hidden Kanban board too. It now renders only the list; returning to the board rebuilds it from current data.
- Concurrent contact list refreshes now share pending label reads within the same contact snapshot. Reloading contacts starts fresh reads; late reads cannot overwrite a newer label edit; failed reads remain retryable.
- WhatsApp analytics now fills its attention list immediately when opened, instead of waiting for a later metrics refresh.

## Controlled measurements

Node VM fixture, 1,000 opportunities / 7 stages. Five warmups and median of 25 runs. This measures render preparation, not browser layout, network, total screen latency or the user's PCs. The fixture's list renderer is a stub in both versions, so this specifically measures the eliminated board preparation.

| Operation | Before | After |
|---|---:|---:|
| Sales render preparation in list mode | 11.64 ms | 2.87 ms |
| Hidden board cards generated per list refresh | 1,000 | 0 |
| Label RPC reads: 25 contacts, four concurrent refreshes | 100 | 25 |

Reproduce the sales fixture with `node scripts/benchmark-sales-render.cjs <baseline-file> js/modules/contacts-sales-core.js`.

## Validation and limits

199 regression files passed, plus syntax and module guards. Added checks cover view switching after changed sales data, pending label requests, latest-edit precedence, reload isolation, failed reads and immediate analytics population.

The existing search debouncing, WhatsApp pagination (40 rows), hidden-screen guards and cross-PC refresh/invalidation are preserved. No schema, permissions, automatic message schedules or customer records changed.

One public HTML fetch from the execution environment took 7.96 seconds (7.81 seconds to first byte). This isolated network sample is not an end-user benchmark and cannot attribute delay to application code. Live browser navigation and list switching were responsive, but tool overhead prevents a reliable before/after end-user speed percentage. Real timings on the two store PCs remain unmeasured.
