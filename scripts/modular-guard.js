const fs = require('fs');

const requiredFiles = [
  'index.html',
  'assets/app.css',
  'vercel.json',
  'api/index.js',
  'api/green.js',
  'api/green-health.js',
  'api/health.js',
  'js/core/00-bootstrap.js',
  'js/core/20-main.js',
  'js/core/30-enhancements.js',
  'js/modules/runtime.js',
  'js/modules/contacts-sales-core.js',
  'js/modules/contacts-sales.js',
  'js/modules/whatsapp-scheduling-core.js',
  'js/modules/whatsapp-green-core.js',
  'js/modules/whatsapp.js',
  'js/modules/agenda-core.js',
  'js/modules/agenda.js',
  'js/modules/automations-core.js',
  'js/modules/automations-settings.js',
  'js/modules/system-status-core.js',
  'js/modules/system-status.js',
  'tests/e2e/crm-module-isolation.spec.js',
  'tests/e2e/crm-smoke.spec.js',
  'tests/e2e/crm-functional.spec.js',
  'tests/e2e/crm-green-health.spec.js',
  'tests/e2e/crm-system-status.spec.js',
  'tests/e2e/crm-visual.spec.js'
];

let failed = false;
for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    console.error(`MODULAR_GUARD_FAIL: Falta ${file}`);
    failed = true;
  } else {
    console.log(`MODULAR_GUARD_OK: Existe ${file}`);
  }
}

const sourceFiles = ['index.html', 'api/index.js', 'tests/e2e/crm-visual.spec.js'];
const uiSource = sourceFiles
  .filter(fs.existsSync)
  .map(file => fs.readFileSync(file, 'utf8'))
  .join('\n');

const uiMarkers = [
  'TPF-PHYSICAL-SPLIT-v1',
  'TPF-MODULAR-RUNTIME-v1',
  'tpfWaTemplatesNav',
  'tpfAutomationAdvancedBar',
  'data-view="system"',
  'view-system'
];
for (const marker of uiMarkers) {
  if (!uiSource.includes(marker)) {
    console.error(`MODULAR_GUARD_FAIL: Falta marcador funcional ${marker}`);
    failed = true;
  } else {
    console.log(`MODULAR_GUARD_OK: Marcador funcional presente ${marker}`);
  }
}

if (fs.existsSync('index.html')) {
  const html=fs.readFileSync('index.html','utf8');
  if (/<style(?:\s|>)/i.test(html)) {
    console.error('MODULAR_GUARD_FAIL: index.html vuelve a contener CSS inline');
    failed=true;
  } else console.log('MODULAR_GUARD_OK: index.html sin CSS inline');
  if (/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/i.test(html)) {
    console.error('MODULAR_GUARD_FAIL: index.html vuelve a contener JavaScript inline');
    failed=true;
  } else console.log('MODULAR_GUARD_OK: index.html sin JavaScript inline');
  if (html.includes('/js/app-core.js')) {
    console.error('MODULAR_GUARD_FAIL: index.html todavía carga app-core.js monolítico');
    failed=true;
  } else console.log('MODULAR_GUARD_OK: index.html carga módulos físicos');
  const splitPos=html.indexOf('TPF-PHYSICAL-SPLIT-v1');
  const runtimePos=html.indexOf('TPF-MODULAR-RUNTIME-v1');
  if(splitPos<0||runtimePos<0||splitPos>runtimePos){
    console.error('MODULAR_GUARD_FAIL: orden físico/runtime inválido');
    failed=true;
  }else console.log('MODULAR_GUARD_OK: módulos físicos cargan antes del runtime de aislamiento');
}

if (fs.existsSync('api/green.js')) {
  const green = fs.readFileSync('api/green.js', 'utf8');
  const safetyMarkers = ['sendMessage', 'getStateInstance', 'getSettings'];
  for (const marker of safetyMarkers) {
    if (!green.includes(marker)) {
      console.error(`MODULAR_GUARD_FAIL: GREEN sin ${marker}`);
      failed = true;
    } else {
      console.log(`MODULAR_GUARD_OK: GREEN conserva ${marker}`);
    }
  }
}

if (fs.existsSync('api/index.js')) {
  const indexApi=fs.readFileSync('api/index.js','utf8');
  if(!indexApi.includes('VERCEL_GIT_COMMIT_SHA') || !indexApi.includes("path.join(__dirname,'..','index.html')")){
    console.error('MODULAR_GUARD_FAIL: api/index.js no sirve el commit desplegado/local index');
    failed=true;
  }else{
    console.log('MODULAR_GUARD_OK: api/index.js usa el índice del despliegue actual');
  }
}

for(const [file,legacyMarker] of [
  ['api/index-clean.js','tpf-wa-templates-tdz-fix'],
  ['api/index-fix.js','tpf-crm-automations-tdz-fix']
]){
  if(fs.existsSync(file)){
    const src=fs.readFileSync(file,'utf8');
    if(src.includes(legacyMarker)){
      console.error(`MODULAR_GUARD_FAIL: ${file} conserva parche legado ${legacyMarker}`);
      failed=true;
    }else console.log(`MODULAR_GUARD_OK: ${file} sin parche TDZ legado`);
  }
}

if (failed) process.exit(1);
console.log('MODULAR_GUARD_OK: estructura física modular válida');
