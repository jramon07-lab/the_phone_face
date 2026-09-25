const assert=require('node:assert/strict');
const {savedMedia}=require('../lib/green-saved-media');
process.env.SUPABASE_SERVICE_ROLE_KEY='test';process.env.SUPABASE_URL='https://db.test';
(async()=>{
 for(const [url,expected] of [['https://do-media-7107.fra1.digitaloceanspaces.com/123/file.pdf',true],['https://evil.test/123/file.pdf',false],['https://do-media-7107.fra1.digitaloceanspaces.com/999/file.pdf',false],['http://do-media-7107.fra1.digitaloceanspaces.com/123/file.pdf',false]]){
  let calls=0;const file={ok:true,headers:{get:()=> 'application/pdf'}};
  const result=await savedMedia('chat','message','123',async(u,o)=>{calls++;if(calls===1){assert.match(u,/chat_id=eq.chat/);assert.match(u,/id_message=eq.message/);return {ok:true,json:async()=>[{raw:{messageData:{fileMessageData:{downloadUrl:url}}}}]};}assert.equal(o.redirect,'error');return file;});
  assert.equal(Boolean(result),expected);assert.equal(calls,expected?2:1);
 }
 assert.equal(await savedMedia('chat','message','123',async()=>{throw Error('offline')}),null);
 console.log('PASS saved media retrieval, exact message lookup, blocked foreign hosts/instances, safe fallback');
})().catch(e=>{console.error(e);process.exit(1)});
