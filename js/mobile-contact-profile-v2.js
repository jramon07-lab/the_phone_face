/* Ficha comercial compacta para la aplicación /movil/. */
(()=>{
  const view=document.querySelector('#mobileView');
  if(!view)return;
  const make=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text)node.textContent=text;return node;};
  const tabButton=(tab,label)=>{const button=make('button','m-cp2-tab',label);button.type='button';button.dataset.action='profile-tab';button.dataset.tab=tab;return button;};
  const cloneAction=(node,label)=>{if(!node)return null;const copy=node.cloneNode(true);copy.className=copy.className.replace(/\bm-primary\b|\bm-secondary\b/g,'').trim()+' m-cp2-action';copy.textContent=label;copy.type='button';return copy;};
  function enhance(){
    const page=view.querySelector('.m-page'),hero=page?.querySelector('.m-profile-hero');
    if(!page||!hero||page.dataset.contactProfileV2)return;
    page.dataset.contactProfileV2='1';page.classList.add('m-contact-profile-v2');
    const wa=page.querySelector('[data-action="contact-whatsapp"]');
    const opportunity=page.querySelector('[data-route^="new-contact-opportunity/"]');
    const labels=page.querySelector('[data-action="profile-labels"]');
    const contactId=wa?.dataset.id||(opportunity?.dataset.route||'').split('/')[1];
    const phone=hero.querySelectorAll('p')[1]?.textContent||'';
    const identity=make('section','m-cp2-identity');
    identity.append(hero.querySelector('.m-avatar')?.cloneNode(true)||make('div','m-avatar','?'));
    const copy=make('div','');copy.append(make('h1','',hero.querySelector('h1')?.textContent||'Contacto'),make('p','',phone));identity.append(copy);hero.replaceWith(identity);
    page.querySelector('.m-contact-phone-actions')?.remove();
    const oldActions=page.querySelector('.m-profile-actions');
    const actions=make('section','m-cp2-actions'),taskButton=contactId?make('button','m-cp2-action','＋ Tarea'):null;
    if(taskButton){taskButton.type='button';taskButton.dataset.action='route';taskButton.dataset.route=`new-task/${contactId}`;}
    [cloneAction(wa,'WhatsApp'),cloneAction(opportunity,'＋ Oportunidad'),taskButton,cloneAction(labels,'Etiquetas')].filter(Boolean).forEach(button=>actions.append(button));
    oldActions?.replaceWith(actions);if(!oldActions)identity.after(actions);
    const tabs=page.querySelector('.m-tabs');
    if(!tabs)return;
    const offerText=[...tabs.querySelectorAll('button')].find(button=>button.dataset.tab==='opportunities')?.textContent||'Ofertas';
    const taskText=[...tabs.querySelectorAll('button')].find(button=>button.dataset.tab==='tasks')?.textContent||'Tareas';
    const snapshot=make('section','m-cp2-snapshot');
    const offer=tabButton('opportunities','Ofertas y seguimiento');offer.innerHTML=`<small>${offerText}</small><b>Ver oportunidades</b><span>Estado, importe y seguimiento</span>`;
    const task=tabButton('tasks','Próxima tarea');task.innerHTML=`<small>${taskText}</small><b>Ver tareas</b><span>Recordatorios del contacto</span>`;
    const history=tabButton('history','Actividad');history.innerHTML='<small>Historial</small><b>Ver actividad</b><span>Todo lo que ha ocurrido</span>';
    snapshot.append(offer,task,history);tabs.before(snapshot);
    [...tabs.querySelectorAll('button')].forEach(button=>{const names={summary:'Datos',opportunities:'Ofertas',tasks:'Tareas',documents:'Archivos',history:'Historial',more:'Más'};if(names[button.dataset.tab])button.textContent=names[button.dataset.tab];});
  }
  new MutationObserver(enhance).observe(view,{childList:true,subtree:true});
  enhance();
})();