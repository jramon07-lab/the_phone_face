const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({testDir:'.',testMatch:'crm-home-manage.spec.js',timeout:30000,use:{headless:true,trace:'off',video:'off',screenshot:'only-on-failure'}});
