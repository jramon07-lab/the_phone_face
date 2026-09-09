'use strict';
// Validate the CRM session and current permission on every protected request.
// Vercel access and browser UI visibility are not CRM authorization.
async function authorize(req,res,permission='can_use_whatsapp'){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Vary','Authorization');
 const reject=(status,error)=>{res.status(status).json({ok:false,error});return false};
 const match=/^Bearer\s+(\S{1,8192})$/i.exec(String(req.headers?.authorization||'').trim());
 if(!match)return reject(401,'Inicia sesión en el CRM.');
 const base=String(process.env.SUPABASE_URL||'https://overfzbjtpjqxzbujezg.supabase.co').replace(/\/$/,'');
 const key=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY||'sb_publishable_o6_eM5v04EBInhfiSnyFLA_5yRHlB4j';
 try{
  const response=await fetch(base+'/rest/v1/rpc/current_user_permissions',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+match[1],'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(8000)});
  if(response.status===401||response.status===403)return reject(401,'La sesión ha caducado. Vuelve a entrar.');
  if(!response.ok)return reject(503,'No se pudo comprobar la sesión. Inténtalo de nuevo.');
  const result=await response.json(),p=Array.isArray(result)?result[0]:result;
  if(!p?.user_id||!(p.is_admin===true||p[permission]===true))return reject(403,'No tienes permiso para esta operación.');
  return true;
 }catch(_){return reject(503,'No se pudo comprobar la sesión. Inténtalo de nuevo.');}
}
module.exports={authorize};
