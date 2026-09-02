const ASSETS=Object.freeze({
  tesseract:{
    url:'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
    type:'application/javascript; charset=utf-8'
  },
  worker:{
    url:'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
    type:'application/javascript; charset=utf-8'
  },
  core:{
    url:'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-lstm.wasm.js',
    type:'application/javascript; charset=utf-8'
  },
  spa:{
    url:'https://cdn.jsdelivr.net/npm/@tesseract.js-data/spa@1.0.0/4.0.0_best_int/spa.traineddata.gz',
    type:'application/gzip'
  }
});

module.exports=async function ocrAsset(req,res){
  const method=String(req.method||'GET').toUpperCase();
  if(method!=='GET'&&method!=='HEAD'){
    res.setHeader('Allow','GET, HEAD');
    return res.status(405).json({ok:false,error:'Método no permitido.'});
  }

  const asset=ASSETS[String(req.query?.asset||'')];
  if(!asset)return res.status(404).json({ok:false,error:'Recurso OCR no encontrado.'});

  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),60000);
  try{
    const upstream=await fetch(asset.url,{method:method==='HEAD'?'HEAD':'GET',signal:controller.signal});
    if(!upstream.ok)throw new Error(`Proveedor OCR HTTP ${upstream.status}`);

    res.setHeader('Content-Type',asset.type);
    res.setHeader('Cache-Control','public, max-age=31536000, s-maxage=31536000, immutable');
    res.setHeader('Vercel-CDN-Cache-Control','public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options','nosniff');
    if(method==='HEAD')return res.status(200).end();

    const body=Buffer.from(await upstream.arrayBuffer());
    return res.status(200).send(body);
  }catch(error){
    const timedOut=error?.name==='AbortError';
    return res.status(502).json({
      ok:false,
      error:timedOut?'El recurso OCR tardó demasiado en responder.':'No se pudo cargar el recurso OCR.'
    });
  }finally{
    clearTimeout(timeout);
  }
};

module.exports.ASSETS=ASSETS;
