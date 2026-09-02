const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../js/mobile-app.js'),'utf8');
const testSource=source.replace(/\s*boot\(\);\s*\}\)\(\);\s*$/,`
window.__mobileGuidedCamera={state,renderScan,guidedCameraCrop,guidedCameraErrorMessage,startGuidedCamera,stopGuidedCamera,cameraStream:()=>mobileCameraStream};
})();`);
assert.notEqual(testSource,source,'No se pudo preparar mobile-app.js para la prueba');

function classes(){return {add(){},remove(){},contains(){return false;},toggle(){}};}
const track={stopped:false,stop(){this.stopped=true;},addEventListener(){}};
const stream={getTracks(){return [track];}};
const video={videoWidth:1920,videoHeight:1080,srcObject:null,play(){return Promise.resolve();}};
const status={textContent:''},capture={disabled:true};
const nodes={mobileCameraPreview:video,mobileCameraStatus:status,mobileCapturePhoto:capture,mobileToast:{textContent:'',className:'',classList:classes()}};
const location={hash:'#/scan',replace(value){this.hash=value;}};
const context={
  window:{},console,Intl,URL,URLSearchParams,Date,location,history:{length:1,back(){}},
  navigator:{mediaDevices:{async getUserMedia(constraints){context.constraints=constraints;return stream;}}},
  document:{hidden:false,getElementById(id){return nodes[id]||null;},querySelector(){return null;},querySelectorAll(){return [];},addEventListener(){}},
  setTimeout,clearTimeout,addEventListener(){},confirm(){return true;}
};
vm.createContext(context);vm.runInContext(testSource,context);
const api=context.window.__mobileGuidedCamera;
api.state.user={id:'user-1'};api.state.perms={is_admin:true};

const live=api.renderScan();
assert.match(live,/id="mobileCameraPreview"[^>]*autoplay[^>]*playsinline[^>]*muted/);
assert.match(live,/id="mobileCameraGuide"/);
assert.match(live,/Nombre y apellidos/);assert.match(live,/DNI \/ NIF/);assert.match(live,/Teléfono/);
assert.match(live,/data-action="capture-photo"[^>]*disabled/);
assert.match(live,/Cámara del móvil/);assert.match(live,/Fototeca/);

const crop=api.guidedCameraCrop(900,1200,300,400,{x:30,y:40,width:240,height:320});
assert.deepEqual(JSON.parse(JSON.stringify(crop)),{x:90,y:120,width:720,height:960});
const covered=api.guidedCameraCrop(1920,1080,360,480,{x:25,y:45,width:310,height:390});
assert.ok(covered.x>=0&&covered.y>=0&&covered.x+covered.width<=1920.0001&&covered.y+covered.height<=1080.0001);

assert.match(api.guidedCameraErrorMessage({name:'NotAllowedError'}),/permitido/);
assert.match(api.guidedCameraErrorMessage({name:'NotFoundError'}),/encontrado/);
assert.match(api.guidedCameraErrorMessage({name:'NotReadableError'}),/ocupada/);

async function run(){
  await api.startGuidedCamera();
  assert.equal(api.cameraStream(),stream);
  assert.equal(video.srcObject,stream);
  assert.equal(context.constraints.audio,false);
  assert.equal(context.constraints.video.facingMode.ideal,'environment');
  assert.equal(capture.disabled,false);
  api.stopGuidedCamera();
  assert.equal(track.stopped,true,'Salir debe apagar físicamente la cámara');
  assert.equal(video.srcObject,null);

  api.state.scanFile={name:'contacto.jpg'};api.state.scanUrl='blob:contacto';
  const review=api.renderScan();
  assert.match(review,/Repetir foto/);assert.match(review,/data-action="analyse-scan"[^>]*>Usar foto/);assert.match(review,/blob:contacto/);
  assert.match(source,/1800\/Math\.max\(crop\.width,crop\.height\)/,'La captura debe limitar el lado largo para OCR móvil');
  assert.match(source,/getTracks\?\.\(\)\.forEach\(track=>track\.stop\(\)\)/);
  console.log('mobile guided camera: ok');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
