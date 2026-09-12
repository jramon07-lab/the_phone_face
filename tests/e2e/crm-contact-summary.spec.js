const {test,expect}=require('@playwright/test');

for(const late of [false,true])test(`Resumen: ofertas y automatizaciones visibles, montaje ${late?'tardío':'inicial'}`,async({page,request})=>{
 const [script,styles]=await Promise.all([request.get('/js/modules/contact-desktop-layout.js?v=20260912-summary-1'),request.get('/assets/contact-desktop.css?v=20260912-summary-1')]);
 expect(script.ok()).toBeTruthy();expect(styles.ok()).toBeTruthy();
 const dynamic='<section id="cpOffersSection" class="cpSideSection"><div class="cpOfferTitle"><b>Ofertas y seguimiento</b></div><div class="cpOfferList"><button id="testOffer">Oferta conservada</button></div></section><section id="cpAutomationStatus" class="cpSideSection casCard"><div class="casHead"><div><b>Automatizaciones</b><small>2 activas</small></div></div><div class="casMetrics"><span>2 activas</span></div></section>';
 await page.route('**/__contact-summary-fixture',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><style>${stylesText}</style></head><body><div id="contactModal" class="tpfContactDesktop"><div class="contactProfile"><div class="cpTop"><span class="cpNav">Ficha</span></div><div class="cpColumns"><div class="cpLeft"><div class="cpIdentity"><div class="cpQuick"></div></div></div><div class="cpCenter">Historial</div><div class="cpRight">${late?'':dynamic}<section class="cpSideSection"><div id="cpOpportunities">Oportunidad</div></section><section class="cpSideSection"><div id="cpTasks">Tarea</div></section><section class="cpSideSection"><div id="cpWhatsappPrograms">Programados</div></section></div></div></div></div></body></html>`}));
 const stylesText=await styles.text();
 await page.setViewportSize({width:1440,height:1000});await page.goto('/__contact-summary-fixture');
 if(!late)await page.evaluate(()=>{window.offerClicks=0;document.getElementById('testOffer').onclick=()=>window.offerClicks++});
 await page.addScriptTag({content:await script.text()});
 if(late)await page.evaluate(html=>{document.querySelector('.cpRight').insertAdjacentHTML('afterbegin',html);window.offerClicks=0;document.getElementById('testOffer').onclick=()=>window.offerClicks++},dynamic);
 const offers=page.locator('#cpOffersSection'),autos=page.locator('#cpAutomationStatus');
 await expect(page.locator('#cpRefPanel > #cpOffersSection')).toBeVisible();await expect(autos).toBeVisible();
 await page.locator('#testOffer').click();expect(await page.evaluate(()=>window.offerClicks)).toBe(1);
 const panel=await page.locator('#cpRefPanel').boundingBox(),box=await autos.boundingBox();expect(box.width).toBeGreaterThan(panel.width*0.9);
 expect(await autos.locator('.casHead b').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
 await page.locator('#cpRefTab-tareas').click();await expect(offers).toBeHidden();await expect(autos).toBeHidden();
 await page.locator('#cpRefTab-resumen').click();await expect(offers).toBeVisible();await expect(autos).toBeVisible();
 await page.setViewportSize({width:1100,height:900});await expect(offers).toBeVisible();await expect(autos).toBeVisible();
 const narrowOffers=await offers.boundingBox(),narrowAutos=await autos.boundingBox();expect(narrowAutos.y).toBeGreaterThanOrEqual(narrowOffers.y+narrowOffers.height);
 await page.setViewportSize({width:800,height:900});await expect(page.locator('.cpRight > #cpOffersSection')).toBeVisible();
 await page.setViewportSize({width:1440,height:1000});await expect(page.locator('#cpRefPanel > #cpOffersSection')).toBeVisible();
 await page.locator('#testOffer').click();expect(await page.evaluate(()=>window.offerClicks)).toBe(2);
 expect(await offers.count()).toBe(1);expect(await autos.count()).toBe(1);
});
