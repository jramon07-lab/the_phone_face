-- Only the existing isolated test project yebjacgqrycxcvpewmzq.
-- Passive columns aligned with stable on 2026-09-12. No production migration.
alter table public.agenda_items add column if not exists whatsapp_delivery_status text default 'pending'::text not null;
alter table public.agenda_items add column if not exists whatsapp_delivery_error text;
alter table public.agenda_items add column if not exists whatsapp_attempted_at timestamptz;
alter table public.agenda_items add column if not exists whatsapp_provider_message_id text;
alter table public.agenda_items add column if not exists whatsapp_attempt_count integer default 0 not null;
alter table public.agenda_items add column if not exists agenda_type text default 'Tarea'::text not null;
alter table public.agenda_items add column if not exists agenda_meta jsonb default '{}'::jsonb not null;
alter table public.agenda_items add column if not exists crm_created_by uuid;
alter table public.agenda_items add column if not exists crm_created_by_name text;
alter table public.agenda_items add column if not exists crm_updated_by uuid;
alter table public.agenda_items add column if not exists crm_updated_by_name text;
alter table public.agenda_items add column if not exists crm_actor_kind text;
alter table public.records add column if not exists crm_created_by uuid;
alter table public.records add column if not exists crm_created_by_name text;
alter table public.records add column if not exists crm_updated_by uuid;
alter table public.records add column if not exists crm_updated_by_name text;
alter table public.records add column if not exists crm_actor_kind text;
alter table public.records add column if not exists crm_creation_origin text;
alter table public.records add column if not exists crm_responsible_id uuid;
alter table public.sales_opportunities add column if not exists crm_created_by uuid;
alter table public.sales_opportunities add column if not exists crm_created_by_name text;
alter table public.sales_opportunities add column if not exists crm_updated_by uuid;
alter table public.sales_opportunities add column if not exists crm_updated_by_name text;
alter table public.sales_opportunities add column if not exists crm_actor_kind text;
alter table public.sales_opportunities add column if not exists contract_party jsonb;
