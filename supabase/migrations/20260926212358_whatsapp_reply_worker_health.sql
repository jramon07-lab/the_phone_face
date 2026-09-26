alter table public.crm_whatsapp_reply_settings add column last_check_at timestamptz, add column server_ready boolean not null default false;
