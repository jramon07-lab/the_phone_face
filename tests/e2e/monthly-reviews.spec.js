const {test,expect}=require('@playwright/test');
const path=require('node:path');
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
