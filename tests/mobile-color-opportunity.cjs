const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../js/mobile-ocr.js'),'utf8');
const context={window:{},document:{documentElement:{dataset:{}}},console:{warn(){}},Promise,URL,Blob,File};
vm.createContext(context);
vm.runInContext(source,context);
const classify=context.window.TPFMobileOCR.classifyOpportunityColor;

function image(width,height,background=[245,245,245],patches=[]){
  const data=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y+=1){
    for(let x=0;x<width;x+=1){
      let color=background;
      for(const patch of patches){
        if(x>=patch.x&&x<patch.x+patch.width&&y>=patch.y&&y<patch.y+patch.height)color=patch.color;
      }
      const offset=(y*width+x)*4;
      data[offset]=color[0];data[offset+1]=color[1];data[offset+2]=color[2];data[offset+3]=255;
    }
  }
  return data;
}

const width=96,height=128;
const purple=image(width,height,[242,242,242],[{x:8,y:72,width:72,height:12,color:[178,24,151]}]);
const yellow=image(width,height,[242,242,242],[{x:8,y:72,width:72,height:12,color:[245,211,0]}]);
assert.equal(classify(purple,width,height).title,'REVISION YOIGO');
assert.equal(classify(yellow,width,height).title,'REVISION MASMOVIL');

const neutral=image(width,height,[225,215,195]);
assert.equal(classify(neutral,width,height),null);

const tinyPurple=image(width,height,[242,242,242],[{x:4,y:4,width:8,height:8,color:[178,24,151]}]);
assert.equal(classify(tinyPurple,width,height),null);

const tied=image(width,height,[242,242,242],[
  {x:8,y:32,width:64,height:10,color:[178,24,151]},
  {x:8,y:80,width:64,height:10,color:[245,211,0]}
]);
assert.equal(classify(tied,width,height),null);

const appSource=fs.readFileSync(path.join(__dirname,'../js/mobile-app.js'),'utf8');
assert.match(appSource,/result\.opportunitySuggestion\?\.title\|\|''/);
assert.match(appSource,/data-action="skip-opportunity">No quiero oportunidad</);
assert.match(appSource,/data-action="continue-opportunity">Guardar oportunidad</);
assert.match(appSource,/if\(includeOpportunity&&!state\.createdOpportunityId\)/);
assert.match(appSource,/includeOpportunity\?'Confirmar y crear':'Crear solo contacto'/);

const mobileHtml=fs.readFileSync(path.join(__dirname,'../movil/index.html'),'utf8');
assert.match(mobileHtml,/mobile\.css\?v=20260902-10/);
assert.match(mobileHtml,/mobile-ocr\.js\?v=20260902-14/);
assert.match(mobileHtml,/mobile-app\.js\?v=20260902-14/);

console.log('mobile color and optional opportunity flow: ok');
