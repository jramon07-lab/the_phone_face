export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="POST")return res.status(405).json({ok:false,error:"Método no permitido."});
  const id=process.env.GREEN_API_INSTANCE_ID||process.env.GREEN_API_ID_INSTANCE||process.env.GREEN_API_IDINSTANCE||"";
  const token=process.env.GREEN_API_TOKEN||process.env.GREEN_API_API_TOKEN||process.env.GREEN_API_TOKEN_INSTANCE||"";
  const base=String(process.env.GREEN_API_API_URL||"https://7107.api.greenapi.com").replace(/\/$/,"");
  if(!id||!token)return res.status(500).json({ok:false,error:"GREEN-API no está disponible."});
  try{
    const body=typeof req.body==="string"?JSON.parse(req.body||"{}"):req.body||{};
    const raw=String(body.chatId||"").trim();
    const chatId=raw.includes("@")?raw:(raw.replace(/\D/g,"")?`${raw.replace(/\D/g,"")}@c.us`:"");
    const message=String(body.message||"").trim();
    const quotedMessageId=String(body.quotedMessageId||"").trim();
    if(!chatId||!message||!quotedMessageId)return res.status(400).json({ok:false,error:"Faltan chatId, message o quotedMessageId."});
    const r=await fetch(`${base}/waInstance${id}/sendMessage/${token}`,{
      method:"POST",
      headers:{"Content-Type":"application/json; charset=utf-8"},
      body:JSON.stringify({chatId,message,quotedMessageId})
    });
    const text=await r.text();
    let data;try{data=text?JSON.parse(text):null}catch{data=text}
    if(!r.ok)return res.status(r.status).json({ok:false,error:data?.message||data?.error||String(data||r.statusText)});
    return res.status(200).json({ok:true,chatId,idMessage:data?.idMessage||null,data});
  }catch(e){
    console.error("GREEN_REPLY_ERROR",e?.message||e);
    return res.status(502).json({ok:false,error:e?.message||String(e)});
  }
}
