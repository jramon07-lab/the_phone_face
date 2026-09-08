(function(){
'use strict';
const $=id=>document.getElementById(id),root=$('cpNotesPanel');if(!root)return;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const contactId=()=>{try{return currentContact?.id||null}catch(_){return null}};
let rows=[],editing=null,owner=null,epoch=0,busy=false;
root.innerHTML='<div class="cpNotesHeading"><h2>Notas</h2><button type="button" id="cpNotesNew" class="primary">+ Nueva nota</button></div><form id="cpNotesForm" class="hidden"><label for="cpNotesTitle">Título</label><input id="cpNotesTitle" maxlength="180" required placeholder="Ej. Llamar para confirmar instalación"><label for="cpNotesBody">Contenido</label><textarea id="cpNotesBody" rows="5" required placeholder="Escribe la nota…"></textarea><div class="cpNotesActions"><button type="button" id="cpNotesCancel" class="secondary">Cancelar</button><button type="submit" id="cpNotesSave" class="primary">Guardar nota</button></div></form><p id="cpNotesStatus" role="status"></p><div id="cpNotesList"></div>';
function reset(){editing=null;owner=null;$('cpNotesForm').reset();$('cpNotesForm').classList.add('hidden')}
function paint(){
 $('cpNotesList').innerHTML=rows.length?rows.map(n=>`<article class="cpNoteCard"><h3>${esc(n.title||'Nota sin título')}</h3><p class="cpNoteContent">${esc(n.description)}</p><div class="cpNoteBy">${esc(n.crm_created_by_name||'Autor no registrado')} · ${esc(new Date(n.created_at).toLocaleString('es-ES'))}</div>${n.activity_type==='note'?`<div class="cpNotesActions"><button type="button" class="secondary" data-note-edit="${esc(n.id)}">Editar</button><button type="button" class="secondary" data-note-delete="${esc(n.id)}">Eliminar</button></div>`:'<small>Registro anterior de las notas del contacto</small>'}</article>`).join(''):'<p class="cpEmpty">Aún no hay notas para este cliente.</p>';
}
async function load(){
 const id=contactId(),run=++epoch;if(!id)return;
 $('cpNotesStatus').textContent='Cargando notas…';
 try{const all=[];for(let offset=0;;offset+=500){const {data,error}=await sb.from('contact_activity').select('*').eq('contact_id',id).in('activity_type',['note','notes_updated']).order('created_at',{ascending:false}).order('id').range(offset,offset+499);if(error)throw error;all.push(...(data||[]));if((data||[]).length<500)break}
 if(run!==epoch||id!==contactId())return;rows=all;paint();$('cpNotesStatus').textContent='';
 }catch(e){if(run===epoch)$('cpNotesStatus').textContent='No se pudieron cargar las notas: '+e.message}
}
function begin(note=null){if(busy)return;owner=contactId();if(!owner)return;editing=note;$('cpNotesTitle').value=note?.title||'';$('cpNotesBody').value=note?.description||'';$('cpNotesForm').classList.remove('hidden');$('cpNotesTitle').focus()}
$('cpNotesNew').onclick=()=>begin();$('cpNotesCancel').onclick=()=>{if(!busy)reset()};
async function change(patch,n,id){
 let q=sb.from('contact_activity').update(patch).eq('id',n.id).eq('contact_id',id).eq('activity_type','note');
 q=n.description===null?q.is('description',null):q.eq('description',n.description);q=n.title===null?q.is('title',null):q.eq('title',n.title);
 const {data,error}=await q.select('id');if(error)throw error;if(!data?.length)throw Error('La nota cambió en otro dispositivo. Actualiza antes de editarla.');
}
async function refreshHistory(){if(typeof renderContactProfile==='function')await renderContactProfile()}
$('cpNotesForm').onsubmit=async e=>{
 e.preventDefault();if(busy)return;
 const title=$('cpNotesTitle').value.trim(),description=$('cpNotesBody').value.trim(),id=owner,note=editing;
 if(!title||!description){$('cpNotesStatus').textContent='Escribe el título y el contenido.';return}if(!id||id!==contactId()){reset();return}
 busy=true;$('cpNotesSave').disabled=true;
 try{
  const {data,error:authError}=await sb.auth.getUser();if(authError)throw authError;if(!data.user)throw Error('Inicia sesión de nuevo.');
  let warning='';
  if(note){await change({title,description},note,id);const {error}=await sb.from('contact_activity').insert({contact_id:id,activity_type:'note_edited',title:'Nota modificada · '+title,description:'Título anterior: '+note.title+'\nContenido anterior: '+note.description,created_by:data.user.id});if(error)warning='Nota guardada, pero no se pudo registrar la modificación en Actividad.';}
  else{const {error}=await sb.from('contact_activity').insert({contact_id:id,activity_type:'note',title,description,created_by:data.user.id});if(error)throw error}
  if(id===contactId()){reset();await load();await refreshHistory();$('cpNotesStatus').textContent=warning||'Nota guardada.'}
 }catch(error){$('cpNotesStatus').textContent=error.message}finally{busy=false;$('cpNotesSave').disabled=false}
};
root.addEventListener('click',async e=>{
 const edit=e.target.closest('[data-note-edit]');if(edit){begin(rows.find(n=>n.id===edit.dataset.noteEdit));return}
 const del=e.target.closest('[data-note-delete]');if(!del||busy)return;const n=rows.find(n=>n.id===del.dataset.noteDelete);if(!n||!confirm('¿Eliminar «'+n.title+'» de Notas? El contenido se conservará en Actividad.'))return;
 const id=contactId();busy=true;del.disabled=true;
 try{await change({activity_type:'note_deleted',title:'Nota eliminada · '+n.title},n,id);if(id===contactId()){reset();await load();await refreshHistory()}}catch(error){$('cpNotesStatus').textContent=error.message}finally{busy=false;del.disabled=false}
});
document.addEventListener('click',e=>{if(e.target.closest('#cpRefTab-notas'))load();if(e.target.closest('#cpAddNote')){e.preventDefault();e.stopImmediatePropagation();$('cpRefTab-notas')?.click();begin()}},true);
window.addEventListener('tpf:contact-open',()=>{epoch++;reset();rows=[];paint();load()});
load();
})();
