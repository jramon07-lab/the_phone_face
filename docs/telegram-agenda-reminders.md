# Telegram agenda reminders

The preview branch sends one Telegram notification at the task's scheduled date and time. The message includes an action to mark the CRM task as completed. A second notification is sent only when the task has an explicit second reminder.

Delivery is handled server-side with an idempotency ledger so the CRM does not need to remain open and duplicate delivery is avoided.
