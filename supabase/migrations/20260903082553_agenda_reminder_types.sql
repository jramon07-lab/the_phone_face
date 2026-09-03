alter table public.agenda_items
  add column if not exists agenda_type text not null default 'Tarea';

comment on column public.agenda_items.agenda_type is
  'User-facing reminder category; available categories are stored in app_settings under agenda_types.';
