'use strict';
const fs=require('node:fs'),assert=require('node:assert');
const source=fs.readFileSync('js/modules/automations-core.js','utf8');
const html=fs.readFileSync('index.html','utf8');

assert.match(source,/function legacyCommercialDashboardActive\(\)\{return !\$\('view-dashboard'\)\?\.classList\.contains\('tpfDashPro'\)\}/,'the legacy dashboard must detect when the compact dashboard owns the page');
assert.match(source,/agenda_items[\s\S]*if\(!legacyCommercialDashboardActive\(\)\)return;[\s\S]*\$\("dashContactToday"\)\.innerHTML/,'a late agenda response must not restore the large legacy contact rows');
assert.match(source,/if\(!legacyCommercialDashboardActive\(\)\)return;[\s\S]*\$\("dashPriorityFollowups"\)\.innerHTML/,'a late commercial response must not restore the large legacy follow-up rows');
assert.match(html,/automations-core\.js\?v=20260911-dashboard-race-1/,'the browser must receive the guarded dashboard script immediately');
console.log('dashboard first-paint race assertions passed');
