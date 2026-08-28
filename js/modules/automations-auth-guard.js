(function(){
  'use strict';
  const M=window.TPFModules;if(!M)return;
  M.register('auth-guard',{install(){
    function installGuard(){
      const client=window.sb;if(!client||typeof client.rpc!=='function'||client.rpc.__tpfAuthGuard)return false;
      const original=client.rpc.bind(client);
      const guarded=async function(fn,args,options){if(fn==='admin_list_users_permissions'){try{const result=await client.auth.getSession();const session=result?.data?.session;if(!session?.user)return {data:[],error:null};}catch(_){return {data:[],error:null};}}return original(fn,args,options);};
      guarded.__tpfAuthGuard=true;guarded.__tpfOriginal=original;client.rpc=guarded;return true;
    }
    if(!installGuard()){let tries=0;const timer=setInterval(()=>{tries++;if(installGuard()||tries>=80)clearInterval(timer);},25);}
  }});
})();
