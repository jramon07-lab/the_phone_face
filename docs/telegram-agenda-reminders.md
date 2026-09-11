# Telegram agenda reminders

The CRM sends one Telegram notification at the task's scheduled date and time. It never flushes an historical backlog after activation or deployment. A second notification is sent only when the task has an explicit second reminder.

Each message offers three actions: complete the task, postpone it by a predefined interval, or move it to one of the next seven days while preserving its Madrid local time. Every action updates the existing CRM task instead of creating a duplicate.

Delivery is handled server-side with a schedule-aware idempotency ledger and a short due-time window, so the CRM does not need to remain open and duplicate or stale delivery is avoided.
