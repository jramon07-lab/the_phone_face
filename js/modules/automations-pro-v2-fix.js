(function(){
'use strict';
const M=window.TPFModules;if(!M)return;
function patchDetail(){
  document.querySelectorAll('#tpfProExecDetail .apStep').forEach(step=>{
    const badge=step.querySelector('.apStatus');
    if(!badge)return;
    if(step.querySelector('.apStepError')){
      badge.className='apStatus err';
      badge.textContent='Fallida';
    }
  });
}
function install(){
  document.addEventListener('click',e=>{
    if(e.target?.closest?.('[data-ap-exec]'))setTimeout(patchDetail,30);
  },true);
}
M.register('automations-pro-v2-fix',{install});
})();