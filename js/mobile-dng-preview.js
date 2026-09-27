(function(){
'use strict';
// Read only TIFF directories and rendered previews, not the full RAW sensor data.
async function previews(file){
 const read=async(offset,length)=>{if(!Number.isSafeInteger(offset)||offset<0||length<0||offset+length>file.size)throw Error('DNG incompleto o dañado.');return new DataView(await file.slice(offset,offset+length).arrayBuffer());};
 const head=await read(0,8),le=head.getUint16(0)===0x4949;
 if(![0x4949,0x4d4d].includes(head.getUint16(0))||head.getUint16(2,le)!==42)throw Error('Este formato RAW necesita otro conversor.');
 const queue=[{offset:head.getUint32(4,le),orientation:1}],seen=new Set(),found=[];
 while(queue.length&&seen.size<64){
  const item=queue.shift(),off=item.offset;if(!off||seen.has(off))continue;seen.add(off);
  const count=(await read(off,2)).getUint16(0,le);if(count>4096)throw Error('Directorio DNG no válido.');
  const dir=await read(off+2,count*12+4),tags={};
  for(let i=0;i<count;i++){
   const at=i*12,tag=dir.getUint16(at,le),type=dir.getUint16(at+2,le),n=dir.getUint32(at+4,le),unit=({1:1,3:2,4:4,13:4})[type];
   if(![254,256,257,259,262,273,274,279,324,325,330,513,514].includes(tag)||!unit||n>256||!n)continue;
   const bytes=n*unit,view=bytes<=4?new DataView(dir.buffer,dir.byteOffset+at+8,4):await read(dir.getUint32(at+8,le),bytes);
   tags[tag]=Array.from({length:n},(_,j)=>unit===1?view.getUint8(j):unit===2?view.getUint16(j*2,le):view.getUint32(j*4,le));
  }
  const orientation=tags[274]?.[0]||item.orientation;
  for(const offset of tags[330]||[])queue.push({offset,orientation});
  queue.push({offset:dir.getUint32(count*12,le),orientation});
  const rendered=[2,6].includes(tags[262]?.[0])||((tags[254]?.[0]||0)&1);
  const offsets=tags[513]||(rendered?(tags[273]||tags[324]):null),lengths=tags[514]||(rendered?(tags[279]||tags[325]):null);
  if(!offsets||!lengths||offsets.length!==1||lengths.length!==1)continue;
  const start=offsets[0],length=lengths[0];if(length<4||length>30*1024*1024||start+length>file.size)continue;
  const magic=await read(start,2),jpeg=magic.getUint16(0)===0xffd8,jxl=magic.getUint16(0)===0xff0a||tags[259]?.[0]===52546;
  if(jpeg||jxl)found.push({blob:file.slice(start,start+length,jpeg?'image/jpeg':'image/jxl'),orientation:jxl?1:orientation,area:(tags[256]?.[0]||0)*(tags[257]?.[0]||0),length});
 }
 return found.sort((a,b)=>b.area-a.area||b.length-a.length);
}
window.TPFMobileDNG={previews,isDNG:file=>/\.dng$/i.test(file.name||'')||/image\/(?:x-adobe-dng|dng)/i.test(file.type||'')};
})();
