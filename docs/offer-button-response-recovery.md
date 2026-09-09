# Offer buttons and prompt response cancellation — 2026-09-09

Base remote development/stable: 62b6c22ee608e30783d32899130e4f28b256be7b.

Reported issue: PC displayed [interactivebuttons] / [interactivebuttonsresponse]. A real decline was not in wa_messages and reminders remained pending.

Confirmed GREEN history shape: interactiveButtons.contentText/buttons and interactiveButtonsResponse.selectedDisplayText/selectedId. The existing lifecycle_incoming database trigger DOES cancel offer jobs when the inbound message is inserted. The missing piece was continuous ingestion before the reminders became due.

Changes: parse both history and webhook envelopes in PC, mobile and runner; display offer text and option labels and selected response. Every existing minute cron tick checks up to 20 pending no-response offer jobs ordered by last check, regardless of run_at, synchronizes provider replies, and cancels answered jobs. Existing pre-send check remains. No-response/provider-error cases keep jobs pending. No column transitions or automatic acceptance added.

Checks: parser tests for all three options in all three consumers; future-job scanner tests (answered/silent/provider failure); existing response synchronization test; full npm run verify. Database transactional rehearsal using the real decline confirmed both day-2 and day-5 jobs cancel, then rolled back. No messages sent by this review.

Limits: this is minute polling plus provider history latency, not an instant webhook. GREEN documents up to two minutes for journal availability. Batches rotate if there are more than 20 pending reminder jobs. Unavailable provider retains pre-send fail-closed guard. Browser gate and final deployment/real cancellation still to verify at this checkpoint.

## Live verification after deployment
Runner v12 minute tick at 2026-09-09 13:42 UTC synchronized the user's actual decline and cancelled both reminders for the reported offer. The database contains the selected text, No me interesa. No outgoing job claimed or sent during that tick. Additional guard added for HTTP-200 degraded/rate-limited/malformed history; such responses must defer, never infer silence. Development browser gate: GitHub Actions 34358638046 (UI commit 21d655fc); result still pending while this checkpoint is written.

## Direct webhook replacement — 2026-09-09

The continuous pending-offer history scan is removed. GREEN-API Webhook Endpoint now targets the dedicated `crm-green-webhook` Supabase Edge Function using the provider-supported `webhookUrlToken` Authorization header. The endpoint validates the existing runner secret, accepts only incoming direct chats, persists the message in `wa_messages`, and relies on `crm_private.lifecycle_incoming` to cancel pending offer jobs immediately. Duplicate delivery is idempotent. Group messages are ignored.

The existing `no_response` provider-history check remains immediately before day-2/day-5 sends. Degraded, rate-limited, malformed, or unavailable history defers the send. `api/green?action=ensure` no longer clears `webhookUrl`, and settings output redacts the webhook token. `setwebhook` is restricted to the authenticated server runner and an exact allowlisted endpoint.

Verification before provider cutover: 104/104 local tests passed. Edge Function v1 returned HTTP 401 without a valid token and HTTP 200 for an authenticated non-message health payload. Provider cutover, direct test delivery, Chrome gate, and stable promotion remain pending at this checkpoint.
