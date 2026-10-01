BEGIN;
-- Exercise the real audit trigger on a temporary table only.
-- No opportunity/customer writes and no lifecycle or sending triggers.
CREATE TEMP TABLE sales_opportunities (
 id uuid, record_id uuid, contract_party jsonb, title text, amount numeric,
 expected_date date, installation_date date, annual_review_date date,
 stage_id uuid, status text, notes text, import_reference text, context jsonb
) ON COMMIT DROP;
CREATE TRIGGER test_workspace_history AFTER INSERT OR UPDATE
 ON pg_temp.sales_opportunities FOR EACH ROW
 EXECUTE FUNCTION crm_private.capture_workspace_change();

DO $test$
DECLARE
 item jsonb; sale uuid; holder uuid:=gen_random_uuid(); manager uuid:=gen_random_uuid();
 next_holder uuid:=gen_random_uuid(); before_count bigint; h public.crm_change_history;
BEGIN
 BEGIN
  -- SQL NULL, JSON null, scalars, arrays, empty and populated objects.
  FOREACH item IN ARRAY ARRAY[NULL::jsonb,'null'::jsonb,'[]'::jsonb,
    '42'::jsonb,'"legacy"'::jsonb,'{}'::jsonb,
    jsonb_build_object('holder_record_id',holder,'manager_record_id',manager,
      'recipient_contact_id',manager,'ignored','not-an-id')] LOOP
   sale:=gen_random_uuid();
   INSERT INTO pg_temp.sales_opportunities(id,record_id,contract_party,title,stage_id,status)
    VALUES(sale,holder,item,'Isolated history regression',gen_random_uuid(),'open');
   SELECT count(*) INTO before_count FROM public.crm_change_history WHERE entity_id=sale;
   IF before_count<>1 THEN RAISE EXCEPTION 'INSERT history was not recorded';END IF;
   UPDATE pg_temp.sales_opportunities SET stage_id=gen_random_uuid() WHERE id=sale;
   SELECT * INTO h FROM public.crm_change_history WHERE entity_id=sale AND operation='UPDATE';
   IF NOT FOUND OR h.before_values->'contract_party' IS DISTINCT FROM h.after_values->'contract_party'
    OR h.before_values->'stage_id' IS NOT DISTINCT FROM h.after_values->'stage_id'
    OR NOT holder=ANY(h.contact_ids) THEN RAISE EXCEPTION 'Stage history lost data';END IF;
   IF jsonb_typeof(item)='object' AND item ? 'manager_record_id'
      AND NOT manager=ANY(h.contact_ids) THEN RAISE EXCEPTION 'Manager association lost';END IF;
   UPDATE pg_temp.sales_opportunities SET status=status WHERE id=sale;
   IF (SELECT count(*) FROM public.crm_change_history WHERE entity_id=sale)<>2
    THEN RAISE EXCEPTION 'Unchanged update added duplicate history';END IF;
  END LOOP;
  -- Null -> object -> new object -> null retains both old and new identities.
  UPDATE pg_temp.sales_opportunities SET contract_party=NULL WHERE id=sale;
  UPDATE pg_temp.sales_opportunities SET contract_party=jsonb_build_object('holder_record_id',next_holder)
   WHERE id=sale;
  IF NOT EXISTS(SELECT 1 FROM public.crm_change_history WHERE entity_id=sale
    AND after_values->'contract_party'->>'holder_record_id'=next_holder::text
    AND next_holder=ANY(contact_ids)) THEN RAISE EXCEPTION 'New holder association lost';END IF;
  UPDATE pg_temp.sales_opportunities SET contract_party=NULL WHERE id=sale;
  IF NOT EXISTS(SELECT 1 FROM public.crm_change_history WHERE entity_id=sale
    AND before_values->'contract_party'->>'holder_record_id'=next_holder::text
    AND next_holder=ANY(contact_ids)) THEN RAISE EXCEPTION 'Old holder association lost';END IF;
  -- Roll back all synthetic rows and audit events, even after success.
  RAISE EXCEPTION USING ERRCODE='ZX001',MESSAGE='isolated history tests passed';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN
  RAISE NOTICE 'PASS: legacy JSON values, stage changes, history, identity associations and unchanged updates';
 END;
END
$test$;
DROP TABLE pg_temp.sales_opportunities;
ROLLBACK;

