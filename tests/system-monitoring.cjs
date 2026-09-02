const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const desktop=read('js/modules/system-monitoring.js');
const mobile=read('js/mobile-system-monitor.js');
const app=read('js/mobile-app.js');
const index=read('index.html');
const mobileIndex=read('movil/index.html');
const migration=read('supabase/migrations/20260902210000_crm_system_monitoring.sql');
const pendingFix=read('supabase/migrations/20260902213000_crm_system_health_pending_agenda.sql');
const invokerFix=read('supabase/migrations/20260902214500_crm_system_monitoring_rpc_invoker.sql');

assert.match(index,/js\/modules\/system-monitoring\.js/);
assert.match(mobileIndex,/js\/mobile-system-monitor\.js[^]*js\/mobile-app\.js/);
assert.match(desktop,/id='tpfIncidentRegistry'|id="tpfIncidentRegistry"/);
assert.match(desktop,/id='tpfMaintenanceCard'|id="tpfMaintenanceCard"/);
assert.match(desktop,/systemExportDiagnostic/);
assert.match(desktop,/window\.tpfBuildDiagnostic=diagnostic/);
assert.match(desktop,/schema:'tpf-diagnostic-v1'/);
assert.match(desktop,/\[REDACTADO\]/);
assert.match(desktop,/crm_report_system_event/);
assert.match(desktop,/crm_system_health_snapshot/);
assert.match(desktop,/crm_cleanup_system_events/);
assert.match(desktop,/SAFE_CACHE_NAME/);
assert.match(desktop,/Siempre protegido:<\/b> contactos, oportunidades, tareas, agenda, chats, archivos de clientes, plantillas, usuarios, sesiones y configuración/);
assert.doesNotMatch(desktop,/localStorage\.clear\s*\(/);
assert.doesNotMatch(desktop,/sessionStorage\.clear\s*\(/);
assert.doesNotMatch(mobile,/localStorage\.clear\s*\(/);
assert.doesNotMatch(mobile,/sessionStorage\.clear\s*\(/);

assert.match(app,/case 'system':if\(!state\.perms\?\.is_admin\)/);
assert.match(app,/state\.perms\?\.is_admin\?'<button class="m-secondary" data-action="route" data-route="system">/);
assert.match(app,/action\.startsWith\('system-'\)/);
assert.match(mobile,/window\.TPFMobileSystem=\{start,stop,render,refresh,handle,report\}/);
assert.match(mobile,/Protegido:<\/b> contactos, ventas, tareas, agenda, chats, archivos, usuarios, sesión y configuración/);

assert.match(migration,/alter table public\.crm_system_events enable row level security/);
assert.match(migration,/using \(public\.current_user_is_admin\(\)\)/);
assert.match(migration,/revoke all on public\.crm_system_events from anon, authenticated/);
assert.match(migration,/where status in \('resolved', 'ignored'\)/);
assert.match(migration,/and status = 'pending'/);
assert.match(pendingFix,/whatsapp_enabled is true and status = 'pending'/);
assert.match(invokerFix,/security invoker/);
assert.match(invokerFix,/private\.crm_system_health_snapshot_impl\(\) to authenticated/);

for(const protectedTable of ['records','sales_opportunities','agenda_items','whatsapp_jobs','crm_server_automation_jobs']){
  const cleanup=migration.match(/create or replace function private\.crm_cleanup_system_events_impl[\s\S]*?\$\$;/i)?.[0]||'';
  assert.doesNotMatch(cleanup,new RegExp(`delete\\s+from\\s+public\\.${protectedTable}`,'i'));
}

console.log('system monitoring and safe maintenance guard: ok');
