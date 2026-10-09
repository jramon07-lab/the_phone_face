/* Real import RPCs, isolated PostgreSQL and synthetic holder/manager data. */
const fs=require('node:fs'),assert=require('node:assert/strict'),{PGlite}=require('@electric-sql/pglite');
async function main(){
 const db=new PGlite(),H='10000000-0000-0000-0000-000000000001',M='10000000-0000-0000-0000-000000000002',X='10000000-0000-0000-0000-000000000003',O='20000000-0000-0000-0000-000000000001',R='30000000-0000-0000-0000-000000000001';
 await db.exec(`create schema auth;create schema crm_private;create role anon;create role authenticated;create role service_role;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function public.current_user_is_admin() returns boolean language sql as $$select coalesce(current_setting('test.admin',true),'true')='true'$$;
 create function crm_private.contact_name_case(text) returns text language sql immutable as $$select initcap($1)$$;
 create table records(id uuid primary key,data jsonb,source_sheet text default 'BASE DE DATOS');
 create table sales_stages(id uuid primary key,pipeline_id uuid,name text,active boolean,position int);
 create table sales_opportunities(id uuid primary key default gen_random_uuid(),pipeline_id uuid,stage_id uuid,record_id uuid,title text,client_name text,phone text,amount numeric,expected_date date,owner_user_id uuid,status text,installation_date date,annual_review_date date,installation_operator text,import_reference text unique,installation_recorded_at timestamptz,updated_at timestamptz default now(),contract_party jsonb);
 create table crm_sales_import_rows(id uuid primary key,source_key text unique,payload jsonb,opportunity_id uuid,imported_at timestamptz);
 insert into sales_stages values('${O}','${O}','Ganado',true,1);
 select set_config('request.jwt.claim.sub','${H}',false);`);
 const preserve=fs.readFileSync('db/proposals/sale-party-preserve-identities.sql','utf8');
 await db.exec(preserve.slice(0,preserve.indexOf('CREATE OR REPLACE FUNCTION public.crm_create_offer_execution_v3')));
 const unified=fs.readFileSync('db/proposals/sale-party-unified.sql','utf8');
 await db.exec(unified.slice(0,unified.indexOf('CREATE OR REPLACE FUNCTION public.crm_create_direct_sale_v4')));
 await db.exec('create trigger crm_party_opportunity before update of contract_party on sales_opportunities for each row execute function crm_private.party_opportunity();');
 await db.exec(fs.readFileSync('db/proposals/import-holder-routing.sql','utf8'));
 await db.exec(fs.readFileSync('db/proposals/import-manager-opportunities.sql','utf8'));
 await db.query('insert into records(id,data) values($1,$2),($3,$4),($5,$6)',[H,{NOMBRE:'Titular',APELLIDOS:'Prueba',DNI:'12345678Z','TELÉFONO':'600000001'},M,{NOMBRE:'Gestora',APELLIDOS:'Prueba','TELÉFONO':'600000002',TPF_RELACIONES:{managed_contacts:[{record_id:H}]}},X,{NOMBRE:'Otro',DNI:'87654321X'}]);
 await db.query("insert into sales_opportunities(id,pipeline_id,record_id,title,client_name,phone,amount,expected_date,contract_party) values($1,$1,$2,'CAMBIO O2','Gestora Prueba','600000002',37.95,'2027-09-18',$3)",[O,M,{same:true,holder_name:'Gestora Prueba',holder_dni:'',contact_name:'Gestora Prueba',contact_phone:'600000002',recipient_name:'Gestora Prueba',recipient_phone:'600000002'}]);
 await db.query("insert into crm_sales_import_rows values($1,'8554:synthetic',$2,null,null)",[R,{dni:'12345678Z',operator:'O2',orderline:'synthetic',shop:'8554',activation_date:'2026-09-05',cancelled:'No'}]);
 const get=async()=>(await db.query('select * from sales_opportunities where id=$1',[O])).rows[0];
 const stamp=(await get()).updated_at;
 const call=async({confirm=true,expected=stamp,holder=H,manager=M,recipient=M}={})=>(await db.query('select crm_import_installed_sale_v3($1,$2,$3,null,$4,$5,$6,$7) v',[R,holder,O,manager,recipient,confirm,expected])).rows[0].v;
 const before=await get();
 await assert.rejects(()=>db.query('select crm_import_installed_sale_v2($1,$2,$3)',[R,H,O]),/no corresponde/);
 await assert.rejects(()=>call({confirm:false}),/no corresponde/);
 await assert.rejects(()=>call({expected:null}),/ha cambiado/);
 await assert.rejects(()=>call({expected:'2000-01-01'}),/ha cambiado/);
 await assert.rejects(()=>call({manager:X}),/no pertenece/);
 await assert.rejects(()=>call({recipient:X}),/Destinatario no válido/);
 await assert.rejects(()=>call({recipient:null}),/Selecciona el destinatario/);
 await db.query("update records set data=jsonb_set(data,'{TPF_RELACIONES}','{}') where id=$1",[M]);
 await assert.rejects(()=>call(),/ya no está vinculado/);
 await db.query("update records set data=jsonb_set(data,'{TPF_RELACIONES}',$2) where id=$1",[M,{managed_contacts:[{record_id:H}]}]);
 for(const [key,value,pattern] of [['dni','87654321X',/DNI del Excel/],['operator','Vodafone',/operador no coincide/],['activation_date','2099-01-01',/Fecha de activación/]]){
  const original=(await db.query('select payload from crm_sales_import_rows where id=$1',[R])).rows[0].payload;
  await db.query('update crm_sales_import_rows set payload=$2 where id=$1',[R,{...original,[key]:value}]);
  await assert.rejects(()=>call(),pattern);
  assert.deepEqual(await get(),before,'failed import rolls back the identity correction');
  await db.query('update crm_sales_import_rows set payload=$2 where id=$1',[R,original]);
 }
 await db.query('insert into records(id,data) values($1,$2)',['10000000-0000-0000-0000-000000000004',{DNI:'12345678Z'}]);
 await assert.rejects(()=>call(),/DNI compartido/);
 await db.query('delete from records where id=$1',['10000000-0000-0000-0000-000000000004']);
 // A saved different holder is never inferred from a manager relationship.
 await db.query('update sales_opportunities set contract_party=$2 where id=$1',[O,{same:false,holder_name:'Otro',holder_dni:'87654321X',contact_name:'Gestora Prueba',contact_phone:'600000002'}]);
 await assert.rejects(()=>call(),/titular definido/);
 await db.query('update sales_opportunities set contract_party=$2 where id=$1',[O,before.contract_party]);
 // RLS remains enforced even when the caller is an administrator.
 await db.exec("grant usage on schema auth,crm_private to authenticated;grant select,update on sales_opportunities,records,crm_sales_import_rows to authenticated;grant select on sales_stages to authenticated;alter table sales_opportunities enable row level security;set role authenticated;");
 await assert.rejects(()=>call(),/Oportunidad no disponible/);
 await db.exec('reset role;alter table sales_opportunities disable row level security;');
 await db.exec("select set_config('test.admin','false',false)");await assert.rejects(()=>call(),/Solo administración/);
 await db.exec("select set_config('test.admin','true',false);select set_config('request.jwt.claim.sub','',false)");await assert.rejects(()=>call(),/Solo administración/);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[H]);
 const result=await call(),saved=await get();assert.equal(result.id,O);assert.equal(saved.record_id,H);assert.equal(Number(saved.amount),37.95);assert.equal(new Date(saved.expected_date).toISOString().slice(0,10),'2027-09-18');assert.equal(saved.phone,'600000002');
 assert.equal(saved.contract_party.holder_record_id,H);assert.equal(saved.contract_party.manager_record_id,M);assert.equal(saved.contract_party.recipient_contact_id,M);assert.equal(saved.contract_party.holder_dni,'12345678Z');assert.equal(saved.import_reference,'8554:synthetic');assert.equal(saved.status,'won');
 assert.equal((await db.query('select count(*)::int n from sales_opportunities')).rows[0].n,1,'existing opportunity is reused');
 assert.equal((await call()).already_imported,true,'repeat imports are idempotent');
 assert.equal((await db.query("select prosecdef from pg_proc where proname='crm_import_installed_sale_v3'")).rows[0].prosecdef,false);
 assert.equal((await db.query("select has_function_privilege('anon','public.crm_import_installed_sale_v3(uuid,uuid,uuid,numeric,uuid,uuid,boolean,timestamptz)','execute') allowed")).rows[0].allowed,false);
 await db.close();console.log('import-manager-opportunities-db: explicit routing, no duplicate, preserved forecast/price, rollback, stale writes, RLS and permissions passed');
}
main().catch(error=>{console.error(error);process.exit(1)});
