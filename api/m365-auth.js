const crypto=require('crypto');
module.exports=async function handler(req,res){
  const clientId=String(process.env.M365_CLIENT_ID||'').trim();
  const tenant=String(process.env.M365_TENANT_ID||'common').trim()||'common';
  const base=String(process.env.M365_REDIRECT_URI||'').trim();
  if(!clientId||!base){
    res.status(503).setHeader('Content-Type','text/html; charset=utf-8');
    return res.end('<!doctype html><html lang="es"><meta charset="utf-8"><title>Microsoft 365</title><body style="font-family:system-ui;padding:40px;max-width:720px;margin:auto"><h2>Microsoft 365 preparado</h2><p>El módulo de correo ya está instalado. Falta registrar la aplicación de The Phone Face en Microsoft 365 y añadir <b>M365_CLIENT_ID</b> y <b>M365_REDIRECT_URI</b> en Vercel para poder iniciar sesión de forma segura.</p><p>No se ha pedido ni guardado ninguna contraseña.</p><button onclick="history.back()">← Volver al CRM</button></body></html>');
  }
  const state=crypto.randomBytes(20).toString('hex');
  const scope='openid profile offline_access User.Read Mail.Read Mail.Send';
  const auth=new URL(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize`);
  auth.searchParams.set('client_id',clientId);
  auth.searchParams.set('response_type','code');
  auth.searchParams.set('redirect_uri',base);
  auth.searchParams.set('response_mode','query');
  auth.searchParams.set('scope',scope);
  auth.searchParams.set('state',state);
  res.setHeader('Set-Cookie',`tpf_m365_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  res.redirect(302,auth.toString());
};