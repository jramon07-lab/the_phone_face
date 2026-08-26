const fs=require('fs');
// One-shot mapper used only during the physical modular split.
const lines=fs.readFileSync('js/app-core.js','utf8').split(/\r?\n/);
const groups={
  whatsapp:/\b(wa|whatsapp|green)/i,
  agenda:/\bagenda\b/i,
  contacts_sales:/\b(contact|sales|opportun|opp\b|stage\b)/i,
  automations_settings:/\b(automat|settings|configur|notify|google)/i,
  system:/\b(system|status|recordError|unhandledrejection)/i
};
const declaration=/^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/;
const out=[];
for(let i=0;i<lines.length;i++){
  const line=lines[i];
  const m=line.match(declaration);
  if(m){
    const name=m[1]||m[2];
    const matches=Object.entries(groups).filter(([,rx])=>rx.test(name)||rx.test(line)).map(([g])=>g);
    if(matches.length) out.push(`${String(i+1).padStart(6)} | ${matches.join(',')} | ${name} | ${line.trim().slice(0,180)}`);
  }
  if(/^\s*\/\*|^\s*\/\//.test(line) && Object.values(groups).some(rx=>rx.test(line))){
    out.push(`${String(i+1).padStart(6)} | COMMENT | ${line.trim().slice(0,220)}`);
  }
}
fs.writeFileSync('APP_CORE_MAP.txt',out.join('\n')+'\n');
console.log(`MAP_OK lines=${lines.length} matches=${out.length}`);
