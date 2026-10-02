const {defineConfig,devices}=require('@playwright/test');
module.exports=defineConfig({
 testDir:'.',testMatch:'router-return.spec.js',timeout:30000,
 use:{headless:true,trace:'off',video:'off',screenshot:'off'},
 projects:[{name:'desktop',use:{viewport:{width:1440,height:900}}},{name:'mobile',use:{...devices['iPhone 13'],defaultBrowserType:'chromium'}}]
});
