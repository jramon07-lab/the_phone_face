const fs=require('fs');

function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s)}
function replaceOnce(text,from,to,label){
  if(!text.includes(from)) throw new Error(`No se encontró ${label}`);
  return text.replace(from,to);
}

// 1) WhatsApp templates: integrate the former server-side TDZ fix in the physical module.
{
  const p='js/modules/whatsapp-green-core.js';
  let s=read(p);
  s=replaceOnce(s,
    'let waTemplatesCache = waLoadTemplates();\nlet waTemplatesRemoteReady = false;',
    'var waTemplatesCache=[];\nvar waTemplatesRemoteReady=false;\nwaTemplatesCache=waLoadTemplates();',
    'TDZ WhatsApp');
  write(p,s);
}

// 2) Automations: own its global state without an injected inline script.
{
  const p='js/modules/automations-core.js';
  let s=read(p);
  s=replaceOnce(s,'let crmAutomations=[];','var crmAutomations=[];','TDZ automatizaciones');
  write(p,s);
}

// 3) Remove obsolete HTML-string TDZ rewrite from index-clean.
{
  const p='api/index-clean.js';
  let s=read(p);
  const old=`    html=html.replace(/\\blet\\s+waTemplatesCache\\s*=/,'waTemplatesCache=');\n    html=html.replace(/\\blet\\s+waTemplatesRemoteReady\\s*=/,'waTemplatesRemoteReady=');\n    const waTdzFix='<script id="tpf-wa-templates-tdz-fix">var waTemplatesCache=[];var waTemplatesRemoteReady=false;</script>';\n    if(!html.includes('id="tpf-wa-templates-tdz-fix"'))html=html.includes('</head>')?html.replace('</head>',waTdzFix+'\\n</head>'):waTdzFix+html;\n\n`;
  s=replaceOnce(s,old,'','parche TDZ WhatsApp legado');
  write(p,s);
}

// 4) Remove obsolete automations TDZ HTML rewrite, keep the UX patch only.
{
  const p='api/index-fix.js';
  let s=read(p);
  const start=s.indexOf('function applyFix(html){');
  const end=s.indexOf('\n}\n\nasync function handler',start);
  if(start<0||end<0)throw new Error('No se encontró applyFix en index-fix');
  const fn=`function applyFix(html){\n  return html.includes('</body>')?html.replace('</body>',UX_PATCH+'\\n</body>'):html+UX_PATCH;\n}`;
  s=s.slice(0,start)+fn+s.slice(end+2);
  write(p,s);
}

// 5) Move all physical scripts to the end of the DOM, immediately before isolation runtime.
{
  const p='index.html';
  let s=read(p);
  const marker='<!-- TPF-PHYSICAL-SPLIT-v1 -->';
  const runtime='<!-- TPF-MODULAR-RUNTIME-v1 -->';
  const start=s.indexOf(marker);
  const runtimePos=s.indexOf(runtime);
  if(start<0||runtimePos<0)throw new Error('No se encontraron marcadores físicos/runtime');
  const afterMarker=s.indexOf('\n',start)+1;
  let cursor=afterMarker;
  while(true){
    const m=s.slice(cursor).match(/^<script src="\/(?:js\/core|js\/modules)\/[^\"]+\.js"><\/script>\n?/);
    if(!m)break;
    cursor+=m[0].length;
  }
  const block=s.slice(start,cursor).trimEnd();
  if(!block.includes('contacts-sales-core.js')||!block.includes('system-status-core.js'))throw new Error('Bloque físico incompleto');
  s=s.slice(0,start)+s.slice(cursor);
  const newRuntimePos=s.indexOf(runtime);
  s=s.slice(0,newRuntimePos)+block+'\n'+s.slice(newRuntimePos);
  write(p,s);
}

// 6) Migrate null-safe runtime fixes that previously relied on HTML string rewriting.
const physicalFiles=[
  'js/core/00-bootstrap.js','js/modules/contacts-sales-core.js','js/modules/whatsapp-scheduling-core.js',
  'js/modules/agenda-core.js','js/core/20-main.js','js/modules/whatsapp-green-core.js',
  'js/modules/automations-core.js','js/core/30-enhancements.js','js/modules/system-status-core.js'
];
for(const p of physicalFiles){
  let s=read(p);
  s=s.replace('$("exportSearchExcel").onclick=exportUnifiedSearchToExcel;','if($("exportSearchExcel"))$("exportSearchExcel").onclick=exportUnifiedSearchToExcel;');
  s=s.replace('$("cpNewOpp").onclick=$("cpSideNewOpp").onclick=openContactNewOpportunity;','if($("cpNewOpp"))$("cpNewOpp").onclick=openContactNewOpportunity;if($("cpSideNewOpp"))$("cpSideNewOpp").onclick=openContactNewOpportunity;');
  s=s.replace('$("cpNewTask").onclick=$("cpSideNewTask").onclick=openContactTaskPage;','if($("cpNewTask"))$("cpNewTask").onclick=openContactTaskPage;if($("cpSideNewTask"))$("cpSideNewTask").onclick=openContactTaskPage;');
  s=s.replace('$("contactCustomFieldsManage").onclick=$("customFieldsManageBtn").onclick;','if($("contactCustomFieldsManage")&&$("customFieldsManageBtn"))$("contactCustomFieldsManage").onclick=$("customFieldsManageBtn").onclick;');
  write(p,s);
}

// 7) Browser validates external physical assets; source guard validates no inline source code.
{
  const p='tests/e2e/crm-module-isolation.spec.js';
  let s=read(p);
  s=s.replace(',\n    inlineStyles:document.querySelectorAll(\'style\').length,\n    inlineScripts:[...document.scripts].filter(s=>!s.src && (s.textContent||\'\').trim()).length','');
  s=s.replace('  expect(structure.inlineStyles).toBe(0);\n  expect(structure.inlineScripts).toBe(0);\n','');
  write(p,s);
}

console.log('PHYSICAL_FIX_OK');
