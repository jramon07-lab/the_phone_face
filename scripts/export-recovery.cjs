#!/usr/bin/env node
'use strict';
// Run from a trusted machine with PostgreSQL client tools and libpq PG* environment variables.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
function run(command,args,options={}){const result=spawnSync(command,args,{encoding:'utf8',env:{...process.env,PGSSLMODE:process.env.PGSSLMODE||'require'},maxBuffer:16*1024*1024,...options});if(result.error||result.status!==0)throw Error(command+' no terminó correctamente. Revisa el acceso y la versión de las herramientas PostgreSQL.');return result.stdout?.trim();}
function main(){
 const destination=process.env.CRM_RECOVERY_DIRECTORY;if(!destination)throw Error('Indica CRM_RECOVERY_DIRECTORY fuera del repositorio.');
 const repo=run('git',['rev-parse','--show-toplevel']),out=path.resolve(destination);
 if(out===repo||out.startsWith(repo+path.sep))throw Error('La copia privada debe guardarse fuera del repositorio.');
 if(run('git',['status','--porcelain']))throw Error('Guarda primero los cambios de código en Git.');
 if(!process.env.PGHOST||!process.env.PGDATABASE||!process.env.PGUSER)throw Error('Configura PGHOST, PGDATABASE y PGUSER. Usa PGPASSFILE o PGPASSWORD para la contraseña.');
 const folder=path.join(out,'crm-recovery-'+new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(folder,{recursive:true,mode:0o700});
 run('git',['archive','--format=zip','--output='+path.join(folder,'codigo.zip'),'HEAD']);
 run('pg_dump',['--format=custom','--file='+path.join(folder,'database.dump')]);
 run('pg_dumpall',['--roles-only','--no-role-passwords','--file='+path.join(folder,'roles.sql')]);
 run('pg_restore',['--list',path.join(folder,'database.dump')]);
 const files={};for(const name of ['codigo.zip','database.dump','roles.sql']){const file=path.join(folder,name);fs.chmodSync(file,0o600);files[name]={bytes:fs.statSync(file).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};}
 fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify({format:'crm-recovery-v1',created_at:new Date().toISOString(),commit:run('git',['rev-parse','HEAD']),files,restoreTested:false,separate:['Valores privados de configuración y clave CRM_BACKUP_ENCRYPTION_KEY','Objetos de Storage: los bytes no están en el volcado SQL','Documentos externos de Google Drive','Configuración de Auth, webhooks, dominios y tareas programadas del proveedor']},null,2),{mode:0o600});
 console.log('Exportación creada. Aún requiere restauración de prueba: '+folder);
}
if(require.main===module)try{main()}catch(e){console.error(e.message);process.exitCode=1;}
module.exports={main};
