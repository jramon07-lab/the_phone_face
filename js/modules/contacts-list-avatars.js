(function(){
'use strict';
const M=window.TPFModules;if(!M)return;
const cache=new Map(),queued=new Set(),queue=[];let working=false,timer=0;
function normalizedPhone(value){let p=String(value||'').replace(/\D/g,'');if(p.startsWith('00'))p=p.slice(2);if(p.length===9)p='34'+p;return /^[0-9]{10,15}$/.test(p)?p:'';}
function identify(el){
 const holder=el.closest('tr[data-contact-id],article[data-contact-id]');if(!holder)return null;
 const name=holder.querySelector('.tpfContactNameBtn')?.textContent?.trim()||'contacto';
 let raw='';const row=holder.matches('tr')?holder:null;
 if(row)raw=row.children[3]?.textContent||'';
 else{const line=[...holder.querySelectorAll('.tpfContactCardMeta span')].find(x=>/^Teléfono:/i.test(x.textContent||''));raw=(line?.textContent||'').replace(/^Teléfono:\s*/i,'');}
 const phone=normalizedPhone(raw);if(!phone)return null;el.dataset.contactAvatar='';el.dataset.phone=phone;el.dataset.name=name;return phone;
}
function matching(phone){return [...document.querySelectorAll('#tpfContactsApp [data-contact-avatar]')].filter(x=>x.dataset.phone===phone);}
function decorate(el,url){
 if(!el?.isConnected||!url||el.querySelector('img'))return;
 const expected=el.dataset.phone,img=new Image();img.alt='';img.decoding='async';img.referrerPolicy='no-referrer';
 img.onload=()=>{if(!el.isConnected||el.dataset.phone!==expected)return;el.textContent='';el.appendChild(img);el.classList.add('hasPhoto');el.setAttribute('role','button');el.tabIndex=0;el.title='Ampliar foto';el.setAttribute('aria-label','Ampliar foto de '+(el.dataset.name||'contacto'));};
 img.src=url;
}
async function run(){
 if(working)return;working=true;
 while(queue.length){
  const phone=queue.shift();queued.delete(phone);if(!matching(phone).length)continue;
  try{
   if(typeof waLoadAvatar!=='function'||typeof contactCanUseWhatsapp!=='function'||!contactCanUseWhatsapp()){cache.set(phone,'');continue;}
   const url=await waLoadAvatar(phone+'@c.us');cache.set(phone,url||'');if(url)matching(phone).forEach(el=>decorate(el,url));
  }catch(_){cache.set(phone,'');}
  await new Promise(resolve=>setTimeout(resolve,280));
 }
 working=false;
}
function hydrate(){
 clearTimeout(timer);timer=setTimeout(()=>{
  document.querySelectorAll('#tpfContactsApp .tpfContactAvatar').forEach(el=>{
   const phone=el.dataset.contactAvatar!==undefined?el.dataset.phone:identify(el);if(!phone)return;
   if(cache.has(phone)){if(cache.get(phone))decorate(el,cache.get(phone));return;}
   if(!queued.has(phone)){queued.add(phone);queue.push(phone);}
  });run();
 },80);
}
function activate(e){
 const el=e.target.closest?.('[data-contact-avatar].hasPhoto');if(!el)return;
 if(e.type==='keydown'&&e.key!=='Enter'&&e.key!==' ')return;
 e.preventDefault();e.stopPropagation();
 const src=el.querySelector('img')?.src;if(src)window.TPFContactPhotoViewer?.open(src,el.dataset.name);
}
function install(){
 if(!document.getElementById('tpfContactsAvatarStyles')){const s=document.createElement('style');s.id='tpfContactsAvatarStyles';s.textContent='.tpfContactAvatar[data-contact-avatar]{position:relative;overflow:hidden}.tpfContactAvatar[data-contact-avatar] img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit}.tpfContactAvatar[data-contact-avatar].hasPhoto{cursor:zoom-in}.tpfContactAvatar[data-contact-avatar].hasPhoto:hover{box-shadow:0 0 0 2px #7d5bc1}.tpfContactAvatar[data-contact-avatar].hasPhoto:focus-visible{outline:3px solid #a98bdd;outline-offset:2px}';document.head.appendChild(s);}
 window.addEventListener('tpf:contacts-rendered',hydrate);document.addEventListener('click',activate,true);document.addEventListener('keydown',activate,true);setTimeout(hydrate,700);
}
M.register('contacts-list-avatars',{install});
})();
