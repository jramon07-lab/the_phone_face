export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET'&&req.method!=='POST')return res.status(405).json({ok:false,error:'Método no permitido'});
  const id=process.env.GREEN_API_INSTANCE_ID||process.env.GREEN_API_ID_INSTANCE||process.env.GREEN_API_IDINSTANCE||'';
  const token=process.env.GREEN_API_TOKEN||process.env.GREEN_API_API_TOKEN||process.env.GREEN_API_TOKEN_INSTANCE||'';
  const base=String(process.env.GREEN_API_API_URL||'https://7107.api.greenapi.com').replace(/\/$/,'');
  if(!id||!token)return res.status(500).json({ok:false,error:'GREEN-API no configurado'});
  try{
    const settingsUrl=`${base}/waInstance${id}/getSettings/${token}`;
    const currentResp=await fetch(settingsUrl);
    const current=await currentResp.json().catch(()=>null);
    if(!currentResp.ok)throw new Error(current?.message||current?.error||`getSettings HTTP ${currentResp.status}`);
    if(String(current?.outgoingWebhook||'').toLowerCase()==='yes'){
      return res.status(200).json({ok:true,changed:false,outgoingWebhook:'yes'});
    }
    const setResp=await fetch(`${base}/waInstance${id}/setSettings/${token}`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({outgoingWebhook:'yes'})
    });
    const saved=await setResp.json().catch(()=>null);
    if(!setResp.ok)throw new Error(saved?.message||saved?.error||`setSettings HTTP ${setResp.status}`);
    return res.status(200).json({ok:true,changed:true,outgoingWebhook:'yes',saved});
  }catch(e){
    return res.status(500).json({ok:false,error:e?.message||'No se pudo activar outgoingWebhook'});
  }
}
