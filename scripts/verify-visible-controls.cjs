const fs=require('node:fs');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1366,height:768}});
 await page.setContent('<body class="wa-fullscreen-mode"><section id="view-whatsapplive"><header class="waChatHeader"><button id="waArchiveChat">⌄</button></header></section></body>');
 await page.addStyleTag({content:fs.readFileSync('assets/app.css','utf8')});
 await page.addScriptTag({content:`let waLiveState={selected:{id:'demo'}};const meta={archived:false};window.waMeta=()=>meta;window.waMetaAll=()=>({});window.waMetaSave=(_id,patch)=>Object.assign(meta,patch);window.waTrackDirection=()=>{};window.waRefreshChatTopButtons=()=>{};window.TPFModules={register(_n,d){d.install()}};`});
 await page.addScriptTag({content:fs.readFileSync('js/modules/whatsapp-archive-sync.js','utf8')});
 const archive=page.locator('#waArchiveChat');
 assert.equal(await archive.innerText(),'✓ Archivar conversación');
 assert.equal(await archive.isVisible(),true);
 await archive.click();
 assert.equal(await archive.innerText(),'↥ Desarchivar');
 await page.locator('#waArchiveUndo button').click();
 assert.equal(await archive.innerText(),'✓ Archivar conversación');
 await archive.click();await archive.click();
 assert.equal(await archive.innerText(),'✓ Archivar conversación');
 await page.addScriptTag({content:fs.readFileSync('js/modules/automation-control-center.js','utf8')});
 await page.evaluate(()=>window.TPFAutomationControlCenter.open());
 assert.equal(await page.locator('#ccClose').isVisible(),true);
 await page.evaluate(()=>{document.getElementById('ccRows').style.height='2500px';document.getElementById('ccPanel').scrollTop=600});
 const box=await page.locator('#ccClose').boundingBox();
 assert.ok(box&&box.y>=0&&box.y<150,'Volver must remain in viewport in WhatsApp fullscreen');
 await page.screenshot({path:'/workspace/scratch/53929f4a8094/visible-controls-check.png'});
 await page.locator('#ccClose').click();
 assert.equal(await page.locator('#ccPanel').count(),0);
 console.log('PASS: visible Archive, Desarchivar, Undo, fullscreen Back, sticky Back and close (isolated browser, no real sends)');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
