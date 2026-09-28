'use strict';
const fs=require('node:fs'),vm=require('node:vm'),{performance}=require('node:perf_hooks');
function harness(sourcePath='js/modules/contacts-sales-core.js'){
 const nodes=new Map();let boardWrites=0,cardRenders=0,listRenders=0;
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',_html:'',classList:{toggle(){}},set innerHTML(v){this._html=v;if(id==='salesBoard')boardWrites++},get innerHTML(){return this._html}});return nodes.get(id)};
 const ctx={window:{TPFOfferFollowup:{salesControls(){},html(){cardRenders++;return ''}}},salesCurrentView:'list',salesCache:{fields:[],stages:Array.from({length:7},(_,i)=>({id:String(i),name:'Etapa '+i})),opportunities:Array.from({length:1000},(_,i)=>({id:String(i),stage_id:String(i%7),title:'Oferta '+i,phone:'600000000',client_name:'Cliente '+i,status:'open',amount:41,expected_date:'2026-10-01'}))},$:node,esc:String,fmtMoney:String,fmtDateOnly:String,salesFilteredOpps:()=>ctx.salesCache.opportunities,refreshSalesBulkStages(){},refreshVisibleSalesStateFilter(){},updateSalesBulkUi(){},applyVisibleSalesStateFilter(){},setTimeout(){},renderSalesList(){listRenders++},document:{querySelector:()=>node('viewport')},localStorage:{setItem(){}}};
 vm.createContext(ctx);const source=fs.readFileSync(sourcePath,'utf8');vm.runInContext(source.slice(source.indexOf('function renderSales(){'),source.indexOf('\nwindow.filterSalesByStage=')),ctx);
 return {ctx,nodes,get counts(){return {boardWrites,cardRenders,listRenders}}};
}
if(require.main===module){for(const file of process.argv.slice(2).length?process.argv.slice(2):['js/modules/contacts-sales-core.js']){const h=harness(file);for(let i=0;i<5;i++)h.ctx.renderSales();const times=[];for(let i=0;i<25;i++){const start=performance.now();h.ctx.renderSales();times.push(performance.now()-start)}times.sort((a,b)=>a-b);console.log(JSON.stringify({file,fixture:'1000 opportunities, 7 stages, list view; no network or DOM layout',medianMs:+times[12].toFixed(2),...h.counts}));}}
module.exports={harness};
