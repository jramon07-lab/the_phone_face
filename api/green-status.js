export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'Método no permitido'});
  const id=process.env.GREEN_API_INSTANCE_ID||process.env.GREEN_API_ID_INSTANCE||process.env.GREEN_API_IDINSTANCE||'';
  const token=process.env.GREEN_API_TOKEN||process.env.GREEN_API_API_TOKEN||process.env.GREEN_API_TOKEN_INSTANCE||'';
  const base=String(process.env.GREEN_API_API_URL||'https://7107.api.greenapi.com').replace(/\/$/,'');
  if(!id||!token)return res.status(500).json({ok:false,error:'GREEN-API no configurado'});
  try{
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    const idMessage=String(body.idMessage||'').trim();
    if(!idMessage)return res.status(400).json({ok:false,error:'Falta idMessage'});
    const r=await fetch(`${base}/waInstance${id}/getMessageStatus/${token}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idMessage})});
    const data=await r.json().catch(()=>null);
    if(!r.ok)return res.status(200).json({ok:true,status:'',degraded:true});
    const status=String(data?.status||data?.statusMessage||'');
    return res.status(200).json({ok:true,status});
  }catch(e){return res.status(200).json({ok:true,status:'',degraded:true});}
}
