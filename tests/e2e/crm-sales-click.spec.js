const {test,expect}=require('@playwright/test');
const fs=require('node:fs');

test('Tablero aislado: nombres largos y selección de columna con clic normal',async({page})=>{
 // Uses production CSS with synthetic markup; no login, requests or data writes.
 await page.route('**/*',r=>r.abort());
 await page.setViewportSize({width:1440,height:700});
 await page.setContent('<section id="view-sales"><div class="salesBoardPage"><div class="salesBoardViewport"><div class="salesNavWrap"><div id="salesScroll"><div class="board" id="salesBoard"></div></div></div></div></div></section>');
 await page.addStyleTag({content:fs.readFileSync('assets/app.css','utf8')});
 for(const path of ['js/modules/sales-fullscreen-ui.js','js/modules/contacts-sales.js']){
  const css=fs.readFileSync(path,'utf8').match(/s\.textContent=`([\s\S]*?)`;/)?.[1];
  expect(css,'Must use the actual sales module styles').toBeTruthy();await page.addStyleTag({content:css});
 }
 await page.evaluate(()=>{
  window.testOpened=[];
  document.querySelector('#salesBoard').innerHTML=Array.from({length:8},(_,i)=>`<div class="stage"><div class="stageHead"><div class="stageTitleWrap"><div class="stageTitle">Etapa ${i}</div><div class="stageMeta">5 oportunidades</div><label class="stageSelectAllLabel"><input type="checkbox" class="stageSelectAll">Seleccionar todas</label></div><button class="stageMenu">•••</button></div>${Array.from({length:5},(_,j)=>`<div class="opp" data-opp-id="${i}-${j}"><div class="oppTop"><div class="oppTitle">Oportunidad de validación</div><button class="oppMenu">•••</button></div><div class="oppInfo"><div><span class="label">Cliente:</span> <button type="button" class="salesClientLink" onclick="window.testOpened.push('${i}-${j}')">Integral 1788706822979 Titular Demo Con Apellidos Largos</button></div><div>DEMO12345</div></div><div class="oppFooter"><b>12,34 €</b><select><option>Etapa</option></select></div></div>`).join('')}</div>`).join('');
 });
 for(const id of ['0-0','0-4','7-4']){
  const link=page.locator(`[data-opp-id="${id}"] .salesClientLink`);
  await link.click();await expect.poll(()=>page.evaluate(()=>window.testOpened.at(-1))).toBe(id);
 }
 const selected=page.locator('.stageSelectAll').last();await selected.check();await expect(selected).toBeChecked();await selected.uncheck();
});
