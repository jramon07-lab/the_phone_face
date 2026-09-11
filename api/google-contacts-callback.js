module.exports=async function(req,res){req.query={...(req.query||{}),action:'callback'};return require('./google-contacts')(req,res);};
