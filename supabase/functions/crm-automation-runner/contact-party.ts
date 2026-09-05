// Keep CRM identity separate from the recipient frozen in the job context.
// No change for legacy jobs without explicit contact/holder metadata.
export function businessContext(ctx:any){
  if(!ctx?.contract_party)return ctx;
  const p=ctx.contract_party;
  return {...ctx,name:p.contact_name??ctx.name,phone:p.contact_phone??ctx.phone,dni:p.contact_dni??ctx.dni};
}
