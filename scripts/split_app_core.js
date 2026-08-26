const fs=require('fs');
const path=require('path');

// One-shot physical split; keeps the original execution order exactly.
const sourcePath=path.join(process.cwd(),'js','app-core.js');
const indexPath=path.join(process.cwd(),'index.html');
const source=fs.readFileSync(sourcePath,'utf8');
let html=fs.readFileSync(indexPath,'utf8');

const anchors=[
  ['contactSales','let currentContact=null;'],
  ['whatsappScheduling','function openWhatsappProgramsView(prefill=null){'],
  ['agenda','function fmtAgendaDate(value){'],
  ['adminMain','const PERM_LABELS={'],
  ['whatsappGreen','/* ===== WhatsApp GREEN-API ===== */'],
  ['automations','/* ===== Motor de Automatizaciones CRM v2 ===== */'],
  ['enhancements','/* ===== Campos personalizados de Contactos ===== */'],
  ['systemStatus',"(function(){\n  const KEY='tpf_system_errors_v1';"]
];

const pos={};
for(const [name,needle] of anchors){
  const idx=source.indexOf(needle);
  if(idx<0) throw new Error(`No se encontró anchor ${name}: ${needle}`);
  pos[name]=idx;
}
const order=anchors.map(([n])=>n);
for(let i=1;i<order.length;i++){
  if(pos[order[i]]<=pos[order[i-1]]) throw new Error(`Orden inválido: ${order[i-1]} -> ${order[i]}`);
}

const chunks=[
  ['js/core/00-bootstrap.js',0,pos.contactSales],
  ['js/modules/contacts-sales-core.js',pos.contactSales,pos.whatsappScheduling],
  ['js/modules/whatsapp-scheduling-core.js',pos.whatsappScheduling,pos.agenda],
  ['js/modules/agenda-core.js',pos.agenda,pos.adminMain],
  ['js/core/20-main.js',pos.adminMain,pos.whatsappGreen],
  ['js/modules/whatsapp-green-core.js',pos.whatsappGreen,pos.automations],
  ['js/modules/automations-core.js',pos.automations,pos.enhancements],
  ['js/core/30-enhancements.js',pos.enhancements,pos.systemStatus],
  ['js/modules/system-status-core.js',pos.systemStatus,source.length]
];

for(const [file,start,end] of chunks){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const body=source.slice(start,end).trim()+"\n";
  if(!body.trim()) throw new Error(`Chunk vacío: ${file}`);
  fs.writeFileSync(file,`/* TPF physical module split · generated from app-core.js */\n${body}`);
}

const tags=chunks.map(([file])=>`<script src="/${file}"></script>`).join('\n');
if(!html.includes('<script src="/js/app-core.js"></script>')) throw new Error('index.html no contiene app-core.js');
html=html.replace('<script src="/js/app-core.js"></script>',`<!-- TPF-PHYSICAL-SPLIT-v1 -->\n${tags}`);
fs.writeFileSync(indexPath,html);

console.log('SPLIT_OK');
for(const [file,start,end] of chunks) console.log(`${file}: ${end-start} bytes`);
