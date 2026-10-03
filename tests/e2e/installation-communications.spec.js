const {test,expect}=require('@playwright/test'),path=require('node:path');
async function fixture(page){
 await page.route('**/*',r=>r.abort());await page.setContent('<style>.hidden{display:none!important}body{margin:0;font:14px Arial;color:#24354b}button{cursor:pointer}</style><div id="app"><div id="view-dashboard" class="tpfDashPro"><div class="tdCommercialDetails"></div></div></div><div id="settings"></div><div id="editor"></div>');
 await page.clock.setFixedTime(new Date('2026-10-03T16:30:00Z'));
 await page.evaluate(()=>{
  const defaults={shop_phone:'',slots:[],return_time:'10:00',appointment_text:'Hola {nombre}. Instalación de {operador} el {fecha}, {franja}. Estate pendiente del teléfono. Si hay algún problema, {ayuda}. Pulsa Instalado.',no_appointment_text:'Hola {nombre}. Pendiente de cita de {operador}. Si hay algún problema, {ayuda}.',date_prompt_text:'¿Qué día te instalaron?',date_other_text:'Fecha DD/MM/AAAA',confirmed_text:'Instalación del {fecha_instalacion} registrada.'};
  window.fixture={defaults,operators:{Vodafone:{...defaults,operator:'Vodafone',updated_at:'first',slots:[{from:'10:00',to:'12:00'}]}},calls:[],fail:false,i:null};
  window.sb={auth:{onAuthStateChange(){}},from(){return{select(){return this},async like(){return{data:[]}}}},rpc(name,args){fixture.calls.push({name,args});let result;
   if(name==='crm_installation_preview')result={data:{workflow:'installation_v1',available:true,operator:'Vodafone',recipient:'Gestora Ejemplo',recipient_first_name:'Gestora',phone:'600000001',opportunity_updated_at:'op-version',installation_config:fixture.operators.Vodafone,preferences:{previous_operator:'Yoigo'},installation:fixture.i}};
   else if(name==='crm_installation_settings')result={data:{defaults,operators:fixture.operators}};
   else if(name==='crm_operator_communication_templates')result={data:[{rule_id:'rule',rule_name:'3 meses · '+args.p_operator,template_id:1,template_name:'Seguridad',body:'Mensaje original 3 meses',schedule:'Regla existente'}]};
   else if(name==='crm_installation_save_settings'){if(fixture.fail)result={error:{message:'Conflicto en otro dispositivo'}};else{fixture.operators[args.p_operator]={...args.p_config,operator:args.p_operator,updated_at:'saved'};result={data:fixture.operators[args.p_operator]};}}
   else if(name==='crm_installation_update'||name==='crm_installation_adopt'||name==='crm_operator_communication_save')result=fixture.fail?{error:{message:'Cambió en otro dispositivo'}}:{data:{}};
   else if(name==='crm_installations_list')result={data:[{opportunity_id:'op3',client_name:'Ana Ejemplo',operator:'Vodafone',price:35,appointment_date:'2026-10-08',time_from:'10:00',time_to:'12:00',status:'scheduled',offer_instance_id:'offer3',offer_sent:true},{opportunity_id:'op1',client_name:'Luis Ejemplo',operator:'O2',price:30,appointment_date:'2026-10-06',time_from:'09:00',time_to:'11:00',status:'scheduled'},{opportunity_id:'op2',client_name:'Sara Ejemplo',operator:'MásMóvil',status:'confirmed',installed_on:'2026-10-02',return_due_at:'2026-10-06T08:00:00Z'},{opportunity_id:'op4',client_name:'Elena Ejemplo',operator:'Orange',status:'excel',excel_date:'2026-09-20'}]};
   else throw Error('Unexpected RPC '+name);
   const promise=Promise.resolve(result);promise.range=()=>Promise.resolve(result);return promise;
  }};
 });
 for(const file of ['router-return','installation-communications','installation-settings','installation-registry','router-return-settings'])await page.addScriptTag({path:path.resolve('js/modules/'+file+'.js')});
}
test('Processing edits appointment, preserves client draft, copies recipient and separates return',async({page})=>{
 await fixture(page);await page.evaluate(async()=>{const data=await TPFRouterReturn.preview({id:'op'});window.controller=TPFRouterReturn.bind(document.getElementById('editor'),data,{preferences:{previous_operator:'Yoigo'}});});
 const root=page.locator('#editor');await expect(root).toContainText('Gestora Ejemplo');await expect(root.locator('[data-send]')).toBeChecked();await root.locator('[data-date]').fill('2026-10-08');await root.locator('[data-slot]').selectOption('0');await expect(root.locator('[data-text]')).toHaveValue(/08\/10\/2026.*10:00.*12:00/);
 await expect(root.locator('[data-text]')).not.toHaveValue(/router de Yoigo/);await expect(root.locator('[data-return-text]')).toHaveValue(/router de Yoigo/);
 await root.locator('[data-text]').fill('Aviso personalizado de Gestora');await root.locator('[data-date]').fill('2026-10-09');await root.locator('[data-from]').focus();await expect(root.locator('[data-text]')).toHaveValue('Aviso personalizado de Gestora');
 const p=await page.evaluate(()=>controller.get());expect(p.workflow).toBe('installation_v1');expect(p.appointment_date).toBe('2026-10-09');expect(p.send_at).toBeNull();expect(p.previous_operator).toBe('Yoigo');expect(p.text).toBe('Aviso personalizado de Gestora');
 await root.locator('[data-previous]').selectOption('Ninguno');await expect(root.locator('[data-return-text]')).toBeDisabled();await expect(root).toContainText('Sin router anterior que devolver');
});
test('Unknown date is allowed; invalid ranges and dates are rejected without sends',async({page})=>{
 await fixture(page);await page.evaluate(async()=>{window.controller=TPFInstallations.bind(document.getElementById('editor'),await TPFInstallations.preview({id:'op'}),{});});
 expect((await page.evaluate(()=>controller.get())).appointment_date).toBeNull();await expect(page.locator('#editor [data-text]')).toHaveValue(/Pendiente de cita/);
 await page.locator('#editor [data-from]').fill('12:00');expect(await page.evaluate(()=>{try{controller.get();return '';}catch(e){return e.message;}})).toContain('fecha y la hora');
 await page.locator('#editor [data-date]').fill('2026-10-05');await page.locator('#editor [data-to]').fill('09:00');expect(await page.evaluate(()=>{try{controller.get();return '';}catch(e){return e.message;}})).toContain('posterior');expect(await page.evaluate(()=>fixture.calls.some(x=>/update|adopt/.test(x.name)))).toBe(false);
 expect(await page.evaluate(()=>TPFInstallations.businessDays('2026-10-02'))).toBe('2026-10-06');expect(await page.evaluate(()=>TPFInstallations.businessDays('2026-10-03'))).toBe('2026-10-06');
});
test('Configuration groups all texts per operator, saves atomically and keeps conflicts visible',async({page})=>{
 await fixture(page);await page.evaluate(()=>TPFRouterSettings.mount(document.getElementById('settings')));const root=page.locator('#settings');await expect(root.locator('[data-title]')).toHaveText('Vodafone');await expect(root).toContainText('Devolución del router de este operador');
 await root.locator('[data-shop-phone]').fill('958000000');await expect(root.locator('[data-preview]')).toContainText('958000000');await root.locator('[data-router-text]').fill('Instrucciones editadas de Vodafone');await root.locator('[data-save]').click();await expect(root.locator('[data-status]')).toContainText('guardada para todos');
 const c=await page.evaluate(()=>fixture.calls.find(x=>x.name==='crm_installation_save_settings'));expect(c.args.p_config.router_text).toBe('Instrucciones editadas de Vodafone');expect(c.args.p_expected_at).toBe('first');
 await root.locator('[data-operator="Yoigo"]').click();await root.locator('[data-appointment-text]').fill('Texto nuevo Yoigo');await page.evaluate(()=>fixture.fail=true);await root.locator('[data-save]').click();await expect(root.locator('[data-status]')).toContainText('otro dispositivo');await expect(root.locator('[data-appointment-text]')).toHaveValue('Texto nuevo Yoigo');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
test('Registry orders visits, filters client confirmation and exposes Excel separately',async({page})=>{
 await fixture(page);await page.evaluate(()=>TPFInstallationRegistry.open());const d=page.locator('#tpfInstallRegistryDialog');await expect(d.locator('tbody tr').first()).toContainText('Luis Ejemplo');await expect(d.locator('[data-count]')).toContainText('4 instalaciones');
 await d.locator('[data-filter="confirmed"]').click();await expect(d.locator('tbody tr')).toHaveCount(1);await expect(d.locator('tbody')).toContainText('Sara Ejemplo');await expect(d.locator('tbody')).toContainText('Devolución:');
 await d.locator('[data-filter="excel"]').click();await expect(d.locator('tbody')).toContainText('Elena Ejemplo');await expect(d.locator('tbody')).toContainText('20/09/2026 · Excel');await d.locator('footer [data-close]').click();await expect(d).toHaveCount(0);
});
test('Manage existing installation checks version, does not manually mark installed, preserves failure draft',async({page})=>{
 await fixture(page);await page.evaluate(()=>{fixture.i={id:'installation',updated_at:'version-i',appointment_date:'2026-10-08',time_from:'10:00',time_to:'12:00',previous_operator:'Yoigo',return_text:'Devolución guardada',notice_text:'Aviso guardado',incident:''};TPFInstallations.manage('op');});const d=page.locator('#tpfInstallationDialog');await expect(d.locator('[data-save]')).toBeEnabled();await expect(d.locator('[data-send]')).not.toBeChecked();await d.locator('[data-incident]').fill('Técnico pendiente de llamar');await page.evaluate(()=>fixture.fail=true);await d.locator('[data-save]').click();await expect(d.locator('[data-status]')).toContainText('otro dispositivo');await expect(d.locator('[data-incident]')).toHaveValue('Técnico pendiente de llamar');
 const call=await page.evaluate(()=>fixture.calls.find(x=>x.name==='crm_installation_update'));expect(call.args.p_expected_at).toBe('version-i');expect(call.args.p_patch).not.toHaveProperty('installed_on');expect(call.args.p_patch).not.toHaveProperty('return_text');expect(call.args.p_patch.send).toBe(false);
});
