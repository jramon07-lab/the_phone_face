const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const desktop=read('js/modules/system-monitoring.js');
const statusCore=read('js/modules/system-status-core.js');
const mobile=read('js/mobile-system-monitor.js');
const app=read('js/mobile-app.js');
const index=read('index.html');
const mobileIndex=read('movil/index.html');
const migration=read('supabase/migrations/20260902210000_crm_system_monitoring.sql');
const pendingFix=read('supabase/migrations/20260902213000_crm_system_health_pending_agenda.sql');
const invokerFix=read('supabase/migrations/20260902214500_crm_system_monitoring_rpc_invoker.sql');
const manualCleanup=read('supabase/migrations/20260902215500_crm_system_events_manual_cleanup.sql');

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
assert.match(desktop,/crm_clear_closed_system_events/);
assert.match(desktop,/crm_delete_closed_system_event/);
assert.match(desktop,/<option value="active" selected>Activas/);
assert.match(desktop,/data-system-delete/);
assert.match(desktop,/Vaciar historial cerrado/);
assert.match(desktop,/SAFE_CACHE_NAME/);
assert.match(desktop,/item\.module==='isolation-test'&&item\.error==='fallo-controlado'/);
assert.match(desktop,/navigator\.webdriver===true/);
assert.match(desktop,/version\(\)\.toLowerCase\(\)==='local'/);
assert.match(desktop,/tpf:system-request-recovered/);
assert.match(desktop,/item\?\.route===recoveryRoute/);
assert.match(desktop,/item\?\.app_version===build&&item\?\.device===currentDevice/);
assert.match(desktop,/Date\.parse\(item\?\.last_seen_at/);
assert.match(statusCore,/isExpectedSystemProbe/);
assert.match(statusCore,/api\.github\.com\/repos\/jramon07-lab\/the_phone_face\/actions\/runs/);
assert.match(statusCore,/transientNetworkFailures/);
assert.match(statusCore,/failures!==3/);
assert.match(statusCore,/tpf:system-request-recovered/);
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
assert.match(mobile,/incidentView='active'/);
assert.match(mobile,/system-filter-active/);
assert.match(mobile,/system-filter-history/);
assert.match(mobile,/crm_delete_closed_system_event/);
assert.match(mobile,/crm_clear_closed_system_events/);
assert.match(mobile,/data-action="system-delete"/);

assert.match(migration,/alter table public\.crm_system_events enable row level security/);
assert.match(migration,/using \(public\.current_user_is_admin\(\)\)/);
assert.match(migration,/revoke all on public\.crm_system_events from anon, authenticated/);
assert.match(migration,/where status in \('resolved', 'ignored'\)/);
assert.match(migration,/and status = 'pending'/);
assert.match(pendingFix,/whatsapp_enabled is true and status = 'pending'/);
assert.match(invokerFix,/security invoker/);
assert.match(invokerFix,/private\.crm_system_health_snapshot_impl\(\) to authenticated/);
assert.match(manualCleanup,/create or replace function public\.crm_delete_closed_system_event\(p_id bigint\)/);
assert.match(manualCleanup,/create or replace function public\.crm_clear_closed_system_events\(\)/);
assert.match(manualCleanup,/if not public\.current_user_is_admin\(\) then/);
assert.match(manualCleanup,/delete from public\.crm_system_events\s+where id = p_id\s+and status in \('resolved', 'ignored'\)/);
assert.match(manualCleanup,/delete from public\.crm_system_events\s+where status in \('resolved', 'ignored'\)/);
assert.match(manualCleanup,/revoke all on function public\.crm_delete_closed_system_event\(bigint\) from public, anon, authenticated/);

for(const protectedTable of ['records','sales_opportunities','agenda_items','whatsapp_jobs','crm_server_automation_jobs']){
  const cleanup=migration.match(/create or replace function private\.crm_cleanup_system_events_impl[\s\S]*?\$\$;/i)?.[0]||'';
  assert.doesNotMatch(cleanup,new RegExp(`delete\\s+from\\s+public\\.${protectedTable}`,'i'));
  assert.doesNotMatch(manualCleanup,new RegExp(`delete\\s+from\\s+public\\.${protectedTable}`,'i'));
}

console.log('system monitoring and safe maintenance guard: ok');
