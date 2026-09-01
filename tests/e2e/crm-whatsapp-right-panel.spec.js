const { test, expect } = require('@playwright/test');

async function login(page){
  await page.goto('/', {waitUntil:'domcontentloaded'});
  await page.locator('#email').fill(process.env.CRM_TEST_EMAIL);
  await page.locator('#password').fill(process.env.CRM_TEST_PASSWORD);
  await page.locator('#signin').click();
  await expect(page.locator('#app')).toBeVisible({timeout:30000});
}

async function openWhatsAppMatchedContact(page){
  await page.locator('.nav[data-view="whatsapplive"]').click();
  await expect(page.locator('#view-whatsapplive')).toBeVisible({timeout:10000});
  const chats=page.locator('#waLiveChats .waChatRow');
  await expect(chats.first()).toBeVisible({timeout:30000});
  const n=Math.min(await chats.count(),40);
  for(let i=0;i<n;i++){
    await chats.nth(i).click();
    await expect(page.locator('#waContactCard')).toBeVisible({timeout:10000});
    await page.waitForTimeout(500);
    const matched=await page.evaluate(()=>typeof waLiveState!=='undefined'&&!!waLiveState.contact);
    if(matched){
      await expect(page.locator('#waSideOpenContact')).toBeVisible({timeout:10000});
      console.log('MATCHED_CHAT_INDEX',i);
      console.log('TPF_MODULES',JSON.stringify(await page.evaluate(()=>window.TPFModules?.status?.()||[])));
      return;
    }
  }
  throw new Error('No matched CRM contact found in first 40 WhatsApp chats');
}

async function createTemporaryTask(page){
  return page.evaluate(async()=>{
    const rec=waLiveState.contact,d=rec?.data||{};
    const phone=String(d['TELÉFONO']||d.TELEFONO||d.PHONE||d.MOVIL||waNormalizePhone(waLiveState.selected?.id||'')).replace(/\D/g,'');
    const name=String(d['NOMBRE Y APELLIDOS']||d.NOMBRE||waLiveState.selected?.name||'Contacto').trim();
    const {data:{user}}=await sb.auth.getUser();
    const title='TPF prueba editar tarea '+Date.now();
    const row={
      title,
      description:'Validación automática temporal',
      customer_name:name||null,
      customer_phone:phone||null,
      starts_at:new Date(Date.now()+3600000).toISOString(),
      reminder_at:null,
      assigned_to:user?.id||null,
      related_record_id:rec.id,
      status:'pending',
      reminder_minutes:[],
      notify_in_app:true,
      notify_email:false,
      sync_google_calendar:false
    };
    const {data,error}=await sb.from('agenda_items').insert(row).select('id').single();
    if(error)throw error;
    await loadWaContactSideData(rec,phone);
    return {id:String(data.id),title};
  });
}

test('WhatsApp reutiliza oportunidad y tareas nativas de Contactos', async ({page})=>{
  await login(page);
  await openWhatsAppMatchedContact(page);
  const temp=await createTemporaryTask(page);

  try{
    const taskRow=page.locator('#waSideTasks > *').filter({hasText:temp.title}).first();
    await expect(taskRow).toBeVisible({timeout:15000});
    const edit=taskRow.locator('button,a').filter({hasText:/^Editar$|Ver\s*\/\s*editar/i}).first();
    await expect(edit).toBeVisible({timeout:15000});

    await page.locator('#waSideNewOpp').click();
    await expect(page.locator('#oppDetailModal')).toBeVisible({timeout:10000});
    await expect(page.locator('#oppModalHeading')).toHaveText(/Nueva oportunidad/i);
    await page.evaluate(()=>document.getElementById('oppDetailModal')?.classList.add('hidden'));

    await page.locator('#waSideNewTask').click();
    await expect(page.locator('#cpTaskPage')).toBeVisible({timeout:10000});
    await expect(page.locator('#cpTaskTitle')).toBeEditable();
    await page.evaluate(()=>{
      document.getElementById('cpTaskPage')?.classList.add('hidden');
      document.getElementById('contactModal')?.classList.add('hidden');
    });

    await edit.click();
    await expect(page.locator('#cpTaskDetailPage')).toBeVisible({timeout:10000});
    await expect(page.locator('#cpTaskDetailTitle')).toBeEditable();
    await expect(page.locator('#cpTaskDetailSave')).toBeVisible();
    await page.evaluate(()=>{
      document.getElementById('cpTaskDetailPage')?.classList.add('hidden');
      document.getElementById('contactModal')?.classList.add('hidden');
    });

    await page.locator('#waSideViewTasks').click();
    await expect(page.locator('#tpfWaTasksPage')).toBeVisible({timeout:10000});
    await expect(page.locator('#tpfWaTasksList')).toContainText(temp.title);
  } finally {
    await page.evaluate(async id=>{await sb.from('agenda_items').delete().eq('id',id)},temp.id).catch(()=>{});
  }
});
