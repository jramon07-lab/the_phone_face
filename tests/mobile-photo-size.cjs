const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let encodedSize=500000,dimensions,revoked=0,fail=false;
class Photo {constructor(parts,name,options){this.size=parts[0].size;this.name=name;Object.assign(this,options);}}
class Picture {constructor(){this.naturalWidth=6000;this.naturalHeight=4000;}set src(v){queueMicrotask(()=>fail?this.onerror():this.onload());}}
const ctx={window:{},URL:{createObjectURL:()=> 'blob:test',revokeObjectURL:()=>revoked++},Image:Picture,File:Photo,console,document:{head:{appendChild(){}},createElement(type){if(type!=='canvas')return{};return{width:0,height:0,getContext(){return{drawImage(){}}},toBlob(cb,mime,quality){dimensions=[this.width,this.height];assert.equal(quality,.9);cb({size:encodedSize});}}}}};
vm.runInNewContext(fs.readFileSync('js/mobile-documents.js','utf8').replace('window.TPFMobileDocuments={mount,leave};','window.TPFMobileDocuments={mount,leave,preparePhoto};'),ctx);
(async()=>{const prepare=ctx.window.TPFMobileDocuments.preparePhoto,original={name:'image.jpg',type:'image/jpeg',size:6000000,lastModified:123};let result=await prepare(original);assert.deepEqual(dimensions,[3200,2133]);assert.equal(result.size,500000);assert.equal(result.name,original.name);assert.equal(result.lastModified,123);assert.equal(revoked,1);
for(const file of [{...original,type:'application/pdf',name:'document.pdf'},{...original,size:500000},{...original,type:'image/heic',name:'photo.heic'}])assert.equal(await prepare(file),file);
encodedSize=5900000;assert.equal(await prepare(original),original);fail=true;assert.equal(await prepare(original),original);assert.equal(revoked,3);
console.log('PASS: large JPEG reduced, ratio preserved, small files/PDF/HEIC unchanged, original retained on decode failure or poor savings');})().catch(e=>{console.error(e);process.exitCode=1});
