(function(){
'use strict';
const M=window.TPFModules;if(!M)return;
const MIN_HEIGHT=42,MAX_HEIGHT=144;
function composer(){return document.getElementById('waComposerText')}
function resize(keepCaret=false){
  const input=composer();if(!input)return;
  input.style.height='auto';
  const height=Math.max(MIN_HEIGHT,Math.min(MAX_HEIGHT,input.scrollHeight));
  input.style.height=`${height}px`;
  input.style.overflowY=input.scrollHeight>MAX_HEIGHT?'auto':'hidden';
  if(keepCaret&&input.scrollHeight>MAX_HEIGHT)input.scrollTop=input.scrollHeight;
}
function schedule(keepCaret=false){requestAnimationFrame(()=>resize(keepCaret))}
function install(){
  if(!document.getElementById('tpfWaComposerAutogrowCss')){
    const style=document.createElement('style');style.id='tpfWaComposerAutogrowCss';style.textContent=`
      #view-whatsapplive,#view-whatsapplive .waLivePage{box-sizing:border-box!important;min-height:0!important;overflow:hidden!important}
      #view-whatsapplive .waLiveLayout{flex:1 1 auto!important;min-height:0!important}
      #view-whatsapplive .waChatPane,#view-whatsapplive .waChatActive,#view-whatsapplive .waMessages{min-height:0!important}
      #view-whatsapplive .waComposer{align-items:flex-end!important;flex:0 0 auto!important;margin-bottom:0!important;padding-bottom:10px!important}
      #view-whatsapplive .waComposerTextWrap textarea{display:block!important;width:100%!important;height:42px;min-height:42px!important;max-height:144px!important;line-height:20px!important;overflow-y:hidden;resize:none!important;transition:height .1s ease}
      #view-whatsapplive .waComposerMsg{flex:0 0 18px!important;min-height:18px!important}
    `;document.head.appendChild(style);
  }
  const input=composer();if(input&&!input.dataset.tpfAutogrow){input.dataset.tpfAutogrow='1';input.addEventListener('input',()=>schedule(true));input.addEventListener('paste',()=>setTimeout(()=>resize(true),0));resize()}
  document.addEventListener('click',e=>{if(e.target.closest?.('#waComposerSend,[data-use],[data-template-use],.waSlashItem')){setTimeout(()=>resize(true),0);[350,1200,2500].forEach(delay=>setTimeout(()=>resize(),delay))}});
  document.addEventListener('keydown',e=>{if(e.target?.id==='waComposerText'&&e.key==='Enter'&&!e.shiftKey)[350,1200,2500].forEach(delay=>setTimeout(()=>resize(),delay))});
  addEventListener('resize',()=>schedule());
}
window.tpfResizeWhatsAppComposer=resize;
M.register('whatsapp-composer-autogrow',{install});
})();
