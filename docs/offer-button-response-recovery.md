# Offer buttons and prompt response cancellation — 2026-09-09

Base remote development/stable: 62b6c22ee608e30783d32899130e4f28b256be7b.

Reported issue: PC displayed [interactivebuttons] / [interactivebuttonsresponse]. A real decline was not in wa_messages and reminders remained pending.

Confirmed GREEN history shape: interactiveButtons.contentText/buttons and interactiveButtonsResponse.selectedDisplayText/selectedId. The existing lifecycle_incoming database trigger DOES cancel offer jobs when the inbound message is inserted. The missing piece was continuous ingestion before the reminders became due.

Changes: parse both history and webhook envelopes in PC, mobile and runner; display offer text and option labels and selected response. Every existing minute cron tick checks up to 20 pending no-response offer jobs ordered by last check, regardless of run_at, synchronizes provider replies, and cancels answered jobs. Existing pre-send check remains. No-response/provider-error cases keep jobs pending. No column transitions or automatic acceptance added.

Checks: parser tests for all three options in all three consumers; future-job scanner tests (answered/silent/provider failure); existing response synchronization test; full npm run verify. Database transactional rehearsal using the real decline confirmed both day-2 and day-5 jobs cancel, then rolled back. No messages sent by this review.

Limits: this is minute polling plus provider history latency, not an instant webhook. GREEN documents up to two minutes for journal availability. Batches rotate if there are more than 20 pending reminder jobs. Unavailable provider retains pre-send fail-closed guard. Browser gate and final deployment/real cancellation still to verify at this checkpoint.

## Live verification after deployment
Runner v12 minute tick at 2026-09-09 13:42 UTC synchronized the user's actual decline and cancelled both reminders for the reported offer. The database contains the selected text, No me interesa. No outgoing job claimed or sent during that tick. Additional guard added for HTTP-200 degraded/rate-limited/malformed history; such responses must defer, never infer silence. Development browser gate: GitHub Actions 34358638046 (UI commit 21d655fc); result still pending while this checkpoint is written.
