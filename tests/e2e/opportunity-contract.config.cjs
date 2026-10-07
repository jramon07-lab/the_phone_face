const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({testDir:'.',testMatch:'crm-opportunity-contract.spec.js',timeout:30000,workers:1,retries:0,use:{headless:true},reporter:'line'});
