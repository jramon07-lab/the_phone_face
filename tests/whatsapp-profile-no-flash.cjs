const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('js/modules/whatsapp-five-fixes.js','utf8');
function element(){return{classList:{toggle(){}},style:{display:'block',setProperty(k,v){this[k]=v},removeProperty(k){delete this[k]}}};}
const elements={waSideCreateContact:element(),waSideOpenContact:element(),waAddTagSide:element()};
const sandbox={document:{getElementById:id=>elements[id]},waLiveState:{contact:{id:'one'},selected:{id:'34123456789@c.us'}},window:{},openModernWaContact(){}};
vm.createContext(sandbox);
vm.runInContext(source.slice(source.indexOf('function syncContactActions()'),source.indexOf('window.waSyncContactActions')),sandbox);
for(let i=0;i<10;i++){sandbox.syncContactActions();assert.equal(elements.waSideOpenContact.style.display,undefined,'no inline display override on refresh');}
sandbox.waLiveState.contact=null;sandbox.syncContactActions();
assert.equal(elements.waSideCreateContact.style.display,'block','new contacts still available');
const css=fs.readFileSync('assets/crm-reference.css','utf8');
assert.match(css,/@media \(min-width:1051px\)\{\s*body.tpfUnified #view-whatsapplive #waSideOpenContact\{display:none!important\}/,'hide from first paint, before fields initialize');
const fields=fs.readFileSync('js/modules/whatsapp-contact-fields.js','utf8');
assert.doesNotMatch(fields,/open.style.setProperty/,'no delayed visibility tug of war');
assert.match(fields,/JSON.parse\(api\(\).read\(current\(\)\?\.data,api\(\).fields.contactName\)\).filter\(Boolean\).join\(' '\)/,'copy real full name, not serialized fields or nickname');
console.log('PASS profile action visibility and copy name');
