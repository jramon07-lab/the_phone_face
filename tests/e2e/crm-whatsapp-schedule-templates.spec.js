const path=require('path');
const {test,expect}=require('@playwright/test');

const pickerScript=path.join(process.cwd(),'js/modules/whatsapp-template-picker-direct.js');
const scheduleScript=path.join(process.cwd(),'js/modules/whatsapp-schedule-direct-v3.js');

async function mountFixture(page){
  await page.setContent(`<!doctype html><html><head></head><body>
    <div class="referenceNav"><button id="tpfWaTemplatesV3Nav">Plantillas WhatsApp</button></div>
    <button id="waTemplateBtn">Plantillas</button>
    <button id="waScheduleBtn">Programar</button>
    <button id="waQuickDrop">Programar rápido</button>
    <button id="cpScheduleWhatsapp">Programar contacto</button>
    <div id="waQuickModal" class="hidden"></div>
    <div id="waQuickScheduleBox" class="hidden"></div>
    <input id="waQuickProgramId"><input id="waQuickWhen"><input id="waQuickPhone">
    <textarea id="waQuickMessage"></textarea><div id="waQuickMsg"></div><button id="waQuickSend"></button>
    <input id="contactName"><input id="contactPhone"><input id="contactDni">
    <div id="waChatName"></div><textarea id="waComposerText"></textarea>
  </body></html>`);

  await page.evaluate(()=>{
    window.crmCan=()=>true;
    window.__tpfModules={};
    window.TPFModules={register(name,module){window.__tpfModules[name]=module}};
    window.waLoadTemplates=()=>[
      {id:'welcome',name:'Bienvenida',category:'General',text:'Hola {nombre}.'},
      {id:'orange',name:'Oferta Orange',category:'Comercial',text:'Hola {nombre}; {nombre_completo}; {telefono}; {dni}'}
    ];
    window.waSyncTemplatesFromSupabase=async()=>{};
    window.__agendaInsert=null;
    window.sb={
      auth:{getUser:async()=>({data:{user:{id:'user-1'}},error:null})},
      from(table){
        if(table!=='agenda_items')throw new Error(`Tabla inesperada: ${table}`);
        return{
          insert:async row=>{window.__agendaInsert=row;return{error:null}},
          update:row=>({eq:async()=>{window.__agendaUpdate=row;return{error:null}}})
        };
      }
    };
  });

  await page.addScriptTag({path:pickerScript});
  await page.addScriptTag({path:scheduleScript});
  await page.evaluate(()=>{
    window.__tpfModules['whatsapp-template-picker-direct'].install();
    window.__tpfModules['whatsapp-schedule-direct-v3'].install();
  });
}

test('programar WhatsApp permite elegir una plantilla con filtros, favoritas y variables del contacto correcto',async({page})=>{
  await mountFixture(page);
  await page.evaluate(()=>window.openWaScheduleV3({
    phone:'+34 695 661 409',
    name:'Ramón Sánchez',
    dni:'75564628Z',
    contactId:'contact-1',
    message:'Texto anterior',
    source:'test'
  }));

  await expect(page.locator('#tpfSched3')).toBeVisible();
  await expect(page.locator('#tpfS3phone')).toHaveValue('+34 695 661 409');
  await expect(page.locator('#tpfS3contact')).toHaveText('Para Ramón Sánchez');

  await page.locator('#tpfS3template').click();
  await expect(page.locator('#tpfDirectPickerModal')).toBeVisible();
  await page.locator('#tpfDirectSearch').fill('Orange');
  await expect(page.locator('#tpfDirectList .tpfDRow')).toHaveCount(1);
  await page.locator('[data-favourite="1"]').click();
  await page.locator('[data-filter="fav"]').click();
  await expect(page.locator('#tpfDirectList .tpfDRow')).toHaveCount(1);
  await page.locator('[data-use="1"]').click();

  await expect(page.locator('#tpfDirectPickerModal')).toHaveCount(0);
  await expect(page.locator('#tpfSched3')).toBeVisible();
  await expect(page.locator('#tpfS3msg')).toHaveValue('Hola Ramón; Ramón Sánchez; 34695661409; 75564628Z');
  await expect(page.locator('#tpfS3templateName')).toHaveText('Plantilla elegida: Oferta Orange');

  await page.locator('#tpfS3save').click();
  await expect(page.locator('#tpfSched3')).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>window.__agendaInsert)).toMatchObject({
    customer_name:'Ramón Sánchez',
    customer_phone:'+34 695 661 409',
    whatsapp_phone:'+34 695 661 409',
    whatsapp_message:'Hola Ramón; Ramón Sánchez; 34695661409; 75564628Z',
    whatsapp_enabled:true,
    related_record_id:'contact-1',
    status:'pending'
  });
});

test('cerrar elimina el selector y los datos temporales antes de abrir otro contacto',async({page})=>{
  await mountFixture(page);
  await page.evaluate(()=>window.openWaScheduleV3({phone:'600111222',name:'Contacto anterior',message:'Anterior'}));
  await page.locator('#tpfS3template').click();
  await page.locator('[data-picker-close]').click();
  await expect(page.locator('#tpfDirectPickerModal')).toHaveCount(0);
  await page.locator('#tpfSched3 [data-close]').last().click();

  await expect(page.locator('#waQuickPhone')).toHaveValue('');
  await expect(page.locator('#waQuickMessage')).toHaveValue('');
  await page.evaluate(()=>window.openWaScheduleV3({phone:'611333444',name:'Contacto nuevo',message:''}));
  await expect(page.locator('#tpfS3phone')).toHaveValue('611333444');
  await expect(page.locator('#tpfS3contact')).toHaveText('Para Contacto nuevo');
  await expect(page.locator('#tpfS3msg')).toHaveValue('');
});
