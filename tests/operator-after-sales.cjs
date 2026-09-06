const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const sql=fs.readFileSync(root+'/db/proposals/operator-after-sales-masmovil-yoigo.sql','utf8');
for(const operator of ['MásMóvil','Yoigo']){
  assert.match(sql,new RegExp(`TRAMITACIÓN · '\\|\\|target\\.operator`));
  assert.match(sql,new RegExp(`POSVENTA · '\\|\\|target\\.operator`));
  assert.match(sql,new RegExp(`RENOVACIÓN · '\\|\\|target\\.operator`));
}
assert.match(sql,/\('MásMóvil','masmovil'\),\('Yoigo','yoigo'\)/);
assert.match(sql,/permanencias elevadas de 24, 36 o 48 meses/);
assert.match(sql,/REVISIÓN /);
assert.match(sql,/'value',1,'unit','years'/);
assert.match(sql,/'unit','months','value',11/);
assert.ok((sql.match(/'business_schedule','phone_house'/g)||[]).length>=2,'day-one and three-month sends use business hours');
assert.match(sql,/No crea ejecuciones retroactivas/);
assert.doesNotMatch(sql,/Netflix/i);
console.log('PASS: MásMóvil and Yoigo after-sales rules are declared without retroactive jobs.');
