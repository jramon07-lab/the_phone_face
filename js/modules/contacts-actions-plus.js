(function(){
  'use strict';
  const M=window.TPFModules;
  if(!M||window.__tpfContactsActionsPlusLoaded)return;
  window.__tpfContactsActionsPlusLoaded=true;
  const $=id=>document.getElementById(id);
  const text=value=>String(value??'').trim();
  const field=(data,...keys)=>keys.map(key=>text(data?.[key])).find(Boolean)||'';
  const close=()=>document.querySelectorAll('.tpfMoreMenuPlus').forEach(node=>node.remove());
  const waitFor=async(selector,tries=30)=>{
    for(let step=0;step<tries;step++){
      const node=document.querySelector(selector);
      if(node)return node;
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    return null;
  };
  const contact=async id=>{
    const response=await sb.from('records').select('id,source_sheet,data').eq('id',id).single();
    if(response.error)throw response.error;
    const row=response.data||{};
    const data=row.data||{};
    const fullName=field(data,'NOMBRE Y APELLIDOS','CLIENTE','CLIENTE FINAL')||[field(data,'NOMBRE'),field(data,'APELLIDOS')].filter(Boolean).join(' ')||'Contacto';
    return {id:String(row.id),data,fullName,phone:field(data,'TELÉFONO','TELEFONO','PHONE','MOVIL')};
  };
  const openProfile=async id=>{
    if(typeof window.openContact!=='function')throw new Error('La ficha de contacto no está disponible.');
    await window.openContact(id);
  };
  const edit=async id=>{
    if(window.TPFContactsList?.edit)return window.TPFContactsList.edit(id);
    await openProfile(id);
    const button=await waitFor('#tpfContactEditToggle');
    button?.click();
  };
  const labels=async id=>{
    await openProfile(id);
    const button=await waitFor('#contactManageLabels');
    if(!button)throw new Error('El gestor de etiquetas no está disponible.');
    button.click();
  };
  const offer=async id=>{
    await openProfile(id);
    const button=await waitFor('#cpNewOffer');
    if(!button)throw new Error('El configurador de ofertas no está disponible.');
    button.click();
  };
  const opportunity=async id=>{
    const row=await contact(id);
    if(typeof window.loadSales==='function')await window.loadSales();
    const stage=(window.salesCache?.stages||[])[0];
    if(!stage||typeof window.newOppInStage!=='function')throw new Error('No hay una columna disponible para crear la oportunidad.');
    await window.newOppInStage(stage.id);
    const modal=$('oppDetailModal');
    if($('oppModalClient'))$('oppModalClient').value=row.fullName;
    if($('oppModalPhone'))$('oppModalPhone').value=row.phone;
    if(modal)modal.style.setProperty('z-index','100000','important');
  };
  const task=async id=>{
    const row=await contact(id);
    if(typeof window.openAgendaComposer!=='function')throw new Error('La creación de tareas no está disponible.');
    window.openAgendaComposer({contactId:row.id,customerName:row.fullName,phone:row.phone,type:'Tarea'});
  };
  const remove=async id=>{
    if(!confirm('¿Eliminar este contacto? Esta acción no se puede deshacer.'))return;
    const response=await sb.from('records').delete().eq('id',id);
    if(response.error)throw response.error;
    await window.tpfReloadContacts?.();
  };
  const actionMap={
    open:openProfile,
    edit,
    labels,
    offer,
    opportunity,
    task,
    remove
  };
  const openMenu=(button,id)=>{
    close();
    const menu=document.createElement('div');
    menu.className='tpfMoreMenu tpfMoreMenuPlus';
    menu.dataset.ownerId=id;
    const entries=[
      ['Abrir ficha','open'],['Editar datos','edit'],['Gestionar etiquetas','labels'],['Enviar oferta','offer'],
      ['Crear oportunidad','opportunity'],['Crear tarea','task'],['Eliminar contacto','remove']
    ];
    for(const [label,action] of entries){
      const item=document.createElement('button');
      item.type='button';item.textContent=label;item.dataset.tpfContactMenuAction=action;
      if(action==='remove')item.className='danger';
      menu.appendChild(item);
    }
    document.body.appendChild(menu);
    const box=button.getBoundingClientRect();
    menu.style.left=`${Math.max(8,Math.min(window.innerWidth-228,box.right-220))}px`;
    menu.style.top=`${Math.max(8,Math.min(window.innerHeight-menu.offsetHeight-8,box.bottom+5))}px`;
    menu.addEventListener('click',async event=>{
      const item=event.target.closest('[data-tpf-contact-menu-action]');
      if(!item)return;
      event.preventDefault();event.stopPropagation();
      const action=item.dataset.tpfContactMenuAction;
      close();
      try{await actionMap[action]?.(id);}catch(error){alert(error?.message||'No se pudo completar la acción.');}
    });
  };
  const install=()=>{
    if(!$('tpfContactsActionsPlusStyle')){
      const style=document.createElement('style');
      style.id='tpfContactsActionsPlusStyle';
      style.textContent='.tpfMoreMenuPlus{z-index:100500!important;width:220px!important}.tpfMoreMenuPlus button{font-size:13px!important}.tpfMoreMenuPlus .danger{margin-top:4px;border-top:1px solid #edf0f4!important;}';
      document.head.appendChild(style);
    }
    document.addEventListener('pointerdown',event=>{
      const button=event.target.closest?.('#tpfContactsRows .tpfContactActions button');
      if(!button)return;
      const actions=button.closest('.tpfContactActions');
      const buttons=actions?[...actions.querySelectorAll('button')]:[];
      if(!buttons.length||buttons[buttons.length-1]!==button)return;
      const id=text(button.dataset.id||button.closest('[data-contact-id]')?.dataset.contactId);
      if(!id)return;
      button.dataset.action='tpf-contact-actions-plus';
      button.dataset.id=id;
      button.textContent='⋯';
      button.title='Más acciones';
    },true);
    document.addEventListener('click',event=>{
      const button=event.target.closest?.('[data-action="tpf-contact-actions-plus"]');
      if(!button)return;
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      openMenu(button,text(button.dataset.id||button.closest('[data-contact-id]')?.dataset.contactId));
    },true);
    document.addEventListener('click',event=>{
      if(event.target.closest?.('.tpfMoreMenuPlus,[data-action="tpf-contact-actions-plus"]'))return;
      close();
    },true);
  };
  M.register('contacts-actions-plus',{install});
})();
