# Connection recovery in preview

Base: 8fce8730d8185b2ca1b4024b052680fbb1e38997. Branch: tmp/contact-profile-recover-20260901.

The shared fetch layer loads before SDKs and monitors on desktop and mobile. It retries only explicitly allowlisted GET reads: CRM PostgREST table reads, WhatsApp state/chats/summary and green-status. One retry per call, a 30-second per-URL cooldown, and at most three retry waits. A pending failed read may wait up to eight seconds for connectivity. It does not replay work after that window. Retry-After is respected; long waits return the real failure rather than starting a background loop.

No POST/PATCH/PUT/DELETE, RPC, authentication, notification consumption, send, read receipt or file operations are replayed. Authentication failures, cancellations, expired request signals and persistent errors remain visible. There is no page reload, automatic save, or indefinite background replay. Existing view retry controls remain in place. Desktop monitor retains its exact-version/route/device recovery checks. Mobile monitors receive the final result of each attempt sequence; this change does not retroactively resolve its historical incidents.

Local verification: node tests/connection-recovery.cjs. Covers transient recovery, write exclusions, permissions, Retry-After, repeated failures, cooldown, and cancellation. No real messages, test tasks, opportunities or contacts created. No E2E performed.

Technical incident 1974 was separately marked resolved with an optimistic condition (38 occurrences, last seen 2026-09-05 18:30:48.457965+00). The exact recoveredAt Map shadowing cause was fixed in 4ab6e00f and verified deployed in 8fce8730. Context records the correction; history is preserved. Other historical incidents were not closed indiscriminately.

Rollback interface/code by reverting this commit. Earlier fixed preview l3axsk2g0 remains available. Git is not a database backup. No Production promotion.
