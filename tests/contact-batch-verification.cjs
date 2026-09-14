'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs
  .readFileSync('js/modules/contact-batch-verification.js', 'utf8')
  .replace(
    'M.register("contact-batch-verification", { install });',
    'window.testApi = { analyzeRows, summary, label, whatsappLabel };',
  );
const context = {
  window: { TPFModules: {} },
  Map,
  Set,
  JSON,
  String,
  Array,
  Object,
  RegExp,
  Date,
  URLSearchParams,
};
vm.createContext(context);
vm.runInContext(source, context);
const { analyzeRows, summary } = context.window.testApi;

const norm = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es-ES');
const api = {
  contactData: (row) => row.c,
  googlePhones: (person = {}) => (person.phoneNumbers || []).map((item) => item.value),
  strictGoogleAligned: (person, c) =>
    norm(person.first) === norm(c.first) &&
    norm(person.last) === norm(c.last) &&
    norm(person.nickname) === norm(c.nickname),
  strictWhatsappAligned: (chat, c) => !!c.first && !!c.last && norm(chat.name) === norm(c.name),
  googleView: (person) => ({
    name: [person.first, person.last].filter(Boolean).join(' '),
    nickname: person.nickname || '',
  }),
};
const crm = (
  id,
  name = 'María Rosa Ortiz',
  nickname = 'Tienda',
  number = '622558518',
  extra = {},
) => ({
  id,
  data: extra,
  c: { id, first: 'María Rosa', last: 'Ortiz', name, nickname, phone: number },
});
const google = (
  id,
  first = 'María Rosa',
  last = 'Ortiz',
  nickname = 'Tienda',
  number = '622558518',
) => ({ resourceName: id, first, last, nickname, phoneNumbers: [{ value: '+34' + number }] });
const wa = (name = 'María Rosa Ortiz', number = '622558518') => ({
  id: '34' + number + '@c.us',
  name,
});

let result = analyzeRows(
  [crm('one')],
  [google('people/one')],
  [wa()],
  api,
  'shop@example.test',
);
assert.equal(result[0].status, 'coincide', 'CRM y Google iguales deben quedar en verde');
assert.equal(result[0].whatsappStatus, 'same', 'el WhatsApp exacto queda en su grupo verde');

result = analyzeRows(
  [crm('one')],
  [google('people/one')],
  [wa('María Rosa')],
  api,
  'shop@example.test',
);
assert.equal(result[0].status, 'coincide', 'un nombre distinto de WhatsApp no invalida CRM y Google');
assert.equal(result[0].whatsappStatus, 'different', 'el nombre distinto se separa en el segundo grupo verde');
let totals = summary(result);
assert.equal(totals.greenWhatsappSame, 0);
assert.equal(totals.greenWhatsappDifferent, 1);

result = analyzeRows(
  [crm('one')],
  [google('people/one')],
  [wa('María Rosa')],
  { ...api, savedVerification: () => true },
  'shop@example.test',
);
assert.equal(result[0].verified, true, 'una vinculación guardada debe reconocerse como verificada');
totals = summary(result);
assert.equal(totals.verified, 1);
assert.equal(totals.greenWhatsappDifferent, 0, 'los verificados no deben quedarse en el grupo pendiente');

result = analyzeRows(
  [crm('one')],
  [google('people/one', 'María Rosa', 'Ortiz', 'Otro apodo')],
  [wa()],
  api,
  'shop@example.test',
);
assert.equal(result[0].status, 'google_data_mismatch', 'un apodo distinto de Google sigue requiriendo revisión');

result = analyzeRows(
  [crm('one'), crm('two')],
  [google('people/one')],
  [wa()],
  api,
  'shop@example.test',
);
assert.ok(
  result.every((item) => item.status === 'crm_phone_duplicate'),
  'un número compartido por dos fichas CRM nunca se valida automáticamente',
);

result = analyzeRows(
  [crm('one')],
  [google('people/one'), google('people/two')],
  [wa()],
  api,
  'shop@example.test',
);
assert.equal(result[0].status, 'google_duplicate', 'dos contactos Google con el mismo teléfono requieren revisión');

result = analyzeRows(
  [
    crm('one', 'María Rosa Ortiz', 'Tienda', '622558518', {
      TPF_GOOGLE_CONTACT: { resource_name: 'people/own', google_account: 'shop@example.test' },
    }),
  ],
  [google('people/own'), google('people/other')],
  [wa()],
  api,
  'shop@example.test',
);
assert.equal(result[0].status, 'coincide', 'un vínculo explícito conserva la ficha correcta aunque se repita el teléfono');

const inline = fs.readFileSync('js/modules/contact-google-inline.js', 'utf8');
assert.match(inline, /function saveStrictVerification/, 'la verificación segura debe vivir junto a la revisión existente');
const saveSlice = inline.slice(
  inline.indexOf('async function saveStrictVerification'),
  inline.indexOf('async function reviewProfile'),
);
assert.match(saveSlice, /source:\s*["']verificacion_estricta["']/, 'el guardado seguro deja trazabilidad');
assert.doesNotMatch(saveSlice, /\bNOMBRE\s*=/, 'la validación masiva no puede reescribir el nombre');
assert.doesNotMatch(saveSlice, /\bAPELLIDOS\s*=/, 'la validación masiva no puede reescribir los apellidos');
assert.doesNotMatch(saveSlice, /\bAPODO\s*=/, 'la validación masiva no puede reescribir el apodo');
assert.match(source, /green_whatsapp_same/, 'debe separar el grupo cuyo WhatsApp coincide');
assert.match(source, /green_whatsapp_different/, 'debe separar el grupo cuyo WhatsApp tiene otro nombre');
assert.match(source, /Seleccionar todos de este grupo/, 'debe poder seleccionar todos los contactos del grupo');
assert.match(source, /Solo selecciona: no cambia ni guarda ninguna ficha/, 'seleccionar no puede modificar datos');
assert.match(source, /tpfBatchSelectRow/, 'cada contacto seleccionable debe tener su casilla');
assert.match(source, /Dar por OK y sincronizar/, 'la selección debe poder confirmarse de forma explícita');
assert.match(source, /confirmThreeWayVerified/, 'el lote debe usar la confirmación segura de los tres sitios');
assert.match(source, /Ya verificados/, 'los ya confirmados deben separarse de los pendientes');
assert.match(inline, /function confirmThreeWayVerified/, 'debe existir una confirmación que no reescriba Google ni WhatsApp');
assert.match(inline, /source: "crm_google_confirmed"/, 'la vinculación de los tres sitios deja trazabilidad');
console.log('PASS comprobación masiva: separa los verdes por nombre de WhatsApp y solo marca la selección');
