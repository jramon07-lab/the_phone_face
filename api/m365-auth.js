const crypto=require('crypto');
const b64url=b=>b.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
module.exports=async function handler(req,res){
  const clientId=String(process.env.M365_CLIENT_ID||'').trim();
  const tenant=String(process.env.M365_TENANT_ID||'common').trim()||'common';
  if(!clientId){
    res.status(503).setHeader('Content-Type','text/html; charset=utf-8');
    return res.end('<!doctype html><html lang="es"><meta charset="utf-8"><title>Microsoft 365</title><body style="font-family:system-ui;padding:40px;max-width:720px;margin:auto"><h2>Microsoft 365 preparado</h2><p>Falta configurar M365_CLIENT_ID en Vercel.</p><button onclick="history.back()">← Volver al CRM</button></body></html>');
  }
  const host=String(req.headers['x-forwarded-host']||req.headers.host||'').split(',')[0].trim();
  const proto=String(req.headers['x-forwarded-proto']||'https').split(',')[0].trim();
  const origin=`${proto}://${host}`;
  const redirectUri=`${origin}/api/m365-callback`;
  const state=crypto.randomBytes(20).toString('hex');
  const verifier=b64url(crypto.randomBytes(48));
  const challenge=b64url(crypto.createHash('sha256').update(verifier).digest());
  const returnTo=String(req.query?.returnTo||'/').startsWith('/')?String(req.query?.returnTo||'/'):'/';
  const scope='openid profile email offline_access User.Read Mail.Read Mail.ReadWrite Mail.Send';
  const auth=new URL(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize`);
  auth.searchParams.set('client_id',clientId);
  auth.searchParams.set('response_type','code');
  auth.searchParams.set('redirect_uri',redirectUri);
  auth.searchParams.set('response_mode','query');
  auth.searchParams.set('scope',scope);
  auth.searchParams.set('state',state);
  auth.searchParams.set('code_challenge',challenge);
  auth.searchParams.set('code_challenge_method','S256');
  const cookies=[
    `tpf_m365_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    `tpf_m365_verifier=${verifier}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    `tpf_m365_return=${encodeURIComponent(returnTo)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
  ];
  res.setHeader('Set-Cookie',cookies);
  res.redirect(302,auth.toString());
};