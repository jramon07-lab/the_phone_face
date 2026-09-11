-- CRM contacts use the Spanish key TELÉFONO. Normalize accents when locating
-- the record for an incoming WhatsApp number, including stored WhatsApp chat IDs.
create or replace function public.crm_server_contact_for_phone(v_phone text)
returns uuid
language plpgsql
stable
security definer
set search_path='public'
as $$
declare
  p text:=public.crm_server_normalize_phone(v_phone);
  r record;
begin
  if p='' then return null;end if;
  for r in
    select rec.id,public.crm_server_normalize_phone(e.value) val
    from public.records rec
    cross join lateral jsonb_each_text(rec.data)e
    where rec.source_sheet='BASE DE DATOS'
      and (
        translate(lower(e.key),'áéíóúüñ','aeiouun') like '%telef%'
        or lower(e.key) like '%phone%'
        or lower(e.key)='tpf_whatsapp_chat_id'
      )
  loop
    if r.val=p or (length(p)=9 and r.val='34'||p) or (length(r.val)=9 and p='34'||r.val) then return r.id;end if;
  end loop;
  return null;
end
$$;

notify pgrst,'reload schema';
