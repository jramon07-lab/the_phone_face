const assert=require('node:assert/strict');
const C=require('../js/modules/document-scan-core.js');
function fixture(points,pattern=false){const w=320,h=220,data=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const inside=points&&points.every((p,i)=>{const q=points[(i+1)%4];return (q.x-p.x)*(y-p.y)-(q.y-p.y)*(x-p.x)>=0;});let v=inside?190:pattern?35+((Math.floor(x/4)+Math.floor(y/4))%2)*100:40;if(inside&&x>100&&x<135&&y>75&&y<125)v=60;const k=(y*w+x)*4;data[k]=v;data[k+1]=v;data[k+2]=v;data[k+3]=255;}return {width:w,height:h,data};}
for(const pattern of [false,true]){const points=[{x:65,y:45},{x:259,y:56},{x:252,y:175},{x:60,y:165}],got=C.detectCorners(fixture(points,pattern));assert(got,'detects perspective card');for(let i=0;i<4;i++)assert(Math.hypot(got[i].x-points[i].x,got[i].y-points[i].y)<12,'corner near real edge');}
assert.equal(C.detectCorners(fixture(null,false)),null,'plain background has no card');
assert.equal(C.detectCorners(fixture(null,true)),null,'pattern alone has no card');
assert.deepEqual(C.expiryDates('VALIDEZ 13 03 2029'),['2029-03-13']);
console.log('PASS: perspective, patterned backgrounds, no-card negatives, expiry parsing');
