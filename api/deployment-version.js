'use strict';
module.exports=function(_req,res){
 res.setHeader('Cache-Control','no-store, max-age=0');
 res.status(200).json({sha:process.env.VERCEL_GIT_COMMIT_SHA||null,environment:process.env.VERCEL_ENV||'development'});
};
