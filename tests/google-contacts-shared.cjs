const assert=require('assert');
process.env.SUPABASE_SERVICE_ROLE_KEY='service';process.env.SUPABASE_PUBLISHABLE_KEY='public';process.env.GOOGLE_DRIVE_CLIENT_ID='client';process.env.GOOGLE_DRIVE_CLIENT_SECRET='secret';process.env.CRM_BACKUP_ENCRYPTION_KEY='encryption';
const api=require('../api/google-contacts');
const value={refresh_token:'refresh-test',email:'equipo@example.com'},sealed=api._test.seal(value);
assert.deepEqual(api._test.unseal(sealed),value);
for(const path of ['people:searchContacts?query=600','people/me/connections?pageSize=1000','people:createContact','people/c123','people/c123:updateContact','people/c123:deleteContact'])assert.equal(api._test.validatePeoplePath(path),path);
for(const path of ['https://evil.test','../token','people/me','people/c123:unknown'])assert.throws(()=>api._test.validatePeoplePath(path));
const fs=require('fs'),path=require('path'),core=fs.readFileSync(path.join(__dirname,'../js/core/20-main.js'),'utf8'),inline=fs.readFileSync(path.join(__dirname,'../js/modules/contact-google-inline.js'),'utf8'),sales=fs.readFileSync(path.join(__dirname,'../js/modules/contacts-sales-core.js'),'utf8'),apiSource=fs.readFileSync(path.join(__dirname,'../api/google-contacts.js'),'utf8');
for(const source of [core,inline,sales]){assert(!source.includes('tpf_google_contacts_token'));assert(!source.includes('googleContactsToken'))}
assert(core.includes('/api/google-contacts?action='));assert(core.includes('Conectado en los dos PCs'));
assert.equal((apiSource.match(/Path=\/api\/;/g)||[]).length,2,'both OAuth nonce cookies must reach /api/google-contacts-callback');
assert(!apiSource.includes('Path=/api/google-contacts;'), 'the nonce cookie path must not exclude the callback route');
console.log('PASS: Google Contacts uses a shared encrypted server connection and a restricted People API proxy.');
