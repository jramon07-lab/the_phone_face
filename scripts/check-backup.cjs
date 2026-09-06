#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),B=require('../lib/crm-backup-core');
const file=process.argv[2];
if(!file||!process.env.CRM_BACKUP_ENCRYPTION_KEY){console.error('Uso: CRM_BACKUP_ENCRYPTION_KEY configurada en el entorno, node scripts/check-backup.cjs archivo.tpfbak');process.exit(1);}
try{const data=B.validate(B.decode(fs.readFileSync(file),process.env.CRM_BACKUP_ENCRYPTION_KEY));console.log(JSON.stringify({format:data.format,created_at:data.created_at,counts:data.counts,coverage:data.coverage||'legacy-partial',integrity:'valid',restoreTested:false},null,2));}catch(e){console.error('No se ha validado la copia: '+e.message);process.exit(1);}
