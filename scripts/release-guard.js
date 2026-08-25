const fs = require('fs');

function fail(msg){
  console.error('RELEASE_GUARD_FAIL:', msg);
  process.exitCode = 1;
}
function ok(msg){ console.log('RELEASE_GUARD_OK:', msg); }

const requiredFiles = ['vercel.json','api/index-clean.js','api/index-fix.js','api/health.js','api/smoke.js','CRM_WORKFLOW_LOCK.md'];
for (const f of requiredFiles){
  if(!fs.existsSync(f)) fail(`Falta ${f}`); else ok(`Existe ${f}`);
}

if(fs.existsSync('vercel.json')){
  const raw = fs.readFileSync('vercel.json','utf8');
  let cfg;
  try { cfg = JSON.parse(raw); } catch(e){ fail('vercel.json no es JSON válido'); }
  if(cfg){
    const rewrites = Array.isArray(cfg.rewrites) ? cfg.rewrites : [];
    const root = rewrites.find(r => r && r.source === '/');
    if(!root) fail('No existe rewrite para /');
    else if(root.destination !== '/api/index-clean') fail(`La raíz apunta a ${root.destination}, debe apuntar a /api/index-clean`);
    else ok('La raíz apunta a /api/index-clean');
  }
}

if(fs.existsSync('api/index-clean.js')){
  const s = fs.readFileSync('api/index-clean.js','utf8');
  const markers = [
    'tpf-menu-clean-v2',
    'tpf-entry-unique-v2',
    'tpfWaTemplatesNav',
    'tpfAutomationAdvancedBar',
    'function waDefaultTemplates(){return []}',
    "X-TPF-Menu",
    "X-TPF-Entry"
  ];
  for(const m of markers){
    if(!s.includes(m)) fail(`Falta marcador crítico en index-clean.js: ${m}`);
    else ok(`Marcador presente: ${m}`);
  }

  for(const sheet of ['LIQUIDACION','DATA','CLAWBACK','AJUSTES']){
    if(!s.includes(`data-sheet=\\\"${sheet}\\\"`) && !s.includes(`data-sheet=\"${sheet}\"`)){
      fail(`No se controla la ocultación de ${sheet}`);
    } else ok(`Ocultación controlada: ${sheet}`);
  }
}

if(fs.existsSync('api/index-fix.js')){
  const s = fs.readFileSync('api/index-fix.js','utf8');
  if(!s.includes('tpf-fix-3-points-v1')) fail('No aparece el marcador del parche WhatsApp validado');
  else ok('Parche WhatsApp validado preservado');
}

if(!process.exitCode) console.log('RELEASE_GUARD_PASS');
