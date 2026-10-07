const {test,expect}=require('@playwright/test');
const path=require('node:path');
test('Create review uses saved dates, keeps drafts on failure and avoids invented dates',async({page,context})=>{
 await context.route('**/*',r=>r.abort());await page.setContent('<main></main>');
 await page.evaluate(()=>{
  window.crypto.randomUUID=()=> '10000000-0000-4000-8000-000000000001';window.TPFModules={register(){}};window.salesCache={opportunities:[{id:'o1',record_id:'c1',title:'CAMBIO VODAFONE',discount_end_date:'2028-03-31',terminal_commitment_end:'2029-04-10',contract_party:{holder_name:'Titular de prueba'}}]};
  window.calls=[];window.fail=true;window.loadSales=async()=>{};window.sb={rpc:async(name,args)=>{calls.push({name,args});return fail?{error:{message:'No se pudo guardar'}}:{data:'new-review'}}};
 });
 await page.addScriptTag({path:path.resolve('js/modules/contact-review-action.js')});
 await page.evaluate(()=>TPFContactReview.openForContact({id:'c1',managerId:'m1',recipientId:'m1'}));
 await expect(page.locator('#tpfReviewDate')).toHaveValue('2028-03-31');await expect(page.locator('#tpfReviewTerminal')).toHaveValue('2029-04-10');
 await expect(page.locator('#tpfOtherOperatorWrap')).toBeHidden();await expect(page.locator('#tpfReviewDestination')).toContainText('29/2/2028');
 await page.locator('#tpfReviewOperator').selectOption('Otro');await expect(page.locator('#tpfOtherOperatorWrap')).toBeVisible();await page.locator('#tpfOtherOperator').fill('Operador de prueba');
 await page.locator('#tpfReviewNote').fill('Conservar esta nota');await page.locator('#tpfReviewSave').click();await expect(page.locator('.tpfReviewError')).toHaveText('No se pudo guardar');
 await expect(page.locator('#tpfReviewNote')).toHaveValue('Conservar esta nota');await expect(page.locator('#tpfReviewDate')).toHaveValue('2028-03-31');
 await page.evaluate(()=>fail=false);await page.locator('#tpfReviewSave').click();await expect(page.locator('.tpfReviewBack')).toHaveCount(0);
 const calls=await page.evaluate(()=>window.calls);expect(calls).toHaveLength(2);expect(calls[1]).toMatchObject({name:'crm_create_manual_review_v2',args:{p_discount_end:'2028-03-31',p_terminal_commitment_end:'2029-04-10',p_manager:'m1',p_recipient:'m1',p_note:'Conservar esta nota'}});expect(calls[0].args.p_request_key).toBe(calls[1].args.p_request_key);
 await page.evaluate(()=>{salesCache.opportunities.push({id:'o2',record_id:'c1',title:'CAMBIO O2',discount_end_date:'2028-01-01'});return TPFContactReview.openForContact({id:'c1'})});
 await expect(page.locator('#tpfReviewDate')).toHaveValue('');await page.locator('#tpfReviewSource').selectOption('1');await expect(page.locator('#tpfReviewDate')).toHaveValue('2028-01-01');await expect(page.locator('#tpfReviewTerminal')).toHaveValue('');
 await page.locator('#tpfReviewSource').selectOption('');await page.locator('#tpfReviewOperator').selectOption('O2');await page.locator('#tpfReviewSave').click();await expect(page.locator('.tpfReviewError')).toContainText('fecha de fin');expect(await page.evaluate(()=>calls.length)).toBe(2);
 expect(await page.locator('.tpfReviewCard').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
});
test('Monthly list edits and cancels only its review, preserving the opportunity',async({page,context})=>{
 await context.route('**/*',r=>r.abort());
 await page.clock.setFixedTime(new Date('2026-10-02T20:00:00Z'));
 await page.setContent('<nav><button class="nav" data-view="reviews">Revisiones del mes</button></nav><section id="view-reviews" class="hidden"></section><section id="view-dashboard"></section>');
 await page.addStyleTag({path:path.resolve('assets/monthly-reviews.css')});
 await page.evaluate(()=>{
  window.perms={is_admin:true};window.crmCan=()=>true;window.calls=[];
  window.fixture={id:'r1',opportunity_id:'o1',client_name:'Ana',phone:'600000000',operator:'Yoigo',kind:'manual',target_date:'2026-11-01',deadline:'2026-11-01',start_date:'2026-10-02',send_at:'2026-10-02T08:00:00Z',responsible_name:'Ramón',message_text:'Hola Ana. Tu descuento termina el 1 de noviembre.',status:'active',send_enabled:true};
  window.sb={rpc:async(name,args)=>{calls.push({name,args});if(name==='crm_list_monthly_reviews')return{data:[fixture]};if(name==='crm_edit_monthly_review'){if(args.p_action==='save')fixture.message_text=args.p_text;if(args.p_action==='cancel_send')fixture.send_enabled=false;return{data:null}}throw Error('Unexpected write');}};
  document.querySelector('.nav').onclick=e=>{e.currentTarget.classList.add('active');document.getElementById('view-reviews').classList.remove('hidden');};
 });
 await page.addScriptTag({path:path.resolve('js/modules/router-return.js')});
 await page.addScriptTag({path:path.resolve('js/modules/monthly-reviews.js')});
 await page.getByRole('button',{name:'Revisiones del mes',exact:true}).click();
 await expect(page.locator('[data-rows]')).toContainText('Fin del descuento: 1/11/2026');
 await expect(page.locator('[data-rows]')).not.toContainText('Cumple un año');
 await page.getByRole('button',{name:'Ver mensaje',exact:true}).click();
 await expect(page.locator('[data-minute] option')).toHaveText(['00','30']);
 await page.locator('[data-text]').fill('Hola Ana. Texto personalizado.');
 await page.locator('[data-date]').fill('2026-10-03');await page.locator('[data-hour]').selectOption('10');await page.locator('[data-minute]').selectOption('30');
 await page.getByRole('button',{name:'Guardar cambios',exact:true}).click();
 await expect(page.locator('.mrBack')).toHaveCount(0);
 expect(await page.evaluate(()=>calls.find(c=>c.name==='crm_edit_monthly_review').args.p_send_at)).toBe('2026-10-03T08:30:00.000Z');
 await page.getByRole('button',{name:'Ver mensaje',exact:true}).click();
 await page.getByRole('button',{name:'Cancelar envío',exact:true}).click();
 await expect(page.locator('[data-rows]')).toContainText('Cancelado');
 expect(await page.evaluate(()=>fixture.status)).toBe('active');
 expect(await page.evaluate(()=>calls.every(c=>['crm_list_monthly_reviews','crm_edit_monthly_review'].includes(c.name)))).toBe(true);
});
test('Review status distinguishes acceptance from confirmed delivery',async({page})=>{
 await page.setContent('<main></main>');await page.addScriptTag({path:path.resolve('js/modules/monthly-reviews.js')});
 expect(await page.evaluate(()=>TPFReviews.sendStatus({send_enabled:true,job_status:'pending',receipt:{idMessage:'accepted'}}))).toBe('Pendiente de confirmar');
 expect(await page.evaluate(()=>TPFReviews.sendStatus({send_enabled:true,job_status:'done',receipt:{idMessage:'confirmed'}}))).toBe('Enviado');
});
