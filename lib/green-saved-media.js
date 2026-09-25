'use strict';
// Only use provider media stored for this exact chat/message after CRM authorization.
async function savedMedia(chatId,idMessage,instance,fetcher=fetch){
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!key)return null;
 const base=String(process.env.SUPABASE_URL||'https://overfzbjtpjqxzbujezg.supabase.co').replace(/\/$/,'');
 try{
  const q=new URLSearchParams({select:'raw',chat_id:'eq.'+chatId,id_message:'eq.'+idMessage,limit:'1'});
  const r=await fetcher(base+'/rest/v1/wa_messages?'+q,{headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(5000)});
  if(!r.ok)return null;const rows=await r.json(),raw=rows?.[0]?.raw;
  const value=raw?.messageData?.fileMessageData?.downloadUrl||raw?.downloadUrl;
  if(!value)return null;const u=new URL(value);
  const allowed=/^do-media-\d+\.[a-z0-9-]+\.digitaloceanspaces\.com$/.test(u.hostname)||u.hostname==='sw-media.storage.yandexcloud.net';
  if(u.protocol!=='https:'||u.username||u.password||u.port||!allowed||!u.pathname.startsWith('/'+instance+'/'))return null;
  const file=await fetcher(u.href,{redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!file.ok||/text\/html|application\/json/i.test(file.headers.get('content-type')||''))return null;
  return file;
 }catch(_){return null;}
}
module.exports={savedMedia};
