'use strict';
// No secret values, page contents or contact information in diagnostics.
const stable='https://the-phone-face-app-whatsapp-fotos-y.vercel.app';
(async()=>{
 const configured=new URL(process.env.CONFIGURED_BASE_URL);
 const expected=new URL(stable);
 const sameOrigin=configured.origin===expected.origin;
 const response=await fetch(configured,{headers:{'x-vercel-protection-bypass':process.env.VERCEL_AUTOMATION_BYPASS_SECRET},signal:AbortSignal.timeout(20000)});
 const html=await response.text();
 console.log('NIGHTLY_TARGET_CHECK',JSON.stringify({sameStableOrigin:sameOrigin,pathIsRoot:configured.pathname==='/',status:response.status,redirected:response.redirected,hasLogin:html.includes('id="email"'),hasCurrentSyncModule:html.includes('whatsapp-performance-max')}));
 if(!response.ok||!html.includes('id="email"'))throw Error('El destino nocturno no devuelve el acceso al CRM');
})();
