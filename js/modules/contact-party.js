(function(){
'use strict';
const W=typeof window==='undefined'?globalThis:window;
if(W.TPFContactParty)return;
const clean=v=>String(v??'').trim().replace(/\s+/g,' ');
const esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const el=id=>document.getElementById(id);
const nameCase=v=>clean(v).toLocaleLowerCase('es').replace(/(^|[\s'-])\p{L}/gu,c=>c.toLocaleUpperCase('es'));
function phone(v){let p=clean(v).replace(/\D/g,'');if(p.startsWith('00'))p=p.slice(2);if(p.length===9)p='34'+p;return p;}
const validPhone=v=>/^[1-9][0-9]{7,14}$/.test(phone(v));
function normalize(p={}){
  p=p||{};
  const same=p.same!==false,parts=clean(p.holder_name).split(' '),structured=Object.hasOwn(p,'holder_first_name')||Object.hasOwn(p,'holder_last_name');
  const first=same?'':nameCase(structured?p.holder_first_name:parts.shift()),last=same?'':nameCase(structured?p.holder_last_name:parts.join(' '));
  return {version:1,same,holder_first_name:first,holder_last_name:last,holder_name:[first,last].filter(Boolean).join(' '),holder_dni:same?'':clean(p.holder_dni).toUpperCase(),holder_phone:same?'':clean(p.holder_phone),recipient:!same&&p.recipient==='holder'?'holder':'contact'};
}
function validate(p){
  const x=normalize(p);
  if(!x.same&&!x.holder_name)throw new Error('Escribe el nombre y apellidos del titular.');
  if(x.recipient==='holder'&&!validPhone(x.holder_phone))throw new Error('Para enviar al titular, escribe su teléfono válido o elige la persona de contacto.');
  return x;
}
function contactValues(c={}){
  const d=c.data||c;
  return {name:clean(c.fullName||c.name||d['NOMBRE Y APELLIDOS']||[d.NOMBRE||c.first,d.APELLIDOS||c.last].filter(Boolean).join(' ')),phone:clean(c.phone||d['TELÉFONO']||d.TELEFONO||d.PHONE||d.MOVIL),dni:clean(c.dni||d['DNI / NIF']||d.DNI)};
}
function snapshot(p,c={}){
  const x=validate(p),v=contactValues(c);
  const hn=x.same?v.name:x.holder_name,hp=x.same?v.phone:x.holder_phone,hd=x.same?v.dni:x.holder_dni;
  return {...x,holder_name:hn,holder_phone:hp,holder_dni:hd,contact_name:v.name,contact_phone:v.phone,contact_dni:v.dni,recipient_name:x.recipient==='holder'?hn:v.name,recipient_phone:x.recipient==='holder'?hp:v.phone};
}
function search(c={}){const p=c.contract_party||c.data?.TPF_TITULAR||c.TPF_TITULAR;return p?.same===false?[p.holder_name,p.holder_dni,p.holder_phone].map(clean).join(' '):'';}
function hint(c={}){const p=c.contract_party||c.data?.TPF_TITULAR||c.TPF_TITULAR;return p?.same===false?`<small class="tpf-party-hint">Titular: ${esc(p.holder_name)}</small>`:'';}
function html(id,p={},opportunity=false){
  const x=normalize(p);
  return `<section id="${esc(id)}" class="tpf-party full" data-party-form><h3>Titular del contrato</h3><label class="tpf-party-check"><input data-party="same" type="checkbox" ${x.same?'checked':''}><span>El contacto es también el titular</span></label><div class="tpf-party-other" ${x.same?'hidden':''}><p>La persona de contacto sigue siendo quien gestiona el contrato.</p>${p?.holder_name&&!Object.hasOwn(p,'holder_first_name')&&!Object.hasOwn(p,'holder_last_name')?'<small>El nombre se guardó junto. Revisa la separación si tiene un nombre compuesto.</small>':''}<div class="tpf-party-grid"><label>Nombre del titular<input data-party="holder_first_name" value="${esc(x.holder_first_name)}" autocomplete="off"></label><label>Apellidos del titular<input data-party="holder_last_name" value="${esc(x.holder_last_name)}" autocomplete="off"></label><label>DNI / NIF del titular<input data-party="holder_dni" value="${esc(x.holder_dni)}" autocomplete="off"></label><label>Teléfono del titular (opcional)<input data-party="holder_phone" value="${esc(x.holder_phone)}" inputmode="tel" autocomplete="off"></label></div></div><div class="tpf-party-recipient"><label>Enviar los WhatsApp automáticos a<select data-party="recipient"><option value="contact" ${x.recipient==='contact'?'selected':''}>Persona de contacto</option><option value="holder" ${x.recipient==='holder'?'selected':''} ${x.same?'disabled':''}>Titular del contrato</option></select></label><small>El saludo utilizará el nombre de quien recibe el mensaje. El teléfono del titular solo es necesario si lo eliges como destinatario.</small></div>${opportunity?'<small class="tpf-party-foot">Estos datos se guardan en esta oportunidad. Editar después el contacto no cambia este contrato.</small>':''}</section>`;
}
function read(id){
  const root=el(id);if(!root)throw new Error('No se han cargado los datos del titular. Cierra y vuelve a abrir el formulario.');
  const get=k=>root.querySelector(`[data-party="${k}"]`);
  return validate({same:get('same').checked,holder_first_name:get('holder_first_name').value,holder_last_name:get('holder_last_name').value,holder_dni:get('holder_dni').value,holder_phone:get('holder_phone').value,recipient:get('recipient').value});
}
function fillContact(data={}){
  let root=el('tpfContactParty');const anchor=el('tpfCreateBank')?.closest('label');
  if(!root&&anchor){anchor.insertAdjacentHTML('afterend',html('tpfContactParty',data.TPF_TITULAR));return;}
  if(root)root.outerHTML=html('tpfContactParty',data.TPF_TITULAR);
}
function summary(p,c){
  if(!p)return '';
  let s;try{s=p.recipient_name!==undefined?p:snapshot(p,c);}catch(_){return '';}
  return `<section class="tpf-party tpf-party-summary"><h3>Titular del contrato</h3><strong>${esc(s.holder_name||'Sin indicar')}</strong><p>${s.same?'Es la persona de contacto':`DNI / NIF: ${esc(s.holder_dni||'Sin indicar')}<br>Teléfono: ${esc(s.holder_phone||'No indicado')}`}</p><div class="tpf-party-recipient"><b>WhatsApp automático</b><span>${esc(s.recipient_name||'Sin nombre')} · ${esc(s.recipient_phone||'Falta teléfono: no se podrá enviar')}</span></div></section>`;
}
function renderProfile(c){
  const anchor=document.querySelector('#contactModal .cpData');if(!anchor)return;
  const content=summary(c?.data?.TPF_TITULAR,c);let box=el('tpfContactPartySummary');
  if(!box){if(!content)return;box=document.createElement('div');box.id='tpfContactPartySummary';anchor.insertAdjacentElement('afterend',box);}
  if(box.innerHTML!==content)box.innerHTML=content;
}
function mountOpportunity(p){
  const anchor=el('oppModalPhone')?.closest('label');if(!anchor)return;
  const old=el('tpfOpportunityParty');const content=html('tpfOpportunityParty',p,true);
  if(old)old.outerHTML=content;else anchor.insertAdjacentHTML('afterend',content);
  el('tpfOpportunityParty').dataset.snapshot=JSON.stringify(p?.recipient_name!==undefined?p:null);
}
function readOpportunity(){const p=read('tpfOpportunityParty'),previous=JSON.parse(el('tpfOpportunityParty').dataset.snapshot||'null'),c={name:el('oppModalClient')?.value,phone:el('oppModalPhone')?.value,dni:previous?.contact_dni??el('oppModalDni')?.value};if(previous&&JSON.stringify(normalize(previous))===JSON.stringify(p)&&clean(c.name)===clean(previous.contact_name)&&clean(c.phone)===clean(previous.contact_phone))return previous;return snapshot(p,c);}
W.TPFContactParty={normalize,validate,snapshot,search,hint,html,read,fillContact,summary,renderProfile,mountOpportunity,readOpportunity,validPhone};
if(typeof document==='undefined')return;
const style=document.createElement('style');style.id='tpfContactPartyStyles';style.textContent=`
.tpf-party{box-sizing:border-box;grid-column:1/-1;background:#fff;border:1px solid #ddd6fe;border-top:3px solid #8b5cf6;border-radius:12px;padding:16px;margin:12px 0;color:#17243b;min-width:0}
.tpf-party h3{color:#6d28d9;font-size:15px;font-weight:700;margin:0 0 12px}.tpf-party p,.tpf-party small{font-size:12px;line-height:1.5;color:#64748b}.tpf-party label{display:flex!important;flex-direction:column;gap:6px;font-size:13px;font-weight:500;margin:0;min-width:0}
.tpf-party .tpf-party-check{flex-direction:row!important;align-items:center;gap:10px;color:#334155}.tpf-party input[type=checkbox]{width:18px!important;height:18px!important;min-height:18px!important;flex:0 0 18px;accent-color:#7c3aed;margin:0!important}
.tpf-party-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.tpf-party input:not([type=checkbox]),.tpf-party select{box-sizing:border-box;width:100%;min-width:0;height:40px;border:1px solid #cbd5e1;border-radius:8px;background:white;padding:8px 10px;color:#17243b;font:inherit}
.tpf-party .tpf-party-recipient{margin-top:14px;background:#eff6ff;border:1px solid #dbeafe;border-radius:9px;padding:12px;display:grid;gap:6px}.tpf-party-recipient label,.tpf-party-recipient b{color:#1d4ed8}.tpf-party-recipient span{font-size:13px;overflow-wrap:anywhere}.tpf-party [hidden]{display:none!important}.tpf-party-foot{display:block;margin-top:10px}.tpf-party-hint{display:block;color:#7c3aed;font-size:12px;margin-top:4px}.tpf-party-summary{margin:0 0 14px}.tpf-party-summary strong{font-size:14px}.tpf-party-summary p{margin:6px 0}
@media(max-width:640px){.tpf-party-grid{grid-template-columns:1fr}.tpf-party{padding:13px}.tpf-party input:not([type=checkbox]),.tpf-party select{font-size:16px}}
`;document.head.appendChild(style);
document.addEventListener('change',e=>{
  const root=e.target.closest?.('[data-party-form]');if(!root||e.target.dataset.party!=='same')return;
  const same=e.target.checked;root.querySelector('.tpf-party-other').hidden=same;
  const select=root.querySelector('[data-party="recipient"]');select.querySelector('[value="holder"]').disabled=same;if(same)select.value='contact';
});
})();
