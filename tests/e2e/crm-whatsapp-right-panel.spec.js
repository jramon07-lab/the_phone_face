const { test, expect } = require('@playwright/test');

const TEST_TASK_PREFIX='TPF prueba editar tarea ';
const TEST_TASK_DESCRIPTION='Validación automática temporal';

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
  return page.evaluate(async({taskPrefix,taskDescription})=>{
    const rec=waLiveState.contact,d=rec?.data||{};
    const phone=String(d['TELÉFONO']||d.TELEFONO||d.PHONE||d.MOVIL||waNormalizePhone(waLiveState.selected?.id||'')).replace(/\D/g,'');
    const name=String(d['NOMBRE Y APELLIDOS']||d.NOMBRE||waLiveState.selected?.name||'Contacto').trim();
    const [{data:{user}},{data:{session}}]=await Promise.all([sb.auth.getUser(),sb.auth.getSession()]);
    if(!user?.id||!session?.access_token)throw new Error('No hay una sesión válida para limpiar la tarea temporal.');
    if(!sb.supabaseUrl||!sb.supabaseKey)throw new Error('No se ha podido preparar la limpieza independiente de Supabase.');
    const stale=await sb.from('agenda_items').delete()
      .like('title',`${taskPrefix}%`)
      .eq('description',taskDescription)
      .eq('assigned_to',user.id)
      .select('id');
    if(stale.error)throw stale.error;
    const remaining=await sb.from('agenda_items').select('id')
      .like('title',`${taskPrefix}%`)
      .eq('description',taskDescription)
      .eq('assigned_to',user.id);
    if(remaining.error)throw remaining.error;
    if(remaining.data?.length)throw new Error(`Quedan ${remaining.data.length} tareas temporales antiguas sin limpiar.`);
    const title=taskPrefix+Date.now();
    const row={
      title,
      description:taskDescription,
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
    return {
      id:String(data.id),
      title,
      cleanup:{
        supabaseUrl:sb.supabaseUrl,
        supabaseKey:sb.supabaseKey,
        accessToken:session.access_token
      }
    };
  },{taskPrefix:TEST_TASK_PREFIX,taskDescription:TEST_TASK_DESCRIPTION});
}

async function deleteTemporaryTask(temp){
  const url=new URL(`${temp.cleanup.supabaseUrl}/rest/v1/agenda_items`);
  url.searchParams.set('id',`eq.${temp.id}`);
  url.searchParams.set('title',`eq.${temp.title}`);
  url.searchParams.set('description',`eq.${TEST_TASK_DESCRIPTION}`);
  const headers={
    apikey:temp.cleanup.supabaseKey,
    authorization:`Bearer ${temp.cleanup.accessToken}`
  };
  let lastError;
  for(let attempt=1;attempt<=3;attempt++){
    try{
      const response=await fetch(url,{method:'DELETE',headers});
      if(!response.ok)throw new Error(`No se pudo limpiar la tarea temporal (${response.status}).`);
      const verifyUrl=new URL(url);
      verifyUrl.searchParams.set('select','id');
      const verify=await fetch(verifyUrl,{headers});
      if(!verify.ok)throw new Error(`No se pudo verificar la limpieza temporal (${verify.status}).`);
      const remaining=await verify.json();
      if(Array.isArray(remaining)&&remaining.length===0)return;
      throw new Error(`La tarea temporal sigue existiendo tras el intento ${attempt}.`);
    }catch(error){
      lastError=error;
    }
  }
  throw lastError;
}

test('WhatsApp reutiliza oportunidad y tareas nativas de Contactos', async ({page})=>{
  await login(page);
  await openWhatsAppMatchedContact(page);
  const temp=await createTemporaryTask(page);

  try{
    await page.evaluate(async()=>{
      const rec=waLiveState.contact,d=rec?.data||{};
      const phone=String(d['TELÉFONO']||d.TELEFONO||d.PHONE||d.MOVIL||waNormalizePhone(waLiveState.selected?.id||'')).replace(/\D/g,'');
      await loadWaContactSideData(rec,phone);
    });
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
    await deleteTemporaryTask(temp);
  }
});
