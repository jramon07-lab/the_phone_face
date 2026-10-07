(function(){
'use strict';
const M=window.TPFModules;if(!M)return;
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const operators=['Vodafone','MásMóvil','Yoigo','O2','Orange','Lowi','Jazztel','Digi','Pepephone','Movistar','Otro'];
function addStyle(){if($('tpfReviewStyle'))return;const s=document.createElement('style');s.id='tpfReviewStyle';s.textContent=`
#cpNewReview{border-color:#c7d7fe!important;background:#eff4ff!important;color:#155eef!important}
.tpfReviewBack{position:fixed;inset:0;z-index:100600;background:#10182899;display:grid;place-items:center;padding:16px}
.tpfReviewCard{width:min(640px,100%);max-height:calc(100dvh - 32px);display:flex;flex-direction:column;background:#fff;color:#101828;border-radius:16px;box-shadow:0 24px 60px #0004;overflow:hidden}
.tpfReviewHead,.tpfReviewFoot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px}
.tpfReviewHead{border-bottom:1px solid #e4e7ec}.tpfReviewHead h2{margin:0 0 5px;font-size:21px}.tpfReviewHead small{color:#667085}
.tpfReviewBody{padding:0 20px 18px;overflow:auto}.tpfReviewField{display:block;margin-top:16px;font-size:14px;font-weight:600}.tpfReviewField[hidden]{display:none!important}
.tpfReviewField input,.tpfReviewField textarea,.tpfReviewField select{display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:10px;border:1px solid #d0d5dd;border-radius:8px;background:white;color:#101828;font:inherit}
.tpfReviewField textarea{min-height:68px;resize:vertical}.tpfReviewDates{display:grid;grid-template-columns:1fr 1fr;gap:12px}.tpfReviewPreview{margin-top:16px;padding:12px;border-radius:9px;background:#f4f7fb;font-size:14px;line-height:1.5;color:#475467}.tpfReviewPreview b{display:block;color:#101828}.tpfReviewFoot{border-top:1px solid #e4e7ec;justify-content:flex-end}.tpfReviewCard button{border:1px solid #d0d5dd;border-radius:8px;background:white;padding:10px 14px;font-weight:600;cursor:pointer}.tpfReviewFoot .primary{background:#155eef;color:white;border-color:#155eef}.tpfReviewError{color:#b42318;margin:12px 0 0}.tpfReviewError:empty{display:none}
@media(max-width:560px){.tpfReviewDates{grid-template-columns:1fr}.tpfReviewHead,.tpfReviewFoot{padding:14px}.tpfReviewBody{padding:0 14px 14px}}
`;document.head.appendChild(s)}
function current(){try{return currentContact||null}catch(_){return null}}
function opportunities(){try{return salesCache?.opportunities||[]}catch(_){return window.salesCache?.opportunities||[]}}
function startDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;const d=new Date(value+'T12:00:00'),day=d.getDate();if(!Number.isFinite(d.getTime()))return null;d.setDate(1);d.setMonth(d.getMonth()-1);d.setDate(Math.min(day,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()));if(d.getDate()===1)d.setDate(2);return d}
function close(){document.querySelector('.tpfReviewBack')?.remove()}
async function open(contactOverride){
 let contact=contactOverride?.id?contactOverride:current();if(!contact)return;
 if(window.TPFSelectSaleParty){try{contact=await window.TPFSelectSaleParty(contact);if(!contact)return}catch(e){alert(e.message);return}}
 addStyle();close();
 const ids=[contact.id,contact.managerId,contact.recipientId].filter(Boolean).map(String);
 const candidates=opportunities().filter(o=>{const p=o.contract_party||{};return !/^REVISIÓN /i.test(o.title||'')&&[o.record_id,p.holder_record_id,p.holder_contact_id,p.manager_record_id,p.manager_contact_id].some(id=>id&&ids.includes(String(id)))}).sort((a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||'')));
 const requestKey=crypto.randomUUID(),root=document.createElement('div');root.className='tpfReviewBack';
 root.innerHTML='<section class="tpfReviewCard" role="dialog" aria-modal="true" aria-labelledby="tpfReviewHeading"><header class="tpfReviewHead"><div><h2 id="tpfReviewHeading">Crear revisión</h2><small>Revisa las fechas y el inicio del seguimiento antes de guardar.</small></div><button type="button" data-close aria-label="Cerrar revisión">×</button></header><div class="tpfReviewBody"><label class="tpfReviewField">Datos de una oportunidad<select id="tpfReviewSource"><option value="">Introducir datos manualmente</option>'+candidates.map((o,i)=>'<option value="'+i+'">'+esc(o.title)+' · '+esc(o.contract_party?.holder_name||o.client_name||contact.name||'')+'</option>').join('')+'</select></label><label class="tpfReviewField">Operador<select id="tpfReviewOperator"><option value="">Selecciona un operador</option>'+operators.map(x=>'<option>'+esc(x)+'</option>').join('')+'</select></label><label id="tpfOtherOperatorWrap" class="tpfReviewField" hidden>Otro operador<input id="tpfOtherOperator" maxlength="60" placeholder="Escribe el operador"></label><div class="tpfReviewDates"><label class="tpfReviewField">Fin de descuento<input id="tpfReviewDate" type="date" required></label><label class="tpfReviewField">Fin de permanencia del terminal<input id="tpfReviewTerminal" type="date"></label></div><label class="tpfReviewField">Nota (opcional)<textarea id="tpfReviewNote" maxlength="1500" placeholder="Añade información para la revisión"></textarea></label><div class="tpfReviewPreview"><b id="tpfReviewTitle">REVISIÓN</b><span id="tpfReviewDestination"></span><div>Podrás revisar y cancelar el aviso en Revisiones del mes.</div></div><p class="tpfReviewError" role="alert"></p></div><footer class="tpfReviewFoot"><button type="button" data-close>Cancelar</button><button id="tpfReviewSave" type="button" class="primary">Crear revisión</button></footer></section>';
 document.body.appendChild(root);
 const source=$('tpfReviewSource'),op=$('tpfReviewOperator'),input=$('tpfReviewDate'),terminal=$('tpfReviewTerminal'),other=$('tpfOtherOperator'),wrap=$('tpfOtherOperatorWrap'),error=root.querySelector('[role=alert]');
 const selected=()=>op.value==='Otro'?other.value.trim():op.value;
 const preview=()=>{wrap.hidden=op.value!=='Otro';$('tpfReviewTitle').textContent=selected()?'REVISIÓN '+selected().toUpperCase():'REVISIÓN';const d=startDate(input.value);$('tpfReviewDestination').textContent=d?'Inicio del seguimiento: '+d.toLocaleDateString('es-ES')+' · En horario de atención.':'Indica el fin de descuento para calcular el inicio del seguimiento.'};
 source.onchange=()=>{const o=source.value===''?null:candidates[Number(source.value)];input.value=o?.discount_end_date||'';terminal.value=o?.terminal_commitment_end||'';const name=o?.installation_operator||(o?.title||'').match(/vodafone|másmóvil|masmovil|yoigo|o2|orange|lowi|jazztel|digi|pepephone|movistar/i)?.[0]||'';const known=operators.find(x=>x.localeCompare(name,'es',{sensitivity:'base'})===0);op.value=known|| (name?'Otro':'');other.value=known?'':name;preview()};
 if(candidates.length===1){source.value='0';source.onchange()}else preview();
 root.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);op.onchange=preview;other.oninput=preview;input.onchange=preview;
 root.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('tpfReviewSave').disabled)close()});
 $('tpfReviewSave').onclick=async()=>{
  error.textContent='';const value=input.value,name=selected();if(!name){error.textContent='Indica el operador.';op.focus();return}if(!startDate(value)){error.textContent='Indica una fecha de fin de descuento.';input.focus();return}
  const save=$('tpfReviewSave');for(const el of root.querySelectorAll('input,select,textarea,button'))el.disabled=true;
  try{const data=await sb.rpc('crm_create_manual_review_v2',{p_contact:contact.id,p_operator:name,p_discount_end:value,p_note:$('tpfReviewNote').value.trim(),p_request_key:requestKey,p_manager:contact.managerId||contact.id,p_recipient:contact.recipientId||contact.id,p_terminal_commitment_end:terminal.value||null});if(data.error)throw data.error;
   close();try{await window.loadSales?.();await window.TPFReviews?.reload();if(typeof renderContactProfile==='function')await renderContactProfile()}catch(_){alert('La revisión se ha guardado. No se pudo actualizar la vista; vuelve a abrir Revisiones del mes.')}
  }catch(e){error.textContent=e?.message||'No se pudo guardar la revisión. Tus datos se conservan.'}finally{for(const el of root.querySelectorAll('input,select,textarea,button'))el.disabled=false}
 };
}
window.TPFContactReview={async openForContact(c){if(typeof loadSales==='function')await loadSales();return open(c)}};
function mount(){addStyle();const task=$('cpNewTask');if(!task||$('cpNewReview'))return;const b=document.createElement('button');b.type='button';b.id='cpNewReview';b.textContent='＋ Revisión';b.title='Crear revisión';b.onclick=open;task.after(b)}
M.register('contact-review-action',{install(){mount();window.addEventListener('tpf:contact-open',mount);setInterval(()=>{if(!$('contactModal')?.classList.contains('hidden'))mount()},900)}});
})();
