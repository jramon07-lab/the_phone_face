/* Shared rendering rules, checked against the server runner by regression tests. */
(function(){'use strict';
function contactVar(ctx,key){const data=ctx?.contact_data&&typeof ctx.contact_data==="object"?ctx.contact_data:{};const wanted=String(key||"").trim().toLowerCase();for(const [k,v] of Object.entries(data)){if(String(k).trim().toLowerCase()===wanted)return String(v??"");}return "";}
function firstName(ctx){
  const explicit=String(ctx?.contract_party?.recipient_first_name||ctx?.recipient_first_name||"").trim();if(explicit)return explicit;
  const party=ctx?.contract_party;
  if(party?.recipient==="holder")return String(party.holder_first_name||"").trim()||String(party.recipient_name||ctx?.name||"").trim().split(/\s+/)[0]||"cliente";
  // A separate manager must never inherit the customer's first name.
  if(ctx?.recipient_contact_id&&ctx.recipient_contact_id!==ctx.contact_id)return String(ctx?.name||"").trim().split(/\s+/)[0]||"cliente";
  return String(ctx?.contact_data?.NOMBRE||"").trim()||String(ctx?.name||"").trim().split(/\s+/)[0]||"cliente";
}
function vars(text,ctx){return String(text||"")
  .replaceAll("{{contacto.nombre}}",String(ctx?.name||""))
  .replaceAll("{{contacto.telefono}}",String(ctx?.phone||""))
  .replace(/\{\{contacto\.([^}]+)\}\}/gi,(_m,k)=>contactVar(ctx,k))
  .replace(/\{contacto\.([^}]+)\}/gi,(_m,k)=>contactVar(ctx,k))
  .replaceAll("{nombre}",String(ctx?.name||""))
  .replaceAll("{nombre_seguimiento}",firstName(ctx))
  .replaceAll("{dni}",String(ctx?.dni||""))
  .replaceAll("{telefono}",String(ctx?.phone||""))
  .replaceAll("{oferta_mensaje}",String(ctx?.oferta_mensaje||""))
  .replaceAll("{operador}",String(ctx?.operator||""))
  .replaceAll("{precio_total}",String(ctx?.precio_total||""))
  .replaceAll("{mensaje}",String(ctx?.message||""));}
function contractMessage(text,party){
 const body=String(text||'');if(!body.trim()||!party)return body;
 const holder=String(party.holder_name||'').replace(/\s+/g,' ').trim();
 const different=party.holder_record_id&&party.recipient_contact_id?party.holder_record_id!==party.recipient_contact_id:party.same===false&&party.recipient==='contact';
 if(!different||!holder)return body;
 const reference='Sobre el contrato de '+holder+'.';
 if(body.includes(reference))return body;
 const firstBreak=body.indexOf('\n');
 return /^Hola\b/i.test(body)&&firstBreak>=0?body.slice(0,firstBreak)+'\n'+reference+body.slice(firstBreak):reference+'\n\n'+body;
}
function outgoingVars(text,ctx,phase=""){
  const name=firstName(ctx),welcome=ctx?.offer_welcome===true||(!Object.hasOwn(ctx||{},"offer_welcome")&&String(ctx?.oferta_mensaje||"").includes("Te envío una oferta que puede interesarte:"));
  let source=String(text||"");
  if(welcome&&["reminder_2","reminder_5"].includes(phase))source=source.replace(/\s+de\s+\{operador\}/gi,"").replaceAll("{operador}","");
  source=source.replace(/\{\{contacto\.nombre\}\}|\{\{contacto\.nombre_completo\}\}|\{nombre_completo\}|\{contacto\.nombre\}/gi,name);
  const offerMessage=String(ctx?.oferta_mensaje||"").replace(/^Hola [^,\n]+/,"Hola "+name);
  return contractMessage(vars(source,{...ctx,name,recipient_first_name:name,contact_data:{...(ctx?.contact_data||{}),NOMBRE:name},oferta_mensaje:offerMessage}),ctx?.contract_party);
}

window.TPFMessagePreview={outgoingVars};})();
