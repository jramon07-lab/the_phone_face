/* Presentation only: move existing controls without cloning or changing settings. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
function organize(hostId,groups,findGroup,keep){
 const host=$(hostId);if(!host||host.querySelector('.tpfAdminSections'))return;
 const shell=document.createElement('div');shell.className='tpfAdminSections';
 const nav=document.createElement('div');nav.className='tpfAdminTabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label',hostId==='view-settings'?'Apartados de configuración':'Apartados del sistema');
 const content=document.createElement('div');content.className='tpfAdminContent';shell.append(nav,content);host.append(shell);
 let selected=groups[0][0],scheduled=false;
 const panels=new Map(),buttons=new Map();
 function select(id,focus=false){selected=id;for(const [key,panel]of panels){const active=key===id,button=buttons.get(key);panel.hidden=!active;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;if(active&&focus)button.focus();}}
 for(const [id,title,description]of groups){
  const panel=document.createElement('section');panel.id=hostId+'-'+id;panel.className='tpfAdminPanel';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',panel.id+'-tab');panel.tabIndex=0;
  const heading=document.createElement('div');heading.className='tpfAdminPanelHeading';const h=document.createElement('h3');h.textContent=title;const p=document.createElement('p');p.textContent=description;heading.append(h,p);panel.append(heading);
  const button=document.createElement('button');button.type='button';button.id=panel.id+'-tab';button.textContent=title;button.setAttribute('role','tab');button.setAttribute('aria-controls',panel.id);button.onclick=()=>select(id);nav.append(button);content.append(panel);panels.set(id,panel);buttons.set(id,button);
 }
 nav.addEventListener('keydown',event=>{const ids=groups.map(x=>x[0]),at=ids.indexOf(selected);let next;if(event.key==='ArrowRight')next=(at+1)%ids.length;else if(event.key==='ArrowLeft')next=(at+ids.length-1)%ids.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=ids.length-1;else return;event.preventDefault();select(ids[next],true);});
 function refresh(){scheduled=false;
  for(const card of host.querySelectorAll('.card')){if(keep(card)||card.parentElement.closest('.card'))continue;const target=panels.get(findGroup(card));if(target&&card.parentElement!==target)target.append(card);}
 }
 const observer=new MutationObserver(records=>{if(scheduled||!records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches?.('.card')||n.querySelector?.('.card')))))return;scheduled=true;requestAnimationFrame(refresh);});observer.observe(host,{childList:true,subtree:true});
 select(selected);refresh();
}
function install(){
 const settings=$('view-settings'),header=settings?.querySelector('.card');
 organize('view-settings',[
  ['connections','Conexiones','WhatsApp y servicios de Google. Sus ajustes se comparten en el CRM.'],
  ['notifications','Avisos y agenda','Elige qué avisos recibe el equipo y cuáles se activan en este ordenador.'],
  ['search','Buscador','Personaliza las columnas de búsqueda para cada usuario y archivo.']
 ],card=>card.classList.contains('searchConfigCard')?'search':card.id==='agendaGlobalSettingsCard'||card.querySelector('#notifySave')?'notifications':'connections',card=>card===header);
 organize('view-system',[
  ['overview','Resumen','Estado de los servicios y de los procesos automáticos.'],
  ['incidents','Incidencias','Avisos del equipo y registro de errores de este navegador.'],
  ['followups','Seguimientos','Actividad de las ofertas y comprobaciones de sus recordatorios.'],
  ['backups','Copias de seguridad','Conexión con Google Drive, última copia e historial de verificación.'],
  ['advanced','Diagnóstico avanzado','Comprobaciones técnicas y herramientas de mantenimiento.']
 ],card=>card.id==='tpfIncidentRegistry'||card.querySelector('#systemErrorList')?'incidents':card.id==='tpfFollowupRegistry'?'followups':card.id==='tpfDriveBackupCard'?'backups':['tpfModuleStatusCard','tpfMaintenanceCard'].includes(card.id)?'advanced':'overview',card=>card.classList.contains('systemStatusCard'));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
