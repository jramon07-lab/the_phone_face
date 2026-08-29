(function(){
'use strict';
const M=window.TPFModules;if(!M)return;
let loading=false,loaded=false;
function showMail(){
  const view=document.getElementById('view-email');
  if(!view)return false;
  document.querySelectorAll('.referenceWorkspace main > section').forEach(s=>s.classList.add('hidden'));
  view.classList.remove('hidden');
  document.querySelectorAll('.referenceNav .nav').forEach(n=>n.classList.remove('active'));
  document.querySelector('.nav[data-view="email"]')?.classList.add('active');
  return true;
}
function loadMail(){
  if(loaded){showMail();return;}
  if(loading)return;
  loading=true;
  const s=document.createElement('script');
  s.src='/js/modules/email-m365.js?v=20260829-isolated1';
  s.async=true;
  s.onload=()=>{loaded=true;loading=false;queueMicrotask(showMail)};
  s.onerror=()=>{loading=false;M.report('email-m365-lazy',new Error('No se pudo cargar Correo'),'script load')};
  document.head.appendChild(s);
}
function installNav(){
  if(document.querySelector('.nav[data-view="email"]'))return true;
  const nav=document.querySelector('.referenceNav');
  if(!nav)return false;
  const el=document.createElement('div');
  el.className='nav secondaryNav';
  el.dataset.view='email';
  el.innerHTML='<b>✉</b><span>Correo</span>';
  const anchor=document.querySelector('.nav[data-view="labels"]');
  nav.insertBefore(el,anchor||null);
  el.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();loadMail()},{passive:false});
  return true;
}
function install(){
  const run=()=>{try{installNav()}catch(e){M.report('email-m365-lazy',e,'nav install')}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});
  else if('requestIdleCallback' in window)requestIdleCallback(run,{timeout:1500});
  else setTimeout(run,0);
}
M.register('email-m365-lazy',{install});
})();