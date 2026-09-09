-- Netflix sube solo en la contraoferta Vodafone; la tarifa estándar conserva 4 €.
update public.crm_offer_line_options as line
set price_delta=7
from public.crm_offer_catalog as offer
where line.offer_id=offer.id
  and offer.operator='Vodafone'
  and offer.name='VDF · CONTRAOFERTA 1 GB + 2 ILIMITADAS'
  and offer.is_counteroffer=true
  and line.name='Netflix'
  and line.price_delta=4;
