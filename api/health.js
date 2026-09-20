const CANONICAL_ORIGIN='https://the-phone-face-app-whatsapp-fotos-y.vercel.app';
const {stableOrigin}=require('../lib/telegram-agenda-core');
function origin(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.origin:null;}catch(_){return null;}}
function telegramOrigin(value){try{return stableOrigin(value);}catch(_){return null;}}
module.exports=function(req,res){
  const commit=String(process.env.VERCEL_GIT_COMMIT_SHA||'local');
  const branch=String(process.env.VERCEL_GIT_COMMIT_REF||'unknown');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.status(200).json({
    ok:true,
    app:'The Phone Face CRM',
    branch,
    commit,
    short_commit:commit.slice(0,8),
    deployment_id:process.env.VERCEL_DEPLOYMENT_ID||null,
    environment:process.env.VERCEL_ENV||null,
    service_origins:{
      canonical:CANONICAL_ORIGIN,
      telegram:telegramOrigin(process.env.CRM_STABLE_ORIGIN),
      google_contacts:origin(process.env.CRM_GOOGLE_CONTACTS_ORIGIN||CANONICAL_ORIGIN),
      google_drive_backups:origin(process.env.GOOGLE_DRIVE_BACKUP_REDIRECT_URI||CANONICAL_ORIGIN),
      google_drive_documents:origin(process.env.CRM_DOCUMENTS_ORIGIN||'https://the-phone-face-app-whatsapp-git-4c8eb2-jramon-07-2402s-projects.vercel.app')
    },
    timestamp:new Date().toISOString()
  });
};
