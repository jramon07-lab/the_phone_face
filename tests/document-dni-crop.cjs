const assert=require('node:assert/strict'),C=require('../js/modules/document-scan-core.js');
function image(background,card){const w=240,h=180,data=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){let color=background;if(card&&x>=40&&x<=200&&y>=40&&y<=140)color=230;const i=(y*w+x)*4;data.set([color,color,color,255],i);}return {width:w,height:h,data};}
assert.equal(C.detectCorners(image(240,false)),null);
assert.equal(C.detectCorners(image(30,false)),null);
const points=C.detectCorners(image(30,true));assert(points);assert.deepEqual(points,[{x:40,y:40},{x:200,y:40},{x:200,y:140},{x:40,y:140}]);
console.log('PASS: card detected on contrasting background; uniform images require manual crop.');
