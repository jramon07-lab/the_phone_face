const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../js/mobile-ocr.js'),'utf8');

function harness(texts,{failSecond=false}={}){
  const calls={canvases:[],closed:0,recognize:[],parameters:[],terminated:0,workers:0};
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
        getContext(){return {fillStyle:'',imageSmoothingEnabled:false,imageSmoothingQuality:'',fillRect(){},drawImage(){}};},
        toBlob(callback){callback(new Blob(['jpeg'],{type:'image/jpeg'}));}
      };
      calls.canvases.push(canvas);
      return canvas;
    }
  };
  const api={
    OEM:{LSTM_ONLY:1},PSM:{AUTO:'3',SINGLE_COLUMN:'4'},
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

(async()=>{
  const progress=[];
  const {ocr,calls}=harness([iphoneRaw,formRaw]);
  const file=new File(['photo'],'contacto.jpeg',{type:'image/jpeg',lastModified:1});
  const result=await ocr.recognize(file,event=>progress.push(event.progress));

  assert.equal(result.dni,'43161930S');
  assert.equal(result.phone,'858718773');
  assert.equal(result.fullName,'Maria Vanesa Cortes');
  assert.equal(result.first,'Maria');
  assert.equal(result.last,'Vanesa Cortes');
  assert.match(result.rawText,/LECTURA GENERAL/);
  assert.match(result.rawText,/LECTURA ZONA DOCUMENTO/);
  assert.equal(calls.workers,1);
  assert.equal(calls.recognize.length,2);
  assert.equal(calls.recognize[0].input.name,'contacto.jpg');
  assert.strictEqual(calls.recognize[0].input,calls.recognize[1].input);
  assert.equal(JSON.stringify(calls.recognize.map(call=>call.options)),'[{},{"rectangle":{"left":21,"top":288,"width":941,"height":634}}]');
  assert.equal(JSON.stringify(calls.parameters),'[{"tessedit_pageseg_mode":"3"},{"tessedit_pageseg_mode":"4"}]');
  assert.equal(calls.terminated,1);
  assert.equal(calls.closed,1);
  assert.equal(calls.canvases.length,1);
  assert.ok(calls.canvases.every(canvas=>canvas.width===1&&canvas.height===1));
  assert.ok(progress.every((value,index)=>index===0||value>=progress[index-1]));
  assert.equal(progress.at(-1),1);

  const prepared=await ocr.prepareImageForOcr(file);
  assert.ok(prepared instanceof File);
  assert.equal(prepared.name,'contacto.jpg');

  const fast=harness([`${formRaw}\nBÚSQUEDA\nMARIA VANESA CORTES\nDatos compartidos`]);
  const fastResult=await fast.ocr.recognize(file);
  assert.equal(fastResult.dni,'43161930S');
  assert.equal(fast.calls.recognize.length,1);
  assert.equal(fast.calls.parameters.length,1);
  assert.equal(fast.calls.terminated,1);

  const partial=harness([iphoneRaw,formRaw],{failSecond:true});
  const partialResult=await partial.ocr.recognize(file);
  assert.equal(partialResult.dni,'');
  assert.equal(partialResult.fullName,'Maria Vanesa Cortes');
  assert.equal(partial.calls.terminated,1);

  console.log('mobile OCR recognition flow: ok');
})().catch(error=>{console.error(error);process.exitCode=1;});
