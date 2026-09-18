(function(){
'use strict';
const M=window.TPFModules;if(!M||window.__tpfContactsMoreMenu)return;
window.__tpfContactsMoreMenu=true;
const $=id=>document.getElementById(id);
const safe=value=>String(value??'').trim();
function close(){document.querySelectorAll('.tpfContactsMoreMenu').forEach(menu=>menu.remove());}
async function record(id){const result=await sb.from('records').select('id,data').eq('id',id).single();if(result.error)throw result.error;return result.data;}
function displayName(row){const data=row?.data||{};return safe(data['NOMBRE Y APELLIDOS']||[data.NOMBRE,data.APELLIDOS].filter(Boolean).join(' ')||data.CLIENTE||'Contacto');}
function phone(row){const data=row?.data||{};return safe(data['TELÉFONO']||data.TELEFONO||data.PHONE||'');}
async function newOpportunity(id){
 const contact=await record(id);if(typeof loadSales==='function')await loadSales();
 const stage=(window.salesCache?.stages||[])[0];if(!stage||typeof window.newOppInStage!=='function')throw new Error('No hay columnas disponibles para crear la oportunidad.');
 await window.newOppInStage(stage.id);
 setTimeout(()=>{if($('oppModalClient'))$('oppModalClient').value=displayName(contact);if($('oppModalPhone'))$('oppModalPhone').value=phone(contact);},0);
}
async function newTask(id){
 const contact=await record(id);if(typeof window.openAgendaComposer!=='function')throw new Error('La creación de tareas no está disponible.');
 window.openAgendaComposer({contactId:id,customerName:displayName(contact),phone:phone(contact),type:'Tarea'});
}
async function sendOffer(id){
 const contact=await record(id);
 if(typeof window.openOfferComposerForContact!=='function')throw new Error('El envío de ofertas no está disponible.');
 return window.openOfferComposerForContact({id:contact.id,name:displayName(contact),phone:phone(contact)});
}
async function remove(id){
 if(!confirm('¿Eliminar este contacto? Esta acción no se puede deshacer.'))return;
 const result=await sb.from('records').delete().eq('id',id);if(result.error)throw result.error;
 await window.tpfReloadContacts?.();
}
function run(action,id){
 const work={
  open:()=>window.openContact?.(id),
  edit:()=>window.TPFContactsList?.edit?.(id),
  labels:()=>window.TPFContactLabelManager?.openFor?.(id),
  opportunity:()=>newOpportunity(id),
  task:()=>newTask(id),
  offer:()=>sendOffer(id),
  delete:()=>remove(id)
 }[action];
 if(!work)return;
 Promise.resolve(work()).catch(error=>alert(error?.message||'No se pudo completar la acción.'));
}
function open(button,id){
 const current=document.querySelector('.tpfContactsMoreMenu');if(current?.dataset.ownerId===id){close();return;}
 close();const menu=document.createElement('div');menu.className='tpfContactsMoreMenu';menu.dataset.ownerId=id;
 menu.innerHTML='<button data-contact-more="open">Abrir ficha</button><button data-contact-more="edit">Editar datos</button><button data-contact-more="labels">Gestionar etiquetas</button><button data-contact-more="offer">Enviar oferta</button><button data-contact-more="opportunity">Crear oportunidad</button><button data-contact-more="task">Crear tarea</button><button data-contact-more="delete" class="danger">Eliminar contacto</button>';
 menu.addEventListener('click',event=>{const item=event.target.closest('[data-contact-more]');if(!item)return;event.preventDefault();event.stopPropagation();close();run(item.dataset.contactMore,id);});
 document.body.appendChild(menu);const rect=button.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(innerWidth-220,rect.right-210))+'px';menu.style.top=Math.max(8,Math.min(innerHeight-menu.offsetHeight-8,rect.bottom+4))+'px';
}
function targetButton(event){const button=event.target?.closest?.('#tpfContactsRows .tpfContactActions button');if(!button)return null;const buttons=[...button.closest('.tpfContactActions').querySelectorAll('button')];return buttons.at(-1)===button?button:null;}
function mark(event){const button=targetButton(event);if(!button)return;button.dataset.action='tpf-contact-more';button.textContent='•••';button.title='Acciones';}
function markAll(){document.querySelectorAll('#tpfContactsRows .tpfContactActions').forEach(actions=>{const button=[...actions.querySelectorAll('button')].at(-1);if(!button)return;button.dataset.action='tpf-contact-more';button.textContent='•••';button.title='Acciones';});}
function click(event){const button=event.target?.closest?.('[data-action="tpf-contact-more"]');if(!button)return;const id=safe(button.dataset.id||button.closest('[data-contact-id]')?.dataset.contactId);if(!id)return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();open(button,id);}
function style(){if($('tpfContactsMoreMenuStyle'))return;const node=document.createElement('style');node.id='tpfContactsMoreMenuStyle';node.textContent='.tpfContactsMoreMenu{position:fixed;z-index:100300;width:210px;padding:6px;background:#fff;border:1px solid #dfe5ed;border-radius:10px;box-shadow:0 16px 40px #0003}.tpfContactsMoreMenu button{display:block;width:100%;padding:10px;border:0!important;background:#fff!important;text-align:left;border-radius:7px;color:#26364a}.tpfContactsMoreMenu button:hover{background:#f3f6fa!important}.tpfContactsMoreMenu .danger{color:#b42335!important;border-top:1px solid #edf0f4!important;margin-top:4px}';document.head.appendChild(node);}
M.register('contacts-more-menu',{install(){style();markAll();window.addEventListener('tpf:contacts-rendered',()=>setTimeout(markAll,0));document.addEventListener('pointerdown',mark,true);document.addEventListener('click',click,true);document.addEventListener('click',event=>{if(!event.target.closest?.('.tpfContactsMoreMenu,.tpfContactActions'))close();},true);}});
})();
