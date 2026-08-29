const CALLBACK_ORIGIN='https://the-phone-face-app-whatsapp-git-b37a28-jramon-07-2402s-projects.vercel.app';
const CALLBACK_URI=CALLBACK_ORIGIN+'/api/m365-callback';
function cookies(req){const out={};String(req.headers.cookie||'').split(';').forEach(p=>{const i=p.indexOf('=');if(i>0)out[p.slice(0,i).trim()]=decodeURIComponent(p.slice(i+1).trim())});return out}
function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function safeReturnTo(v){const s=String(v||'').trim();if(s.startsWith('/'))return CALLBACK_ORIGIN+s;try{const u=new URL(s);if(u.protocol==='https:'&&u.hostname.endsWith('.vercel.app'))return u.toString()}catch(_){}return CALLBACK_ORIGIN+'/'}
module.exports=async function handler(req,res){
  const clientId=String(process.env.M365_CLIENT_ID||'').trim();
  const clientSecret=String(process.env.M365_CLIENT_SECRET||'').trim();
  const tenant=String(process.env.M365_TENANT_ID||'common').trim()||'common';
  const c=cookies(req);
  const state=String(req.query?.state||'');
  const code=String(req.query?.code||'');
  const err=String(req.query?.error_description||req.query?.error||'');
  const returnTo=safeReturnTo(c.tpf_m365_return||CALLBACK_ORIGIN+'/');
  const clear=[
    'tpf_m365_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    'tpf_m365_verifier=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    'tpf_m365_return=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
  ];
  if(err){res.status(400).setHeader('Content-Type','text/html; charset=utf-8');return res.end(`<h2>Microsoft 365 no conectado</h2><p>${esc(err)}</p><p><a href="${esc(returnTo)}">Volver al CRM</a></p>`)}
  if(!code||!state||!c.tpf_m365_state||state!==c.tpf_m365_state){res.status(400).setHeader('Content-Type','text/html; charset=utf-8');return res.end('<h2>Microsoft 365</h2><p>La respuesta de seguridad no es válida o ha caducado. Vuelve al CRM e inténtalo otra vez.</p>')}
  const body=new URLSearchParams({client_id:clientId,grant_type:'authorization_code',code,redirect_uri:CALLBACK_URI,scope:'openid profile email offline_access User.Read Mail.Read Mail.ReadWrite Mail.Send'});
  if(c.tpf_m365_verifier)body.set('code_verifier',c.tpf_m365_verifier);
  if(clientSecret)body.set('client_secret',clientSecret);
  let token;
  try{
    const r=await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
    token=await r.json();
    if(!r.ok||!token.access_token)throw new Error(token.error_description||token.error||'No se pudo obtener el token');
  }catch(e){
    res.status(502).setHeader('Content-Type','text/html; charset=utf-8');
    return res.end(`<html lang="es"><meta charset="utf-8"><body style="font-family:system-ui;padding:40px;max-width:720px;margin:auto"><h2>Microsoft 365: falta un último ajuste</h2><p>${esc(e.message)}</p><p>Si Microsoft indica que falta <b>client_secret</b>, crea un secreto de cliente en Microsoft Entra y añádelo en Vercel como <b>M365_CLIENT_SECRET</b>.</p><p><a href="${esc(returnTo)}">← Volver al CRM</a></p></body></html>`)
  }
  let me={};
  try{const r=await fetch('https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName',{headers:{authorization:`Bearer ${token.access_token}`}});if(r.ok)me=await r.json()}catch(_){}
  res.setHeader('Set-Cookie',clear.concat([
    `tpf_m365_access=${encodeURIComponent(token.access_token)}; Path=/api/m365; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.max(60,Number(token.expires_in||3600)-60)}`,
    token.refresh_token?`tpf_m365_refresh=${encodeURIComponent(token.refresh_token)}; Path=/api/m365; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`:''
  ].filter(Boolean)));
  const target=returnTo+(returnTo.includes('?')?'&':'?')+'m365=connected';
  res.status(200).setHeader('Content-Type','text/html; charset=utf-8');
  res.end(`<html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;padding:40px;max-width:720px;margin:auto"><h2>Microsoft 365 conectado ✓</h2><p>${esc(me.displayName||me.mail||me.userPrincipalName||'Cuenta conectada')}</p><p>La conexión se ha realizado correctamente.</p><p><a href="${esc(target)}">Volver al CRM</a></p><script>setTimeout(()=>location.href=${JSON.stringify(target)},1200)</script></body></html>`)
};