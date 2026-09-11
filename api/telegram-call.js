'use strict';

module.exports=function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'Método no permitido'});
  const phone=String(req.query?.phone||'').trim();
  if(!/^\+[1-9]\d{7,14}$/.test(phone))return res.status(400).json({ok:false,error:'Teléfono no válido'});
  res.setHeader('Location',`tel:${phone}`);
  return res.status(302).end();
};
