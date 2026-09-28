'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {harness}=require('../scripts/benchmark-sales-render.cjs');const h=harness();
h.ctx.renderSales();assert.equal(h.counts.boardWrites,0);assert.equal(h.counts.cardRenders,0);assert.equal(h.counts.listRenders,1);
const main=fs.readFileSync('js/core/20-main.js','utf8');vm.runInContext(main.slice(main.indexOf('function setSalesView(mode){'),main.indexOf('\nif($("salesViewBoard"))')),h.ctx);
h.ctx.setSalesView('board');assert.equal(h.counts.boardWrites,1);assert.equal(h.counts.cardRenders,1000);assert.match(h.nodes.get('salesBoard').innerHTML,/Oferta 999/);
h.ctx.setSalesView('list');assert.equal(h.counts.boardWrites,1);assert.equal(h.counts.listRenders,2);
h.ctx.salesCache.opportunities=[{id:'fresh',stage_id:'0',title:'Updated opportunity',status:'open'}];h.ctx.renderSales();h.ctx.setSalesView('board');assert.match(h.nodes.get('salesBoard').innerHTML,/Updated opportunity/);assert.doesNotMatch(h.nodes.get('salesBoard').innerHTML,/Oferta 999/);
console.log('PASS list skips 1000 hidden cards; switching to board renders current data');
