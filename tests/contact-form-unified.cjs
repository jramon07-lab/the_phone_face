const fs=require('fs');
const assert=require('assert');

const contacts=fs.readFileSync('js/modules/contacts-list-ui.js','utf8');
const whatsapp=fs.readFileSync('js/modules/whatsapp-ui-fixes.js','utf8');

for(const id of ['tpfCreateFirst','tpfCreateLast','tpfCreateNickname','tpfCreatePhone','tpfCreateDni','tpfCreateEmail','tpfCreateBank','tpfCreateNotes','tpfCreateObs','tpfCreateLabels']){
  assert(contacts.includes(`id="${id}"`),`Falta ${id} en el formulario compartido`);
}
assert(contacts.includes("'APODO':nickname"),'El apodo no se guarda al crear o editar');
assert(contacts.includes("p_label_ids:ids"),'Las etiquetas no se guardan');
assert(contacts.includes("startsWith('0034')")&&contacts.includes("startsWith('34')"),'No se normaliza el prefijo español');
assert(contacts.includes('/^[6789]\\d{8}$/'),'La retirada del prefijo no valida un número español de nueve cifras');
assert(whatsapp.includes("$('tpfContactsAdd')"),'WhatsApp no reutiliza el formulario compartido');
assert(whatsapp.includes("tpfCreateNickname:''")&&whatsapp.includes("tpfCreateLabels")===false,'WhatsApp debe rellenar el formulario común sin crear otro campo de etiquetas');
assert(whatsapp.includes("$('tpfWaCreateBack')?.remove()"),'El formulario exclusivo anterior de WhatsApp no queda desactivado');
console.log('Formulario de contacto unificado: OK');
