export default async function handler(req,res){
  if(!await require('../lib/crm-api-auth').authorize(req,res,'can_use_whatsapp'))return;
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'Método no permitido'});
  // Reading in the CRM is private, including calls from older open tabs.
  return res.status(200).json({ok:true,setRead:false,localOnly:true});
}
