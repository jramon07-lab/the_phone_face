const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({testDir:'.',testMatch:'crm-outside-hours.spec.js',timeout:30000,workers:1,retries:0,use:{headless:true},reporter:'line'});
