const statusCache = new Map();
const statusInFlight = new Map();
const statusBackoff = new Map();
const FRESH_MS = 60000;
const STALE_MS = 600000;

function prune() {
  if (statusCache.size <= 300) return;
  [...statusCache.entries()].sort((a, b) => Number(a[1]?.at || 0) - Number(b[1]?.at || 0)).slice(0, 75).forEach(([key]) => statusCache.delete(key));
}

export default async function handler(req,res){
  if(!await require('../lib/crm-api-auth').authorize(req,res,'can_use_whatsapp'))return;
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'Método no permitido'});
  const id=process.env.GREEN_API_INSTANCE_ID||process.env.GREEN_API_ID_INSTANCE||process.env.GREEN_API_IDINSTANCE||'';
  const token=process.env.GREEN_API_TOKEN||process.env.GREEN_API_API_TOKEN||process.env.GREEN_API_TOKEN_INSTANCE||'';
  const base=String(process.env.GREEN_API_API_URL||'https://7107.api.greenapi.com').replace(/\/$/,'');
  if(!id||!token)return res.status(500).json({ok:false,error:'GREEN-API no configurado'});

  let body;
  try{body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});}catch{return res.status(400).json({ok:false,error:'Petición no válida'});}
  const idMessage=String(body.idMessage||'').trim();
  if(!idMessage)return res.status(400).json({ok:false,error:'Falta idMessage'});

  const now=Date.now(),cached=statusCache.get(idMessage),age=cached?now-cached.at:Infinity;
  if(cached&&age<FRESH_MS)return res.status(200).json({ok:true,status:cached.status,cached:true});
  if(now<Number(statusBackoff.get(idMessage)||0))return res.status(200).json({ok:true,status:cached?.status||'',cached:Boolean(cached),degraded:true});

  let task=statusInFlight.get(idMessage);
  if(!task){
    task=(async()=>{
      try{
        const r=await fetch(`${base}/waInstance${id}/getMessageStatus/${token}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idMessage})});
        const data=await r.json().catch(()=>null);
        if(!r.ok){if(r.status===429)statusBackoff.set(idMessage,Date.now()+60000);return{status:cached?.status||'',degraded:true,providerStatus:r.status};}
        const status=String(data?.status||data?.statusMessage||'');
        statusCache.set(idMessage,{at:Date.now(),status});statusBackoff.delete(idMessage);prune();
        return{status};
      }catch(_){return{status:cached&&age<STALE_MS?cached.status:'',degraded:true};}
      finally{statusInFlight.delete(idMessage);}
    })();
    statusInFlight.set(idMessage,task);
  }
  const result=await task;
  return res.status(200).json({ok:true,...result});
}
