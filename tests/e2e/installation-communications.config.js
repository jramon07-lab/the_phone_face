const {defineConfig,devices}=require('@playwright/test');
module.exports=defineConfig({testDir:'.',testMatch:['installation-communications.spec.js'],timeout:25000,use:{headless:true,trace:'off',video:'off',screenshot:'only-on-failure'},projects:[{name:'desktop',use:{viewport:{width:1440,height:1000}}},{name:'mobile',use:{...devices['iPhone 13'],defaultBrowserType:'chromium'}}]});
