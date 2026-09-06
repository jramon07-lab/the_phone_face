(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TPFDocumentScanCore=api;})(typeof window==='undefined'?globalThis:window,function(){
'use strict';
function validDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===s&&Number(s.slice(0,4))>=1900;}
function expiryDates(text){const lines=String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().split(/\r?\n/).map(s=>s.trim()).filter(Boolean),out=new Set();for(let i=0;i<lines.length;i++){if(!/\b(?:VALIDEZ|CADUCIDAD|EXPIRY|EXPIRATION|VALID UNTIL)\b/.test(lines[i]))continue;const block=lines.slice(i,i+2).join(' ');for(const m of block.matchAll(/\b(\d{2})[. /-]+(\d{2})[. /-]+(\d{4})\b/g)){const s=m[3]+'-'+m[2]+'-'+m[1];if(validDate(s))out.add(s);}}return [...out];}
function transform(p){if(p.length!==4||p.some(q=>!Number.isFinite(q.x)||!Number.isFinite(q.y)))throw Error('Marca las cuatro esquinas.');let sign=0;for(let i=0;i<4;i++){const a=p[i],b=p[(i+1)%4],c=p[(i+2)%4],cross=(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);if(Math.abs(cross)<1e-5||sign&&Math.sign(cross)!==sign)throw Error('Las esquinas deben rodear el documento sin cruzarse.');sign=Math.sign(cross);}const [a,b,c,d]=p,dx1=b.x-c.x,dx2=d.x-c.x,dx3=a.x-b.x+c.x-d.x,dy1=b.y-c.y,dy2=d.y-c.y,dy3=a.y-b.y+c.y-d.y,den=dx1*dy2-dx2*dy1;if(Math.abs(den)<1e-8)throw Error('El recorte es demasiado estrecho.');const g=(dx3*dy2-dx2*dy3)/den,h=(dx1*dy3-dx3*dy1)/den;return (u,v)=>{const z=g*u+h*v+1;return {x:((b.x-a.x+g*b.x)*u+(d.x-a.x+h*d.x)*v+a.x)/z,y:((b.y-a.y+g*b.y)*u+(d.y-a.y+h*d.y)*v+a.y)/z};};}

function brightCorners(image){
 const {width:w,height:h,data}=image;if(w<60||h<40)return null;
 let best=null;
 for(const threshold of [145,175,205]){
  const seen=new Uint8Array(w*h),queue=new Int32Array(w*h);
  const bright=i=>{const k=i*4;return (data[k]+data[k+1]+data[k+2])/3>=threshold;};
  for(let start=0;start<w*h;start++){if(seen[start]||!bright(start))continue;
   let head=0,tail=1;queue[0]=start;seen[start]=1;let count=0;const pts=[{x:w,y:h},{x:0,y:h},{x:0,y:0},{x:w,y:0}];
   while(head<tail){const i=queue[head++],x=i%w,y=Math.floor(i/w);count++;if(x+y<pts[0].x+pts[0].y)pts[0]={x,y};if(x-y>pts[1].x-pts[1].y)pts[1]={x,y};if(x+y>pts[2].x+pts[2].y)pts[2]={x,y};if(y-x>pts[3].y-pts[3].x)pts[3]={x,y};
    for(const n of [x?i-1:-1,x<w-1?i+1:-1,y?i-w:-1,y<h-1?i+w:-1])if(n>=0&&!seen[n]&&bright(n)){seen[n]=1;queue[tail++]=n;}
   }
   if(count<w*h*.10||count>w*h*.88)continue;
   try{transform(pts);}catch(_){continue;}
   const area=Math.abs(pts.reduce((a,p,i)=>a+p.x*pts[(i+1)%4].y-p.y*pts[(i+1)%4].x,0))/2;
   const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),a=(distance(pts[0],pts[1])+distance(pts[2],pts[3]))/2,b=(distance(pts[1],pts[2])+distance(pts[3],pts[0]))/2,ratio=Math.max(a,b)/Math.min(a,b);
   if(area<w*h*.12||area>w*h*.90||count/area<.60||ratio<1.25||ratio>1.95||pts.some(p=>p.x<2||p.y<2||p.x>w-3||p.y>h-3))continue;
   const score=area*(1-Math.abs(ratio-1.586)*.5);if(!best||score>best.score)best={score,points:pts};
  }
 }
 return best?.points||null;
}

// Local, bounded edge detector: no photo leaves the browser.
function edgeCorners(image){
 const {width:w,height:h,data}=image,n=w*h;if(w<60||h<40)return null;
 const gray=new Float32Array(n),blur=new Float32Array(n),gx=new Float32Array(n),gy=new Float32Array(n),mag=new Float32Array(n);
 for(let i=0;i<n;i++)gray[i]=.299*data[i*4]+.587*data[i*4+1]+.114*data[i*4+2];
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){let s=0;for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++)s+=gray[(y+j)*w+x+k];blur[y*w+x]=s/9;}
 for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++){const i=y*w+x;gx[i]=blur[i+1]-blur[i-1];gy[i]=blur[i+w]-blur[i-w];mag[i]=Math.hypot(gx[i],gy[i]);}
 const rough=new Float32Array(n);for(let y=3;y<h-3;y++)for(let x=3;x<w-3;x++){let sum=0;for(let j=-2;j<=2;j++)for(let k=-2;k<=2;k++){const i=(y+j)*w+x+k;sum+=Math.abs(gray[i+1]-gray[i])+Math.abs(gray[i+w]-gray[i]);}rough[y*w+x]=sum/50;}
 const diagonal=Math.ceil(Math.hypot(w,h)),span=diagonal*2+1,angles=60,acc=new Float32Array(span*angles),cs=[],sn=[];
 for(let t=0;t<angles;t++){cs[t]=Math.cos(t*Math.PI/angles);sn[t]=Math.sin(t*Math.PI/angles);}
 for(let y=3;y<h-3;y++)for(let x=3;x<w-3;x++){const i=y*w+x;if(mag[i]<12)continue;let a=Math.atan2(gy[i],gx[i]);if(a<0)a+=Math.PI;const nx=gx[i]/mag[i],ny=gy[i]/mag[i];let smoothSide=false;for(const sign of [-1,1]){const xx=Math.round(x+sign*nx*6),yy=Math.round(y+sign*ny*6);if(xx>3&&yy>3&&xx<w-4&&yy<h-4&&gray[yy*w+xx]>110&&rough[yy*w+xx]<10)smoothSide=true;}const weight=smoothSide?1:.2;const t0=Math.round(a*angles/Math.PI);for(let dt=-3;dt<=3;dt++){const t=(t0+dt+angles)%angles,r=Math.round(x*cs[t]+y*sn[t])+diagonal;acc[t*span+r]+=Math.min(32,mag[i])*weight;}}
 const peaks=[];for(let t=0;t<angles;t++)for(let r=0;r<span;r++){const v=acc[t*span+r];if(v>Math.min(w,h)*4)peaks.push({t,r:r-diagonal,v});}peaks.sort((a,b)=>b.v-a.v);
 const lines=[];for(const p of peaks){if(lines.some(q=>{let dt=Math.abs(p.t-q.t),dr=Math.abs(p.r-q.r);if(dt>angles/2){dt=angles-dt;dr=Math.abs(p.r+q.r);}return dt<=2&&dr<7;}))continue;lines.push({...p,a:cs[p.t],b:sn[p.t]});if(lines.length===64)break;}
 const angle=(a,b)=>{const d=Math.abs(a.t-b.t);return Math.min(d,angles-d)*180/angles;};
 const cross=(a,b)=>{const d=a.a*b.b-b.a*a.b;if(Math.abs(d)<.35)return null;return {x:(a.r*b.b-b.r*a.b)/d,y:(a.a*b.r-b.a*a.r)/d};};
 const pairs=[];for(let i=0;i<lines.length;i++)for(let j=i+1;j<lines.length;j++){const a=lines[i],b=lines[j];if(angle(a,b)>18)continue;const distance=Math.abs(a.r-(a.a*b.a+a.b*b.b>0?b.r:-b.r));if(distance<Math.min(w,h)*.25)continue;pairs.push([a,b]);}
 const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 function support(a,b){const len=dist(a,b),steps=Math.max(8,Math.round(len)),nx=(b.y-a.y)/len,ny=(a.x-b.x)/len;let hit=0,sum=0;for(let j=3;j<steps-3;j++){const x=a.x+(b.x-a.x)*j/steps,y=a.y+(b.y-a.y)*j/steps;let best=0;for(let d=-2;d<=2;d++){const xx=Math.round(x+nx*d),yy=Math.round(y+ny*d);if(xx<2||yy<2||xx>=w-2||yy>=h-2)continue;const i=yy*w+xx;best=Math.max(best,Math.abs(gx[i]*nx+gy[i]*ny));}if(best>=10)hit++;sum+=Math.min(30,best);}return {coverage:hit/Math.max(1,steps-6),strength:sum/Math.max(1,steps-6)/30};}
 function outsideEvidence(p){let score=0,total=0;const cx=p.reduce((s,q)=>s+q.x,0)/4,cy=p.reduce((s,q)=>s+q.y,0)/4;for(let k=0;k<4;k++){const a=p[k],b=p[(k+1)%4],len=dist(a,b);let nx=(b.y-a.y)/len,ny=(a.x-b.x)/len;if(nx*(cx-(a.x+b.x)/2)+ny*(cy-(a.y+b.y)/2)<0){nx=-nx;ny=-ny;}for(let j=1;j<12;j++){const x=a.x+(b.x-a.x)*j/12,y=a.y+(b.y-a.y)*j/12;for(const delta of [5,9]){const ix=Math.round(x+nx*delta),iy=Math.round(y+ny*delta),ox=Math.round(x-nx*delta),oy=Math.round(y-ny*delta);if(Math.min(ix,ox)<4||Math.min(iy,oy)<4||Math.max(ix,ox)>w-5||Math.max(iy,oy)>h-5)continue;const inside=iy*w+ix,outside=oy*w+ox;score+=Math.max(-1,Math.min(1,(rough[outside]-rough[inside])/12))*.7+Math.max(-1,Math.min(1,(gray[inside]-gray[outside])/80))*.3;total++;}}}return total?score/total:0;}
 let best=null;
 for(let i=0;i<pairs.length;i++)for(let j=i+1;j<pairs.length;j++){
  const [a,b]=pairs[i],[c,d]=pairs[j];if(angle(a,c)<65)continue;
  let p=[cross(a,c),cross(a,d),cross(b,d),cross(b,c)];if(p.some(q=>!q||q.x<2||q.y<2||q.x>w-3||q.y>h-3))continue;
  const area=Math.abs(p.reduce((s,q,k)=>s+q.x*p[(k+1)%4].y-q.y*p[(k+1)%4].x,0))/2;if(area<n*.15||area>n*.88)continue;
  const sides=p.map((q,k)=>dist(q,p[(k+1)%4])),u=(sides[0]+sides[2])/2,v=(sides[1]+sides[3])/2,ratio=Math.max(u,v)/Math.min(u,v);
  if(ratio<1.30||ratio>1.95||Math.max(sides[0]/sides[2],sides[2]/sides[0],sides[1]/sides[3],sides[3]/sides[1])>1.45)continue;
  const supports=p.map((q,k)=>support(q,p[(k+1)%4]));if(supports.some(s=>s.coverage<.57))continue;
  let smooth=0,total=0;for(let yy=1;yy<10;yy++)for(let xx=1;xx<16;xx++){const u=xx/16,v=yy/10,x=Math.round((1-v)*((1-u)*p[0].x+u*p[1].x)+v*((1-u)*p[3].x+u*p[2].x)),y=Math.round((1-v)*((1-u)*p[0].y+u*p[1].y)+v*((1-u)*p[3].y+u*p[2].y)),k=y*w+x;total++;if(gray[k]>110&&rough[k]<10)smooth++;}const quiet=smooth/total;if(quiet<.30)continue;
  const score=.35*outsideEvidence(p)+.18*quiet+supports.reduce((s,q)=>s+q.coverage*.65+q.strength*.35,0)/4-.8*Math.abs(ratio-1.586)+.08*Math.sqrt(area/n);
  if(!best||score>best.score)best={score,points:p};
 }
 if(!best||best.score<.66)return null;
 const p=best.points,cx=p.reduce((s,q)=>s+q.x,0)/4,cy=p.reduce((s,q)=>s+q.y,0)/4;p.sort((a,b)=>Math.atan2(a.y-cy,a.x-cx)-Math.atan2(b.y-cy,b.x-cx));let first=0;for(let i=1;i<4;i++)if(p[i].x+p[i].y<p[first].x+p[first].y)first=i;return [...p.slice(first),...p.slice(0,first)];
}

function detectCorners(image){return edgeCorners(image)||brightCorners(image);}

function pdf(pages,{dni=false}={}){if(!pages.length||pages.length>12)throw Error('Elige entre 1 y 12 páginas.');const enc=new TextEncoder(),parts=[],offsets=[0];let size=0;const add=x=>{const b=typeof x==='string'?enc.encode(x):x;parts.push(b);size+=b.length;};const obj=(n,head,data)=>{offsets[n]=size;add(n+' 0 obj\n'+head);if(data){add('\nstream\n');add(data);add('\nendstream');}add('\nendobj\n');};add('%PDF-1.4\n');obj(1,'<< /Type /Catalog /Pages 2 0 R >>');obj(2,'<< /Type /Pages /Count '+pages.length+' /Kids ['+pages.map((_,i)=>(3+i*3)+' 0 R').join(' ')+'] >>');pages.forEach((p,i)=>{if(!(p.bytes instanceof Uint8Array)||p.bytes[0]!==255||p.bytes[1]!==216||p.width<1||p.height<1)throw Error('Imagen JPEG no válida.');const n=3+i*3,w=595.28,h=dni?841.89:+(w*p.height/p.width).toFixed(2),iw=dni?Math.min(243,(841.89-40)*p.width/p.height):w,ih=+(iw*p.height/p.width).toFixed(2),content=enc.encode('q '+iw+' 0 0 '+ih+' '+((w-iw)/2).toFixed(2)+' '+(dni?(h-ih)/2:0).toFixed(2)+' cm /Im0 Do Q');obj(n,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+w+' '+h+'] /Resources << /XObject << /Im0 '+(n+1)+' 0 R >> >> /Contents '+(n+2)+' 0 R >>');obj(n+1,'<< /Type /XObject /Subtype /Image /Width '+p.width+' /Height '+p.height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+p.bytes.length+' >>',p.bytes);obj(n+2,'<< /Length '+content.length+' >>',content);});const start=size;add('xref\n0 '+offsets.length+'\n0000000000 65535 f \n');for(let i=1;i<offsets.length;i++)add(String(offsets[i]).padStart(10,'0')+' 00000 n \n');add('trailer\n<< /Size '+offsets.length+' /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF');return new Blob(parts,{type:'application/pdf'});}
return {validDate,expiryDates,transform,detectCorners,pdf};
});


