(function(root){
'use strict';
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
function names(record){const d=record.data||{},p=d.TPF_TITULAR||{};const contact=String(d['NOMBRE Y APELLIDOS']||[d.NOMBRE,d.APELLIDOS].filter(Boolean).join(' ')||'').trim();const holder=p.same===false?String(p.holder_name||[p.holder_first_name,p.holder_last_name].filter(Boolean).join(' ')).trim():'';return {contact,holder};}
function match(folders,records){
 const index=new Map(),used=new Map();
 records.forEach(record=>{const n=names(record);for(const [role,name] of Object.entries(n)){const key=normalize(name);if(!key)continue;if(!index.has(key))index.set(key,[]);const entries=index.get(key);if(!entries.some(e=>e.record.id===record.id))entries.push({record,role,name});}
  const l=record.data?.TPF_DOCUMENTS;if(l?.provider==='google_drive'&&l.folder_id){if(!used.has(l.folder_id))used.set(l.folder_id,[]);used.get(l.folder_id).push(record);}
 });
 const unique=[...new Map(folders.map(f=>[f.id,f])).values()];
 const result=unique.map(folder=>{const key=normalize(folder.name),candidates=index.get(key)||[],linked=used.get(folder.id)||[];
  if(linked.length)return {folder,status:'linked',reason:'Esta carpeta ya está vinculada.',candidates:linked.map(record=>({record,role:'contact',name:names(record).contact}))};
  if(!candidates.length)return {folder,status:'unmatched',reason:'No coincide exactamente con un nombre de contacto o titular.',candidates:[]};
  if(candidates.length>1)return {folder,status:'review',reason:'El nombre coincide con varias fichas.',candidates};
  if(candidates[0].record.data?.TPF_DOCUMENTS)return {folder,status:'review',reason:'La ficha ya tiene otra vinculación. Se conserva.',candidates};
  if(key.split(' ').length<2)return {folder,status:'review',reason:'El nombre es demasiado corto para proponerlo en bloque.',candidates};
  return {folder,status:'clear',reason:candidates[0].role==='holder'?'Coincide con el titular del contrato.':'Coincide con el nombre completo del contacto.',candidates};
 });
 const count=new Map();result.filter(r=>r.status==='clear').forEach(r=>{const id=r.candidates[0].record.id;count.set(id,(count.get(id)||0)+1);});
 result.forEach(r=>{if(r.status==='clear'&&count.get(r.candidates[0].record.id)>1){r.status='review';r.reason='Hay varias carpetas para la misma ficha. Elige una individualmente.';}});
 return result;
}
const api={normalize,names,match};if(typeof module==='object'&&module.exports)module.exports=api;else root.TPFDocumentFolderMatching=api;
})(typeof window==='object'?window:globalThis);
