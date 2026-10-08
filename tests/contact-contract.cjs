'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');const window={};vm.runInNewContext(fs.readFileSync('js/modules/contact-contract.js','utf8'),{window,globalThis:window});const api=window.TPFContactContract;
assert.equal(api.months('2028-03-31',-1),'2028-02-29');assert.equal(api.months('2024-02-29',12),'2025-02-28');
let t=api.timing({activation_date:'2025-11-08',discount_end:'2026-11-08'});assert.equal(t.start,'2026-10-08');assert.equal(t.difference,0);
t=api.timing({activation_date:'2026-01-01'});assert.equal(t.start,'2026-12-02');
t=api.timing({activation_date:'2026-01-08',discount_end:'2026-10-08'});assert(t.difference>31);assert.equal(t.start,'2026-09-08');
assert.throws(()=>api.date('2026-02-30'));assert.throws(()=>api.normalize({contracts:[{monthly_total:-4}]}));assert.throws(()=>api.normalize({contracts:[{services:{mobile_lines:1.5}}]}));
const c=api.normalize({relationship:'external',contracts:[{id:'one',operator:'Vodafone',monthly_total:'55,00',devices:[{model:'A55',monthly:12,remaining:8,included:true}]}]});assert.equal(c.contracts[0].monthly_total,55);assert.equal(c.contracts[0].devices[0].monthly,12);assert.equal(c.contracts[0].devices[0].included,true);assert.equal(c.relationship,'external');
console.log('PASS contract dates: natural months, leap years, dual dates, mismatch, optional facts, price validation and independent instalments');
