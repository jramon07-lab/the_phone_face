# Automatic follow-up business hours — 25 September 2026

## Confirmed incident

Two offer follow-ups were accepted by GREEN-API at 08:06 Europe/Madrid on
25 September, after earlier attempts were blocked by an expired subscription.
Scheduling some waits in business hours did not protect overdue execution.

## Correction

- Check actual Madrid business hours before automatic provider work and again
  after the provider state lookup, immediately before sending.
- Monday–Friday: 10:00–14:00 and 17:30–20:30; Saturday: 10:00–14:00.
  Closing boundaries excluded; Sunday deferred to Monday 10:00.
- Defer the existing job, retaining its identity/deduplication key. Do not
  consume attempts while waiting. The conditional running-status update
  cannot revive a cancelled job.
- First attempt of a manually requested initial offer remains immediate.
  Its subsequent retries use business hours. Delivery receipt verification
  remains independent of sending hours and does not resend accepted messages.
- Normalize new child send jobs when scheduled. Seven existing pending jobs
  were moved forward to valid windows using original-time/status predicates:
  six offer reminders and one December after-sale message at closing time.
- No schedule duplication, cron execution, test customer send, or reactivation
  of failed messages was performed.

## Verification

- Original live runner v20 matched repository sources exactly before editing.
- Deployed runner v21; retrieved files match the tested local sources exactly.
- 191/191 JavaScript syntax checks passed. Full 172-file regression run had
  one clock-dependent transport fixture failure; fixed the fixture to use a
  deterministic open-hours time and reran all affected tests successfully.
- New offline cases cover 08:06 recovery, lunch, closing boundaries, Saturday,
  Sunday, both DST changes, cancellation, retry count, manual initial sends,
  confirmation outside hours and provider lookup crossing closing time.
- Existing lifecycle/transport and 12 canonical runner cases pass offline.
- Stable e2e9da0d production read-only browser run 36101973338 attempt 3:
  4/4 passed, PC and mobile, zero page errors/failed reads, no customer writes
  or sends. PC verified Google connected and WhatsApp authorized.

## Previous system-status screenshot

Reviewed 58 active events. Four critical events were old missing-function or
initialization errors, with corrected code and current browser evidence.
Resolved those four, three related obsolete ReferenceErrors, and the confirmed
expired-subscription event (8 total), retaining their history/evidence.
Do not equate a healthy current snapshot with resolution of every old event.

The single failed automation in the last 24 hours was after-sale job
8431d40f-c3cc-4d5f-ae2a-64738f44ab0e, which failed before sending because GREEN
was not authorized. It has no delivery receipt. It remains failed for review;
no delayed customer message is silently resent as part of this repair.
Other historical network/resource events have not been blanket-resolved.
