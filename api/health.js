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
    timestamp:new Date().toISOString()
  });
};
