const {test,expect}=require('@playwright/test');
for(const variant of ['baseline','sales'])test('1.200 oportunidades aisladas: '+variant,async({browser},info)=>{
 const results=[];
 const contexts=await Promise.all([browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'}),browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'})]);
 try{await Promise.all(contexts.map(async(context,index)=>{
  const forbidden=[];
  await context.route('**/*',route=>{const req=route.request();if(!req.url().startsWith('http://127.0.0.1:4174/')||req.method()!=='GET'){forbidden.push(req.url());return route.abort()}return route.continue()});
  const page=await context.newPage();await page.goto('http://127.0.0.1:4174/');
  const renderMs=await page.evaluate(()=>window.seed(1200));
  await expect(page.locator('#salesBoard .opp')).toHaveCount(1200);
  await page.addScriptTag({url:'http://127.0.0.1:4174/'+variant+'.js'});
  const installMs=await page.evaluate(()=>{const t=performance.now();window.salesModule.install();return performance.now()-t});
  const scans=await page.evaluate(()=>window.scanCount);await page.waitForTimeout(3200);
  const idleScans=await page.evaluate(start=>window.scanCount-start,scans);
  const searchStart=Date.now();await page.locator('#tpfSalesSearch').fill('FICTICIA 1199');
  await expect(page.locator('#salesBoard .opp:visible')).toHaveCount(1);
  const searchMs=Date.now()-searchStart;
  await page.locator('#salesBoard .opp:visible').click();expect(await page.evaluate(()=>window.opened)).toEqual(['lab-1199']);
  if(variant==='baseline')await page.locator('#tpfSalesSearch').fill('');
  await page.locator('[data-opp-id="lab-1199"] .oppFooter select').selectOption('stage-0');
  await expect(page.locator('.stage[data-stage="stage-0"] > .opp[data-opp-id="lab-1199"]')).toHaveCount(1);
  await expect(page.locator('#salesBoard .opp')).toHaveCount(1200);
  if(variant==='sales'){
   expect(idleScans).toBe(0);
   await expect(page.locator('#salesBoard .opp:visible')).toHaveCount(1);
   await page.locator('.opp[data-opp-id="lab-1199"] .oppMenu').click();
   await expect(page.locator('.tpfSalesMenu')).toBeVisible();
   await page.getByRole('button',{name:'Abrir ficha',exact:true}).click();
   expect(await page.evaluate(()=>window.opened)).toEqual(['lab-1199','lab-1199']);
  }else expect(idleScans).toBeGreaterThan(0);
  expect(forbidden).toEqual([]);results.push({session:index+1,renderMs:Math.round(renderMs),installMs:Math.round(installMs),searchMs,idleScans,opportunities:1200,externalRequests:forbidden.length});
 }));}finally{await Promise.all(contexts.map(c=>c.close()))}
 console.log('LOAD_RESULT '+variant+' '+JSON.stringify(results));await info.attach('metrics-'+variant,{body:JSON.stringify(results,null,2),contentType:'application/json'});
});
