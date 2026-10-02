(function(){
 'use strict';
 const attempts=new WeakMap(),reported=new Map();
 function live(){try{return typeof waLiveState!=='undefined'?waLiveState:window.waLiveState;}catch(_){return null;}}
 function isMedia(target){return !!target?.matches?.('#waMessages [data-wa-media-message]');}
 async function recover(target){
  if(!isMedia(target))return;
  const state=live(),chatId=state?.selected?.id,idMessage=target.dataset.waMediaMessage,selection=state?.selectionVersion;
  if(!chatId||!idMessage)return;
  const key=chatId+'::'+idMessage;
  const current=()=>target.isConnected&&live()?.selected?.id===chatId&&live()?.selectionVersion===selection;
  function unavailable(error){
   if(!current())return;
   target.setAttribute('aria-label','Archivo no disponible. Puedes intentar descargarlo.');
   let notice=target.parentElement?.querySelector('.waMediaRecoveryNotice');
   if(!notice){notice=document.createElement('small');notice.className='waMediaRecoveryNotice';notice.textContent='Archivo no disponible. Puedes intentar descargarlo.';target.after(notice);}
   const now=Date.now();
   if(now-(reported.get(key)||0)>=60000){
    if(reported.size>=100)reported.delete(reported.keys().next().value);
    reported.set(key,now);
    window.tpfReportSystemEvent?.({module:'WhatsApp multimedia',severity:'warning',message:'No se pudo recuperar un archivo de WhatsApp',action:'Recuperar archivo de WhatsApp',detail:(error?.message||'El proveedor no devuelve un archivo reproducible.')+' · Mensaje: '+String(idMessage).slice(0,100)});
   }
  }
  const previous=attempts.get(target);
  if(previous){if(previous.phase==='loaded'||previous.phase==='failed')return;if(previous.phase==='loading'){previous.phase='failed';clearTimeout(previous.timer);unavailable();}return;}
  // One renewal per live element; reopening a conversation can try again.
  // WeakMap also releases detached media without retaining customer history.
  const attempt={phase:'fetching',timer:null};attempts.set(target,attempt);
  try{
   // file is a download lookup: it never sends, marks read or consumes receipts.
   const result=await waApi('file',{chatId,idMessage}),url=String(result?.downloadUrl||'').trim();
   if(!current())return;
   if(!/^https:\/\//i.test(url))throw Error(result?.reason==='file_unavailable'?'El archivo ya no está disponible en WhatsApp. Descárgalo desde el móvil o pide que lo reenvíen.':'WhatsApp no devolvió un archivo disponible.');
   attempt.phase='loading';
   const loaded=()=>{if(attempt.phase!=='loading')return;attempt.phase='loaded';clearTimeout(attempt.timer);target.parentElement?.querySelector('.waMediaRecoveryNotice')?.remove();};
   target.addEventListener(target.tagName==='IMG'?'load':'loadedmetadata',loaded,{once:true});
   attempt.timer=setTimeout(()=>{if(attempt.phase==='loading'){attempt.phase='failed';unavailable(Error('El archivo no respondió tras renovar su dirección.'));}},15000);
   const message=(live()?.history||[]).find(x=>String(x.idMessage||'')===idMessage);
   if(message){message.messageData=message.messageData||{};message.messageData.fileMessageData=message.messageData.fileMessageData||{};message.messageData.fileMessageData.downloadUrl=url;}
   if(typeof waMediaCache!=='undefined')waMediaCache.set(key,url);
   target.src=url;
   if(target.tagName==='IMG'&&target.parentElement?.tagName==='A')target.parentElement.href=url;
   target.load?.();
  }catch(error){attempt.phase='failed';unavailable(error);}
 }
 window.TPFWhatsAppMediaRecovery={isMedia};
 window.addEventListener('error',event=>{if(isMedia(event.target))recover(event.target);},true);
})();
