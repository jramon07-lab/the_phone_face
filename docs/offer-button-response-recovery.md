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

## Provider cutover completed

- Development runtime commit `9f280de3ee5be68077ee009d6686937b09be6e6c`; test-only follow-up commit `14e48169f5fb90265dce285acf94f2fc80839de1`.
- GitHub Actions browser run `34362174898`: 50 passed, 3 skipped, 0 failed.
- GREEN `setSettings` returned configured/saved; follow-up `getSettings` reported the exact allowlisted Edge URL, token state `configured`, and `incomingWebhook=yes`.
- `crm-green-webhook` v1: invalid authorization returned 401; valid non-message returned 200 ignored; authenticated synthetic interactive response returned 200, persisted `No me interesa` with type `interactiveButtonsResponse`, and the synthetic row was deleted after inspection.
- `crm-automation-runner` v14 is active. Its first inspected cron response was HTTP 200 with no `responseSync` field and no claimed/sent work, confirming removal of continuous provider polling.
- Existing real offer response and its day-2/day-5 jobs remain cancelled from the preceding verified correction.

## Durable follow-up observability — 2026-09-09

Added `crm_offer_followup_events`, a protected operational audit that records: incoming response cancellation, pre-send response block, verification deferral, delivery deferral, final failure, and successful reminder send. It stores the related offer, opportunity, contact and job, but the trigger deliberately never updates `sales_opportunities` or its stage. The user continues to move commercial columns manually.

The latest result is displayed inside each opportunity on PC and mobile. Administrators also get a seven-day “Seguimientos de WhatsApp” registry under Sistema → Diagnóstico. Webhook persistence failures are copied into the existing central incident registry with credentials redacted. Audit writes are non-blocking so an unavailable diagnostic table cannot prevent the safety action itself.

Verification before UI deployment: 105/105 regression tests passed and 147/147 JavaScript files parsed. The migration was first executed inside an explicit transaction and rolled back, then applied. A second transactional database rehearsal created a synthetic offer with day-2 and day-5 jobs; inserting `No me interesa` cancelled exactly both jobs, inserted one audit record, preserved the opportunity stage, and rolled all synthetic rows back. Supabase confirms RLS with one read policy. Foreign-key indexes were added after the database advisor identified them. Edge Functions active: `crm-green-webhook` v2 and `crm-automation-runner` v15.

Remaining gate at this checkpoint: save the UI commit on GitHub, validate the development deployment in Chrome, and only then promote the same commit to the stable URL.
