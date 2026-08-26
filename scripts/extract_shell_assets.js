const fs = require('fs');
const path = require('path');

// One-shot extractor for the modular branch: preserve order, move only shell assets.
const indexPath = path.join(process.cwd(), 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const styleBlocks = [];
html = html.replace(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi, (_, css) => {
  styleBlocks.push(css.trim());
  return '';
});

if (!styleBlocks.length) throw new Error('No se encontraron bloques <style> para extraer');

const inlineScripts = [];
let firstInlineMarkerPlaced = false;
html = html.replace(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi, (full, attrs, js) => {
  if (!js.trim()) return '';
  inlineScripts.push(js.trim());
  if (!firstInlineMarkerPlaced) {
    firstInlineMarkerPlaced = true;
    return '<script src="/js/app-core.js"></script>';
  }
  return '';
});

if (!inlineScripts.length) throw new Error('No se encontraron scripts inline para extraer');

if (!/assets\/app\.css/.test(html)) {
  html = html.replace('</head>', '<link rel="stylesheet" href="/assets/app.css">\n</head>');
}

fs.mkdirSync(path.join(process.cwd(), 'assets'), { recursive: true });
fs.mkdirSync(path.join(process.cwd(), 'js'), { recursive: true });
fs.writeFileSync(path.join(process.cwd(), 'assets/app.css'), styleBlocks.join('\n\n/* ---- bloque extraído ---- */\n\n') + '\n');
fs.writeFileSync(path.join(process.cwd(), 'js/app-core.js'), inlineScripts.join('\n\n/* ---- script inline extraído ---- */\n\n') + '\n');
fs.writeFileSync(indexPath, html);

console.log(`EXTRACT_OK styles=${styleBlocks.length} scripts=${inlineScripts.length}`);
console.log(`INDEX_BYTES=${Buffer.byteLength(html)} CSS_BYTES=${Buffer.byteLength(styleBlocks.join('\n'))} JS_BYTES=${Buffer.byteLength(inlineScripts.join('\n'))}`);
