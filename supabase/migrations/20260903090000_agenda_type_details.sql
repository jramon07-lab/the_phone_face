alter table public.agenda_items
  add column if not exists agenda_meta jsonb not null default '{}'::jsonb;

comment on column public.agenda_items.agenda_meta is
  'Type-specific agenda fields such as priority, duration, result and location.';
