(function(){
  'use strict';
  const params=new URLSearchParams(location.search),contactId=String(params.get('contact')||'').trim();
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(contactId))return;
  let opening=false,finished=false,attempts=0;
  function clearParam(){
    const clean=new URL(location.href);clean.searchParams.delete('contact');
    history.replaceState(history.state,'',clean.pathname+clean.search+clean.hash);
  }
  async function tryOpen(){
    if(finished||opening||attempts++>600)return;
    if(typeof window.openContact!=='function'||!window.sb?.auth?.getSession)return setTimeout(tryOpen,500);
    opening=true;
    try{
      const result=await window.sb.auth.getSession();
      if(!result?.data?.session)return;
      await window.openContact(contactId);
      finished=true;clearParam();
    }catch(error){console.warn('No se pudo abrir todavía la ficha enlazada',error)}
    finally{opening=false;if(!finished)setTimeout(tryOpen,500)}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tryOpen,{once:true});else tryOpen();
})();
