/* Read-only reconciliation of installed sales. No contact, opportunity or job writes. */
(function(){
'use strict';
const $=id=>document.getElementById(id),mode='COMPROBAR VENTAS';let generation=0;
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const html=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function date(value){
 if(value instanceof Date)return [value.getFullYear(),String(value.getMonth()+1).padStart(2,'0'),String(value.getDate()).padStart(2,'0')].join('-');
 if(typeof value==='number')return new Date(Date.UTC(1899,11,30)+Math.round(value)*86400000).toISOString().slice(0,10);
 const s=String(value||'').trim(),m=s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
 const out=m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:s.slice(0,10);
 return /^\d{4}-\d{2}-\d{2}$/.test(out)&&Number.isFinite(Date.parse(out))?out:'';
}
function months(value,n){if(!value)return '';const [y,m,d]=value.split('-').map(Number),target=new Date(Date.UTC(y,m-1+n,1));target.setUTCDate(Math.min(d,new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate()));return target.toISOString().slice(0,10);}
const display=v=>v?v.split('-').reverse().join('/'):'Sin fecha';
const name=r=>r.data?.['NOMBRE Y APELLIDOS']||[r.data?.NOMBRE,r.data?.APELLIDOS].filter(Boolean).join(' ');
function analyse(rows,contacts,opps){
 const seen=new Set();
 return rows.filter(r=>String(r.DNI||'').trim()&&String(r.Transaccion||'').trim()).map(r=>{
  const dni=norm(r.DNI),operator=String(r.Operador||''),installed=date(r.Fecha_Activacion),key=String(r.OrderLine||r.Transaccion),duplicate=seen.has(key);seen.add(key);
  const matches=contacts.filter(c=>[c.data?.DNI,c.data?.['DNI / NIF'],c.data?.TPF_TITULAR?.holder_dni].some(d=>norm(d)===dni));
  const ids=new Set(matches.map(c=>c.id));
  const related=opps.filter(o=>ids.has(o.record_id)||norm(o.contract_party?.holder_dni)===dni);
  const candidates=related.filter(o=>norm(o.title).includes(norm(operator))||norm(o.contract_party?.operator)===norm(operator));
  const exact=related.find(o=>o.import_reference===key);
  let action=duplicate?'Duplicada en Excel':!installed?'Revisar fecha de activación':norm(r.Cancelada)==='SI'?'Cancelada: no importar':matches.length===0?'Cliente no encontrado':matches.length>1?'Revisar titular / gestor':exact?'Ya importada':related.length?'Revisar oportunidad existente':'Crear en Ganado';
  return {dni,operator,client:matches.map(name).join(' / ')||'Sin identificar',installed,review:months(installed,12),next:months(installed,11),action,expected:exact?.expected_date||candidates[0]?.expected_date||'',product:r.Producto||r.Tarifa||'',key,contactId:matches.length===1?matches[0].id:null};
 });
}
async function all(table,columns,filter){const rows=[];for(let start=0;;start+=500){let query=sb.from(table).select(columns).order('id').range(start,start+499);if(filter)query=query.eq(...filter);const {data,error}=await query;if(error)throw error;rows.push(...(data||[]));if((data||[]).length<500)return rows;}}
async function preview(){
 const version=++generation,file=$('excelFile')?.files[0];$('runImport').disabled=true;
 if(!file){$('importInfo').textContent='Selecciona el Excel de ventas instaladas.';return;}
 $('importMapping')?.classList.add('hidden');$('importInfo').textContent='Comprobando DNI y oportunidades. No se guardará ningún cambio…';
 try{
  const book=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false});const sheet=book.SheetNames.find(n=>n==='Export')||book.SheetNames[0];
  const rows=XLSX.utils.sheet_to_json(book.Sheets[sheet],{defval:'',raw:true});
  if(!rows.length||!['DNI','Fecha_Activacion','Transaccion','Operador'].every(k=>k in rows[0]))throw Error('Este modo necesita DNI, Operador, Transaccion y Fecha_Activacion.');
  const [contacts,opps]=await Promise.all([all('records','id,data',['source_sheet','BASE DE DATOS']),all('sales_opportunities','id,record_id,title,expected_date,contract_party')]);
  if(version!==generation||$('destination').value!==mode)return;
  const result=analyse(rows,contacts,opps);window.TPFInstallationPreview.last=result;
  $('previewHead').innerHTML='<tr>'+['Cliente / DNI','Operador y producto','Resultado','Previsión actual (se conserva)','Instalación','Próximo · 11 meses','Revisión · 12 meses'].map(x=>'<th>'+x+'</th>').join('')+'</tr>';
  $('previewRows').innerHTML=result.map(r=>'<tr>'+['<b>'+html(r.client)+'</b><br>'+html(r.dni),html(r.operator)+'<br>'+html(r.product),html(r.action),display(r.expected),display(r.installed),display(r.next),display(r.review)].map(v=>'<td>'+v+'</td>').join('')+'</tr>').join('');
  const creates=result.filter(r=>r.action==='Crear en Ganado').length;
  $('importInfo').textContent=`Prueba sin guardar: ${result.length} ventas · ${creates} para crear · ${result.length-creates} para revisar. Teléfonos y previsiones existentes se conservan. Fechas base de revisión; se ajustan al horario comercial. No se envía ni programa ningún WhatsApp en esta prueba.`;
 }catch(e){if(version===generation)$('importInfo').textContent='No se ha importado nada: '+e.message;}
}
function bind(){const select=$('destination');if(!select)return;const option=document.createElement('option');option.value=mode;option.textContent='COMPROBAR VENTAS INSTALADAS (prueba)';select.append(option);
 document.addEventListener('click',event=>{if(select.value!==mode)return;if(event.target.closest?.('#previewImport,#runImport')){event.preventDefault();event.stopImmediatePropagation();if(event.target.closest('#previewImport'))preview();}},true);
 select.addEventListener('change',()=>{generation++;if(select.value===mode){$('runImport').disabled=true;$('importMapping')?.classList.add('hidden');$('importInfo').textContent='Comprobación de ventas por DNI. Pulsa Vista previa; no modifica datos.';}});
 $('excelFile')?.addEventListener('change',()=>{generation++;});
}
window.TPFInstallationPreview={analyse,date,months};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
