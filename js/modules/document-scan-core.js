(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TPFDocumentScanCore=api;})(typeof window==='undefined'?globalThis:window,function(){
'use strict';
function validDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===s&&Number(s.slice(0,4))>=1900;}
function expiryDates(text){const lines=String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().split(/\r?\n/),out=new Set();for(let i=0;i<lines.length;i++){if(!/\b(?:VALIDEZ|CADUCIDAD|EXPIRY|EXPIRATION|VALID UNTIL)\b/.test(lines[i]))continue;const block=lines.slice(i,i+2).join(' ');for(const m of block.matchAll(/\b(\d{2})[. /-](\d{2})[. /-](\d{4})\b/g)){const s=m[3]+'-'+m[2]+'-'+m[1];if(validDate(s))out.add(s);}}return [...out];}
function transform(p){if(p.length!==4||p.some(q=>!Number.isFinite(q.x)||!Number.isFinite(q.y)))throw Error('Marca las cuatro esquinas.');let sign=0;for(let i=0;i<4;i++){const a=p[i],b=p[(i+1)%4],c=p[(i+2)%4],cross=(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);if(Math.abs(cross)<1e-5||sign&&Math.sign(cross)!==sign)throw Error('Las esquinas deben rodear el documento sin cruzarse.');sign=Math.sign(cross);}const [a,b,c,d]=p,dx1=b.x-c.x,dx2=d.x-c.x,dx3=a.x-b.x+c.x-d.x,dy1=b.y-c.y,dy2=d.y-c.y,dy3=a.y-b.y+c.y-d.y,den=dx1*dy2-dx2*dy1;if(Math.abs(den)<1e-8)throw Error('El recorte es demasiado estrecho.');const g=(dx3*dy2-dx2*dy3)/den,h=(dx1*dy3-dx3*dy1)/den;return (u,v)=>{const z=g*u+h*v+1;return {x:((b.x-a.x+g*b.x)*u+(d.x-a.x+h*d.x)*v+a.x)/z,y:((b.y-a.y+g*b.y)*u+(d.y-a.y+h*d.y)*v+a.y)/z};};}

function detectCorners(image){
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

function pdf(pages,{dni=false}={}){if(!pages.length||pages.length>12)throw Error('Elige entre 1 y 12 páginas.');const enc=new TextEncoder(),parts=[],offsets=[0];let size=0;const add=x=>{const b=typeof x==='string'?enc.encode(x):x;parts.push(b);size+=b.length;};const obj=(n,head,data)=>{offsets[n]=size;add(n+' 0 obj\n'+head);if(data){add('\nstream\n');add(data);add('\nendstream');}add('\nendobj\n');};add('%PDF-1.4\n');obj(1,'<< /Type /Catalog /Pages 2 0 R >>');obj(2,'<< /Type /Pages /Count '+pages.length+' /Kids ['+pages.map((_,i)=>(3+i*3)+' 0 R').join(' ')+'] >>');pages.forEach((p,i)=>{if(!(p.bytes instanceof Uint8Array)||p.bytes[0]!==255||p.bytes[1]!==216||p.width<1||p.height<1)throw Error('Imagen JPEG no válida.');const n=3+i*3,w=595.28,h=dni?841.89:+(w*p.height/p.width).toFixed(2),iw=dni?Math.min(243,(841.89-40)*p.width/p.height):w,ih=+(iw*p.height/p.width).toFixed(2),content=enc.encode('q '+iw+' 0 0 '+ih+' '+((w-iw)/2).toFixed(2)+' '+(dni?(h-ih)/2:0).toFixed(2)+' cm /Im0 Do Q');obj(n,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+w+' '+h+'] /Resources << /XObject << /Im0 '+(n+1)+' 0 R >> >> /Contents '+(n+2)+' 0 R >>');obj(n+1,'<< /Type /XObject /Subtype /Image /Width '+p.width+' /Height '+p.height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+p.bytes.length+' >>',p.bytes);obj(n+2,'<< /Length '+content.length+' >>',content);});const start=size;add('xref\n0 '+offsets.length+'\n0000000000 65535 f \n');for(let i=1;i<offsets.length;i++)add(String(offsets[i]).padStart(10,'0')+' 00000 n \n');add('trailer\n<< /Size '+offsets.length+' /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF');return new Blob(parts,{type:'application/pdf'});}
return {validDate,expiryDates,transform,detectCorners,pdf};
});

