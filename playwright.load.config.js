const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({testDir:'./tests/load',testMatch:'*.spec.js',timeout:45000,retries:0,workers:1,reporter:'list',use:{baseURL:'http://127.0.0.1:4174',viewport:{width:1440,height:900},serviceWorkers:'block'},webServer:{command:'node tests/load/server.cjs',url:'http://127.0.0.1:4174',reuseExistingServer:false}});
