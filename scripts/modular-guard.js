const fs = require('fs');

const requiredFiles = [
  'index.html',
  'vercel.json',
  'api/index.js',
  'api/green.js',
  'api/green-health.js',
  'api/health.js',
  'tests/e2e/crm-smoke.spec.js',
  'tests/e2e/crm-functional.spec.js',
  'tests/e2e/crm-green-health.spec.js',
  'tests/e2e/crm-system-status.spec.js'
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

if (fs.existsSync('index.html')) {
  const html = fs.readFileSync('index.html', 'utf8');
  const markers = [
    'tpfWaTemplatesNav',
    'tpfAutomationAdvancedBar',
    'data-view="system"',
    'view-system'
  ];
  for (const marker of markers) {
    if (!html.includes(marker)) {
      console.error(`MODULAR_GUARD_FAIL: Falta marcador ${marker}`);
      failed = true;
    } else {
      console.log(`MODULAR_GUARD_OK: Marcador presente ${marker}`);
    }
  }
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

if (failed) process.exit(1);
console.log('MODULAR_GUARD_OK: estructura crítica modular válida');
