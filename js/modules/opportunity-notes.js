(function(){
'use strict';
const W=typeof window==='undefined'?globalThis:window;
// Separate only the exact legacy origin line. Everything the user wrote remains intact.
function split(value){
 const raw=String(value??'');
 const match=raw.match(/^(Oferta creada desde el configurador\.?)(?:\r?\n|$)/);
 if(!match)return {internal:raw,origin:''};
 return {internal:raw.slice(match[0].length).replace(/^\r?\n/,''),origin:match[1]};
}
function merge(original,internal){
 const raw=String(original??''),next=String(internal??''),parts=split(raw);
 if(next===parts.internal)return raw;
 return parts.origin?parts.origin+(next?'\n\n'+next:''):next;
}
function protect(input,on=true){if(!input)return;input.readOnly=on;input.dataset.notesProtected=String(on);input.setAttribute?.('aria-readonly',String(on));}
function fill(input,value){if(!input)return;input.dataset.originalNotes=String(value??'');input.value=split(value).internal;protect(input);}
function restore(input){if(!input)return;input.value=split(input.dataset.originalNotes||'').internal;protect(input);}
function validate(input){return input&&input.dataset.notesProtected!=='true'&&split(input.dataset.originalNotes||'').internal.trim()&&!String(input.value||'').trim()?'Las notas guardadas no se pueden dejar vacías. Puedes corregirlas o añadir información.':'';}
function read(input){return input?(input.dataset.notesProtected==='true'?input.dataset.originalNotes||'':merge(input.dataset.originalNotes||'',input.value)):'';}
W.TPFOpportunityNotes={split,merge,fill,read,protect,restore,validate};
})();
