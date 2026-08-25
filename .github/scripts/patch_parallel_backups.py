from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')

nav_item = '      <div class="nav secondaryNav" data-view="backups"><b>💾</b><span>Copias de seguridad</span></div>'
if 'data-view="backups"' not in s:
    anchor = '      <div class="nav secondaryNav" data-view="labels"><b>🏷</b><span>Etiquetas</span></div>'
    if anchor not in s:
        raise SystemExit('No se encontró Etiquetas en el menú')
    s = s.replace(anchor, anchor + '\n' + nav_item, 1)

if 'id="view-backups"' not in s:
    section = '''
<section id="view-backups" class="hidden">
  <div class="pageHeader">
    <div>
      <h2>Copias de seguridad</h2>
      <div class="small">Crea, descarga y restaura copias completas del CRM.</div>
    </div>
    <button id="backupsReload" class="secondary">↻ Actualizar</button>
  </div>
  <div class="backupGrid" style="display:grid;grid-template-columns:minmax(300px,420px) 1fr;gap:16px">
    <div class="card">
      <h3>Crear copia</h3>
      <label>Nombre<input id="backupName" placeholder="Ej.: Antes de cambios importantes"></label>
      <button id="backupCreateNow" class="primary">Crear copia ahora</button>
      <div id="backupCreateMsg" class="small" style="margin-top:10px"></div>
    </div>
    <div class="card">
      <h3>Historial de copias</h3>
      <div id="backupHistory"></div>
      <div id="backupHistoryEmpty" class="small">No hay copias de seguridad.</div>
    </div>
  </div>
</section>
'''
    anchor = '<section id="view-settings" class="hidden">'
    if anchor not in s:
        raise SystemExit('No se encontró view-settings')
    s = s.replace(anchor, section + '\n' + anchor, 1)

if 'id="tpf-backups-ui-js"' not in s:
    js = r'''
<script id="tpf-backups-ui-js">
(function(){
  const byId=id=>document.getElementById(id);
  const escB=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]||m));
  const fmtB=v=>v?new Date(v).toLocaleString("es-ES"):"";

  async function loadBackups(){
    const box=byId("backupHistory"), empty=byId("backupHistoryEmpty");
    if(!box)return;
    box.innerHTML='<div class="small">Cargando...</div>';
    const {data,error}=await sb.from("crm_backups").select("id,name,created_at,row_counts,app_version,note").order("created_at",{ascending:false}).limit(100);
    if(error){box.innerHTML='<div class="small">'+escB(error.message)+'</div>';if(empty)empty.style.display="none";return;}
    const rows=data||[];
    if(empty)empty.style.display=rows.length?"none":"block";
    box.innerHTML=rows.map(r=>{
      const counts=r.row_counts&&typeof r.row_counts==="object"?Object.entries(r.row_counts).map(([k,v])=>k+": "+v).join(" · "):"";
      return '<div class="card" style="padding:13px;margin:9px 0"><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><b>'+escB(r.name||"Copia de seguridad")+'</b><div class="small">'+escB(fmtB(r.created_at))+(counts?' · '+escB(counts):'')+'</div></div><div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end"><button class="secondary" data-backup-download="'+escB(r.id)+'">Descargar JSON</button><button class="danger" data-backup-restore="'+escB(r.id)+'">Restaurar</button></div></div>'+(r.note?'<div class="small" style="margin-top:6px">'+escB(r.note)+'</div>':'')+'</div>';
    }).join("");
  }

  async function createBackup(){
    const btn=byId("backupCreateNow"),msg=byId("backupCreateMsg");
    const name=(byId("backupName")?.value||"").trim()||("Copia "+new Date().toLocaleString("es-ES"));
    if(btn)btn.disabled=true;if(msg)msg.textContent="Creando copia...";
    const {error}=await sb.rpc("crm_make_backup",{p_name:name,p_app_version:"parallel-20260825",p_note:null});
    if(btn)btn.disabled=false;
    if(error){if(msg)msg.textContent=error.message;return;}
    if(msg)msg.textContent="Copia creada correctamente.";
    if(byId("backupName"))byId("backupName").value="";
    await loadBackups();
  }

  async function downloadBackup(id){
    const {data,error}=await sb.from("crm_backups").select("id,name,created_at,snapshot,row_counts,app_version,note").eq("id",id).single();
    if(error){alert(error.message);return;}
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=(data.name||"the-phone-face-backup").replace(/[^a-z0-9_-]+/gi,"-")+".json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }

  async function restoreBackup(id){
    if(!confirm("¿Restaurar esta copia? Se creará una copia preventiva antes de restaurar."))return;
    const {error}=await sb.rpc("crm_restore_backup",{p_backup_id:id});
    if(error){alert(error.message);return;}
    alert("Copia restaurada correctamente.");location.reload();
  }

  document.addEventListener("click",e=>{
    if(e.target.closest('[data-view="backups"]'))setTimeout(loadBackups,0);
    if(e.target.id==="backupsReload")loadBackups();
    if(e.target.id==="backupCreateNow")createBackup();
    const d=e.target.closest('[data-backup-download]');if(d)downloadBackup(d.getAttribute('data-backup-download'));
    const r=e.target.closest('[data-backup-restore]');if(r)restoreBackup(r.getAttribute('data-backup-restore'));
  });

  setInterval(()=>{
    try{if(window.perms?.is_admin){document.querySelectorAll('[data-view="labels"],[data-view="backups"]').forEach(el=>{el.classList.remove("hidden");el.style.display="";});}}catch(_){}
  },1500);
})();
</script>
'''
    if '</body>' not in s:
        raise SystemExit('No se encontró </body>')
    s = s.replace('</body>', js + '\n</body>', 1)

p.write_text(s, encoding='utf-8')
