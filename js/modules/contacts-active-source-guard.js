(function(){
'use strict';
const M=window.TPFModules;if(!M)return;
function install(){
 const client=window.sb;
 if(!client||typeof client.from!=='function'||client.__tpfContactsSourceGuard)return;
 const originalFrom=client.from.bind(client);
 client.from=function(table){
   const builder=originalFrom(table);
   if(table!=='records'||!builder||typeof builder.select!=='function')return builder;
   const originalSelect=builder.select.bind(builder);
   builder.select=function(...args){
     const query=originalSelect(...args);
     if(!query||typeof query.in!=='function')return query;
     const originalIn=query.in.bind(query);
     query.in=function(column,values){
       if(column==='source_sheet'&&Array.isArray(values)&&values.includes('BASE DE DATOS')&&values.includes('DATA')){
         return originalIn(column,['BASE DE DATOS']);
       }
       return originalIn(column,values);
     };
     return query;
   };
   return builder;
 };
 Object.defineProperty(client,'__tpfContactsSourceGuard',{value:true});
}
M.register('contacts-active-source-guard',{install(){install();setTimeout(install,0);}});
})();
