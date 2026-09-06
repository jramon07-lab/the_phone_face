'use strict';
// Regression tests must never send messages or write live customer records.
const deny=()=>{throw Error('Network disabled in offline CRM tests');};
global.fetch=deny;for(const name of ['http','https']){const m=require('node:'+name);m.request=deny;m.get=deny;}
const net=require('node:net');net.connect=deny;net.createConnection=deny;
