const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({testDir:'.',testMatch:'sales-chat.spec.js',timeout:30000,use:{headless:true,trace:'off',video:'off',screenshot:'off'},workers:1});
