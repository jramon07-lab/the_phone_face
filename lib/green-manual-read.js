// Only a successfully accepted manual reply may disclose reading to WhatsApp.
module.exports = async function markManualReplyRead({ manualReply, data, chatId, base, id, token }) {
  if (manualReply !== true || !data?.idMessage) return { setRead: false };
  // Server-only receipt: automatic messages never create this activity window.
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(key)try{
    const url=String(process.env.SUPABASE_URL||'https://overfzbjtpjqxzbujezg.supabase.co').replace(/\/$/,'');
    const r=await fetch(url+'/rest/v1/crm_whatsapp_manual_activity?on_conflict=chat_id',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({chat_id:chatId,last_sent_at:new Date().toISOString(),outgoing_id:String(data.idMessage)}),signal:AbortSignal.timeout(5000)});
    if(!r.ok)console.warn('Manual activity receipt was not saved');
  }catch(_){console.warn('Manual activity receipt unavailable');}
  try {
    const r = await fetch(`${base}/waInstance${id}/readChat/${token}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId }), signal: AbortSignal.timeout(5000)
    });
    const result = await r.json().catch(() => ({}));
    return { setRead: r.ok && result.setRead === true };
  } catch (_) {
    // The reply was already sent. Never turn a receipt failure into a send retry.
    return { setRead: false };
  }
};
