const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../js/mobile-ocr.js'),'utf8');
const appSource=fs.readFileSync(path.join(__dirname,'../js/mobile-app.js'),'utf8');
assert.match(appSource,/state\.ocrDebugText=String\(result\.rawText\|\|''\)\.trim\(\)\.slice\(0,6000\)/);
assert.match(appSource,/const ocrDetails=state\.ocrDebugText\?/);
assert.doesNotMatch(appSource,/const ocrDetails=!contact\.dni/);

function harness(texts,{failSecond=false,failFormEncode=false,pngFormEncodeFails=false}={}){
  const calls={blobs:[],canvases:[],closed:0,draws:[],recognize:[],parameters:[],terminated:0,workers:0};
  let logger=()=>{};
  const worker={
    async setParameters(value){calls.parameters.push(value);},
    async recognize(input,options,output){
      const index=calls.recognize.length;
      calls.recognize.push({input,options,output});
      logger({status:'recognizing text',progress:0});
      logger({status:'recognizing text',progress:1});
      if(index===1&&failSecond)throw new Error('fallo controlado del recorte');
      return {data:{text:texts[index]||''}};
    },
    async terminate(){calls.terminated+=1;}
  };
  const document={
    documentElement:{dataset:{}},
    createElement(tag){
      assert.equal(tag,'canvas');
      const canvas={
        width:0,height:0,
        getContext(){return {fillStyle:'',imageSmoothingEnabled:false,imageSmoothingQuality:'',fillRect(){},drawImage(...args){calls.draws.push(args);}};},
        toBlob(callback,type,quality){
          const canvasIndex=calls.canvases.indexOf(canvas);
          calls.blobs.push({canvasIndex,type,quality});
          const fail=canvasIndex===1&&(failFormEncode||(pngFormEncodeFails&&type==='image/png'));
          callback(fail?null:new Blob([type],{type}));
        }
      };
      calls.canvases.push(canvas);
      return canvas;
    }
  };
  const api={
    OEM:{LSTM_ONLY:1},PSM:{AUTO:'3',SINGLE_BLOCK:'6'},
    async createWorker(_language,_oem,options){calls.workers+=1;logger=options.logger;return worker;}
  };
  const context={
    window:{Tesseract:api},document,Blob,File,Date,Promise,URL,
    console:{warn(){}},
    createImageBitmap:async()=>({width:1080,height:1440,close(){calls.closed+=1;}})
  };
  vm.createContext(context);
  vm.runInContext(source,context);
  return {ocr:context.window.TPFMobileOCR,calls};
}

const iphoneRaw=`
Agents x +
G *% agents.masstack.com/myCRM/sub:
MultiMarca [1
Q BÚSQUEDA
MARIA VANESA CORTES
Y GC25041122282164
< Datos compartidos
`;
const formRaw=`
Criterio
Msisdn/Fijo
Documento
431619308
Msisdn/Fijo
858718773
`;
const completeRaw=`${formRaw}
BÚSQUEDA
MARIA VANESA CORTES
Datos compartidos
`;

(async()=>{
  const file=new File(['photo'],'contacto.jpeg',{type:'image/jpeg',lastModified:1});
  const progress=[];
  const {ocr,calls}=harness([iphoneRaw,formRaw]);
  const result=await ocr.recognize(file,event=>progress.push(event.progress));

  assert.equal(result.dni,'43161930S');
  assert.equal(result.phone,'858718773');
  assert.equal(result.fullName,'Maria Vanesa Cortes');
  assert.equal(result.first,'Maria');
  assert.equal(result.last,'Vanesa Cortes');
  assert.match(result.rawText,/LECTURA GENERAL \(PSM3\)/);
  assert.match(result.rawText,/LECTURA FORMULARIO \(PSM6\)/);
  assert.equal(calls.workers,1);
  assert.equal(calls.recognize.length,2);
  assert.equal(calls.recognize[0].input.name,'contacto.jpg');
  assert.notStrictEqual(calls.recognize[0].input,calls.recognize[1].input);
  assert.equal(calls.recognize[1].input.name,'contacto-formulario.png');
  assert.ok(calls.recognize[1].input instanceof Blob);
  assert.ok(!calls.canvases.includes(calls.recognize[1].input));
  assert.equal(JSON.stringify(calls.recognize.map(call=>call.options)),'[{},{}]');
  assert.equal(JSON.stringify(calls.parameters),'[{"tessedit_pageseg_mode":"3"},{"tessedit_pageseg_mode":"6"}]');
  assert.equal(calls.terminated,1);
  assert.equal(calls.closed,2);
  assert.equal(calls.canvases.length,2);
  assert.ok(calls.canvases.every(canvas=>canvas.width===1&&canvas.height===1));
  assert.equal(JSON.stringify(calls.draws[1].slice(1)),'[21,201,941,1038,0,0,1632,1800]');
  assert.ok(progress.every((value,index)=>index===0||value>=progress[index-1]));
  assert.equal(progress.at(-1),1);

  const prepared=await ocr.prepareImageForOcr(file);
  assert.ok(prepared instanceof File);
  assert.equal(prepared.name,'contacto.jpg');
  assert.equal(calls.canvases.length,3);
  assert.equal(calls.canvases[2].width,1);
  assert.equal(calls.canvases[2].height,1);

  const fast=harness([completeRaw]);
  const fastResult=await fast.ocr.recognize(file);
  assert.equal(fastResult.dni,'43161930S');
  assert.equal(fastResult.phone,'858718773');
  assert.equal(fastResult.fullName,'Maria Vanesa Cortes');
  assert.match(fastResult.rawText,/LECTURA GENERAL \(PSM3\)/);
  assert.equal(fast.calls.recognize.length,1);
  assert.equal(fast.calls.canvases.length,1);
  assert.equal(fast.calls.closed,1);
  assert.equal(fast.calls.parameters.length,1);
  assert.equal(fast.calls.terminated,1);

  const dniOnly=harness([`Documento\n431619308`,`${formRaw}\nBÚSQUEDA\nMARIA VANESA CORTES\nDatos compartidos`]);
  const dniOnlyResult=await dniOnly.ocr.recognize(file);
  assert.equal(dniOnlyResult.dni,'43161930S');
  assert.equal(dniOnlyResult.phone,'858718773');
  assert.equal(dniOnly.calls.recognize.length,2);

  const jpegCrop=harness([iphoneRaw,formRaw],{pngFormEncodeFails:true});
  const jpegCropResult=await jpegCrop.ocr.recognize(file);
  assert.equal(jpegCropResult.dni,'43161930S');
  assert.equal(jpegCrop.calls.recognize[1].input.name,'contacto-formulario.jpg');
  assert.equal(jpegCrop.calls.recognize[1].input.type,'image/jpeg');
  assert.equal(JSON.stringify(jpegCrop.calls.blobs.map(call=>call.type)),'["image/jpeg","image/png","image/jpeg"]');

  const noCrop=harness([iphoneRaw,completeRaw],{failFormEncode:true});
  const noCropResult=await noCrop.ocr.recognize(file);
  assert.equal(noCropResult.dni,'43161930S');
  assert.equal(noCropResult.phone,'858718773');
  assert.strictEqual(noCrop.calls.recognize[0].input,noCrop.calls.recognize[1].input);
  assert.equal(JSON.stringify(noCrop.calls.parameters),'[{"tessedit_pageseg_mode":"3"},{"tessedit_pageseg_mode":"6"}]');
  assert.match(noCropResult.rawText,/LECTURA FORMULARIO \(PSM6\)\n\[no disponible:/);
  assert.match(noCropResult.rawText,/REINTENTO GENERAL \(PSM6\)/);
  assert.ok(noCrop.calls.canvases.every(canvas=>canvas.width===1&&canvas.height===1));
  assert.equal(noCrop.calls.terminated,1);

  const emptyCrop=harness([iphoneRaw,'',completeRaw]);
  const emptyCropResult=await emptyCrop.ocr.recognize(file);
  assert.equal(emptyCropResult.dni,'43161930S');
  assert.equal(emptyCropResult.phone,'858718773');
  assert.equal(emptyCrop.calls.recognize.length,3);
  assert.strictEqual(emptyCrop.calls.recognize[0].input,emptyCrop.calls.recognize[2].input);
  assert.equal(JSON.stringify(emptyCrop.calls.parameters),'[{"tessedit_pageseg_mode":"3"},{"tessedit_pageseg_mode":"6"},{"tessedit_pageseg_mode":"6"}]');
  assert.match(emptyCropResult.rawText,/LECTURA FORMULARIO \(PSM6\)\n\[sin texto reconocido\]/);
  assert.equal(emptyCrop.calls.terminated,1);

  const failedCrop=harness([iphoneRaw,'',completeRaw],{failSecond:true});
  const failedCropResult=await failedCrop.ocr.recognize(file);
  assert.equal(failedCropResult.dni,'43161930S');
  assert.equal(failedCropResult.phone,'858718773');
  assert.equal(failedCrop.calls.recognize.length,3);
  assert.equal(JSON.stringify(failedCrop.calls.parameters),'[{"tessedit_pageseg_mode":"3"},{"tessedit_pageseg_mode":"6"},{"tessedit_pageseg_mode":"6"}]');
  assert.match(failedCropResult.rawText,/fallo controlado del recorte/);
  assert.equal(failedCrop.calls.terminated,1);

  const keepPrimary=harness([
    `Documento\n43161930S\nMsisdn/Fijo\n858718773`,
    `Documento\n12345678Z\nMsisdn/Fijo\n612345678\nBÚSQUEDA\nMARIA VANESA CORTES\nDatos compartidos`
  ]);
  const keepPrimaryResult=await keepPrimary.ocr.recognize(file);
  assert.equal(keepPrimaryResult.dni,'43161930S');
  assert.equal(keepPrimaryResult.phone,'858718773');
  assert.equal(keepPrimaryResult.fullName,'Maria Vanesa Cortes');
  assert.equal(keepPrimary.calls.recognize.length,2);

  const noise=`YGC25041122282164\nDatos compartidos\n642284966`;
  const adversarial=harness([noise,noise,noise]);
  const adversarialResult=await adversarial.ocr.recognize(file);
  assert.equal(adversarialResult.dni,'');
  assert.equal(adversarialResult.phone,'');
  assert.equal(adversarialResult.fullName,'');
  assert.equal(adversarial.calls.recognize.length,3);
  assert.equal(adversarial.calls.terminated,1);

  console.log('mobile OCR recognition flow: ok');
})().catch(error=>{console.error(error);process.exitCode=1;});
