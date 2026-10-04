const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={window:{},Intl};vm.createContext(ctx);vm.runInContext(fs.readFileSync('js/modules/offers-pro.js','utf8'),ctx);
const fn=ctx.window.TPFOffersPro.groupOfferMessages;
const messages=['Hola Fran, oferta:\nAmazon: 27 €/mes','Hola Fran, oferta:\nNetflix: 32 €/mes'];
const both=fn(messages,'Fran','Vodafone',59);
assert.match(both,/Amazon: 27/);assert.match(both,/Netflix: 32/);assert.ok(both.endsWith('Precio total de los servicios: 59,00 €/mes'));
assert.doesNotMatch(fn(messages,'Fran','Vodafone'),/Precio total de los servicios/);
assert.ok(fn(messages,'Fran','Vodafone',55.5).endsWith('55,50 €/mes'));
console.log('PASS grouped service totals preserve individual prices and exclude alternatives');
