export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST') return res.status(405).json({ok:false,error:'Método no permitido'});

  const id=process.env.GREEN_API_INSTANCE_ID||process.env.GREEN_API_ID_INSTANCE||process.env.GREEN_API_IDINSTANCE||'';
  const token=process.env.GREEN_API_TOKEN||process.env.GREEN_API_API_TOKEN||process.env.GREEN_API_TOKEN_INSTANCE||'';
  const base=String(process.env.GREEN_API_API_URL||'https://7107.api.greenapi.com').replace(/\/$/,'');
  if(!id||!token) return res.status(200).json({ok:true,setRead:false,degraded:true,reason:'not_configured'});

  const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
  const raw=String(body.chatId||'').trim();
  const idMessage=String(body.idMessage||'').trim();
  if(!raw) return res.status(200).json({ok:true,setRead:false,degraded:true,reason:'missing_chat'});

  let chatId=raw;
  if(!chatId.includes('@')){
    const digits=chatId.replace(/\D/g,'');
    chatId=digits?`${digits}@c.us`:'';
  }
  if(!chatId) return res.status(200).json({ok:true,setRead:false,degraded:true,reason:'invalid_chat'});

  const payload={chatId};
  if(idMessage) payload.idMessage=idMessage;

  try{
    const r=await fetch(`${base}/waInstance${id}/readChat/${token}`,{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)
    });
    const text=await r.text();
    let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
    if(r.ok) return res.status(200).json({ok:true,setRead:data?.setRead!==false,data});

    // El marcado como leído es auxiliar. Un rechazo del proveedor no debe
    // generar una cascada de HTTP 400 ni afectar al resto del CRM.
    if(r.status===400||r.status===404||r.status===429){
      return res.status(200).json({ok:true,setRead:false,degraded:true,providerStatus:r.status,reason:'provider_rejected'});
    }
    return res.status(200).json({ok:true,setRead:false,degraded:true,providerStatus:r.status,reason:'provider_error'});
  }catch(_){
    return res.status(200).json({ok:true,setRead:false,degraded:true,reason:'network_error'});
  }
}
