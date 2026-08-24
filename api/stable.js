const https = require('https');

function getText(url){
  return new Promise((resolve,reject)=>{
    https.get(url,{headers:{'User-Agent':'The-Phone-Face-Stable-Recovery'}},r=>{
      if(r.statusCode>=300 && r.statusCode<400 && r.headers.location){r.resume();return getText(r.headers.location).then(resolve,reject)}
      if(r.statusCode!==200){r.resume();return reject(new Error('HTTP '+r.statusCode))}
      let body='';r.setEncoding('utf8');r.on('data',c=>body+=c);r.on('end',()=>resolve(body));
    }).on('error',reject)
  })
}

const RECOVERY = `<script id="tpf-stable-recovery-v1">
(function(){
  function recover(){
    try{ localStorage.setItem('tpf_sidebar_collapsed','0'); }catch(e){}
    try{ if(typeof setSidebarCollapsed==='function') setSidebarCollapsed(false); else document.body.classList.remove('sidebarCollapsed'); }catch(e){}
    setTimeout(async function(){
      try{
        if(typeof loadAutomations==='function') await loadAutomations();
        var m=document.getElementById('auto2Msg');
        if(m && /crmAutomations|before initialization/i.test(m.textContent||'')) m.textContent='';
      }catch(e){ console.warn('TPF automation recovery',e); }
    },250);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',recover,{once:true}); else recover();
})();
</script>`;

module.exports=async function(req,res){
  try{
    const host=req.headers.host;
    const html=await getText('https://'+host+'/api/index?stable_base=1&t='+Date.now());
    const out=html.includes('</body>')?html.replace('</body>',RECOVERY+'\n</body>'):html+RECOVERY;
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Cache-Control','no-store, max-age=0');
    res.setHeader('X-TPF-Recovery','stable-v1');
    res.status(200).send(out);
  }catch(e){res.status(500).send('No se pudo cargar The Phone Face: '+(e?.message||e))}
};
