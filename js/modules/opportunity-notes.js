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
function fill(input,value){if(!input)return;input.dataset.originalNotes=String(value??'');input.value=split(value).internal;}
function read(input){return input?merge(input.dataset.originalNotes||'',input.value):'';}
W.TPFOpportunityNotes={split,merge,fill,read};
})();
