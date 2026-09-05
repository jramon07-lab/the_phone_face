# Retired automation call

Verified baseline 37edc7ed7c66ef3ae36a4ab9359c2edc1e92a802. The current sales_opportunities trigger crm_server_opportunity_stage_trigger calls crm_server_on_opportunity_stage AFTER INSERT OR UPDATE OF stage_id. It enqueues enabled crm_automations through the current server engine. The legacy automation_rules table has zero rows; authenticated has no execute permission on run_sales_automations_for_opportunity. The desktop callback still called it after saves, causing a separate failed request even when the save succeeded.

Retain the callback for existing callers but delegate execution to the already installed server trigger. Do not grant permissions, change server functions, create records, activate rules, replay jobs or send messages. Local regression checks ensure callback emits no legacy RPC. Previous preview remains 1kvslw12r. Revert this commit to restore code; Git is not a DB backup.

Historical incident 54 lacks an HTTP status, so the current permission mismatch is confirmed but historical attribution cannot be proven from that row alone. Other old HTTP failures and opaque Script error remain unconfirmed, not silently resolved. Improvements already deployed include recovery Map fix, safe GET retry, read rate-limit backoff, mobile timeout budget, and diagnostics that capture HTTP codes and script location when supplied by the browser.
