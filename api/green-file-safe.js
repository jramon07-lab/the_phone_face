export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST') return res.status(405).json({ok:false,error:'Método no permitido'});

  const id=process.env.GREEN_API_INSTANCE_ID||process.env.GREEN_API_ID_INSTANCE||process.env.GREEN_API_IDINSTANCE||'';
  const token=process.env.GREEN_API_TOKEN||process.env.GREEN_API_API_TOKEN||process.env.GREEN_API_TOKEN_INSTANCE||'';
  const base=String(process.env.GREEN_API_API_URL||'https://7107.api.greenapi.com').replace(/\/$/,'');
  if(!id||!token) return res.status(200).json({ok:true,available:false,degraded:true,reason:'provider_not_configured'});

  const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
  const raw=String(body.chatId||'').trim();
  const chatId=raw.includes('@')?raw:(raw.replace(/\D/g,'')?`${raw.replace(/\D/g,'')}@c.us`:raw);
  const idMessage=String(body.idMessage||'').trim();
  if(!chatId||!idMessage) return res.status(200).json({ok:true,available:false,degraded:true,reason:'invalid_request'});

  try{
    const r=await fetch(`${base}/waInstance${id}/downloadFile/${token}`,{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chatId,idMessage})
    });
    const text=await r.text();
    let data; try{data=text?JSON.parse(text):null}catch{data=text}
    if(!r.ok){
      const msg=typeof data==='object'&&data?(data.message||data.error||JSON.stringify(data)):String(data||r.statusText||'');
      if(r.status===400 && /encrypted url not found|file message/i.test(msg)){
        return res.status(200).json({ok:true,available:false,degraded:true,reason:'file_unavailable'});
      }
      if(r.status===404||r.status===429){
        return res.status(200).json({ok:true,available:false,degraded:true,reason:'provider_unavailable',providerStatus:r.status});
      }
      return res.status(200).json({ok:true,available:false,degraded:true,reason:'provider_error',providerStatus:r.status});
    }
    const downloadUrl=String(data?.downloadUrl||'').trim();
    return res.status(200).json({ok:true,available:Boolean(downloadUrl),downloadUrl});
  }catch(_){
    return res.status(200).json({ok:true,available:false,degraded:true,reason:'network_error'});
  }
}
