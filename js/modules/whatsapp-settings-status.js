(function () {
  'use strict';
  if (window.TPFWhatsAppSettingsStatus) return;

  const keys = ['crm_server_scheduled_whatsapp_enabled', 'crm_server_automations_enabled'];
  const byId = id => document.getElementById(id);
  let inFlight = null;
  let lastChecked = 0;

  function settingValue(rows, key) {
    const value = Array.isArray(rows) ? rows.find(row => row.key === key)?.value : undefined;
    return value === true || value === false ? value : null;
  }

  function providerValue(response, payload) {
    if (!response?.ok || payload?.ok !== true || payload.degraded === true ||
        payload.providerHealthy === false || Number(payload.providerStatus) >= 400) return 'unknown';
    const state = String(payload.state || payload.data?.stateInstance || '').toLowerCase();
    if (state === 'authorized') return 'authorized';
    if (['notauthorized', 'blocked', 'sleepmode', 'starting', 'yellowcard'].includes(state)) return 'disconnected';
    return 'unknown';
  }

  function summarize(scheduled, automations, provider) {
    if (provider === 'disconnected') return {
      state: 'disconnected', title: 'WhatsApp necesita revisión',
      detail: 'La conexión no está autorizada para enviar. Revisa WhatsApp antes de dar los envíos por operativos.'
    };
    if (provider === 'unknown' || scheduled === null || automations === null) return {
      state: 'unknown', title: 'Estado sin comprobar',
      detail: 'No se ha podido confirmar el estado completo. Vuelve a consultar para comprobar los envíos automáticos.'
    };
    if (scheduled && automations) return {
      state: 'active', title: 'Envío automático en servidor activo',
      detail: 'WhatsApp está autorizado y los envíos están habilitados en el servidor, sin necesitar el CRM abierto.'
    };
    return {
      state: 'paused', title: scheduled || automations ? 'Envío automático parcialmente habilitado' : 'Envío automático desactivado',
      detail: 'WhatsApp está autorizado. Revisa qué procesos están habilitados en el detalle inferior.'
    };
  }

  function render(scheduled, automations, provider) {
    const status = summarize(scheduled, automations, provider);
    const card = byId('whatsappSettingsStatus');
    if (card) card.dataset.state = status.state;
    const values = {
      whatsappSettingsTitle: status.title,
      whatsappSettingsDetail: status.detail,
      whatsappSettingsProvider: provider === 'authorized' ? 'Autorizado' : provider === 'disconnected' ? 'No autorizado para enviar' : 'Sin comprobar',
      whatsappSettingsScheduled: scheduled === null ? 'Sin comprobar' : scheduled ? 'Habilitados' : 'Desactivados',
      whatsappSettingsAutomations: automations === null ? 'Sin comprobar' : automations ? 'Habilitadas' : 'Desactivadas'
    };
    for (const [id, value] of Object.entries(values)) {
      const element = byId(id);
      if (element) element.textContent = value;
    }
  }

  async function readSettings(signal) {
    const client = typeof sb !== 'undefined' ? sb : window.sb;
    if (!client) throw new Error('settings_unavailable');
    let query = client.from('app_settings').select('key,value').in('key', keys);
    if (typeof query.abortSignal === 'function') query = query.abortSignal(signal);
    const result = await query;
    if (result.error) throw new Error('settings_unavailable');
    return result.data;
  }

  async function readProvider(signal) {
    // api-auth.js adds the current session to this same-origin, read-only request.
    const response = await window.fetch('/api/green?action=state', { method: 'GET', cache: 'no-store', signal });
    const payload = await response.json();
    return providerValue(response, payload);
  }

  function refresh() {
    if (inFlight) return inFlight;
    const button = byId('whatsappSettingsRefresh');
    const card = byId('whatsappSettingsStatus');
    if (!card) return Promise.resolve();
    card.setAttribute('aria-busy', 'true');
    render(null, null, 'unknown');
    card.dataset.state = 'checking';
    byId('whatsappSettingsTitle').textContent = 'Consultando estado…';
    byId('whatsappSettingsDetail').textContent = 'Comprobando la conexión y la configuración del servidor.';
    byId('whatsappSettingsChecked').textContent = 'Consulta en curso';
    if (button) button.disabled = true;

    inFlight = (async () => {
      const controller = new AbortController();
      let timer;
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error('status_timeout')); }, 12000);
      });
      try {
        const [settings, provider] = await Promise.allSettled([
          Promise.race([readSettings(controller.signal), timeout]),
          Promise.race([readProvider(controller.signal), timeout])
        ]);
        const rows = settings.status === 'fulfilled' ? settings.value : null;
        render(settingValue(rows, keys[0]), settingValue(rows, keys[1]), provider.status === 'fulfilled' ? provider.value : 'unknown');
        lastChecked = Date.now();
        byId('whatsappSettingsChecked').textContent = 'Última consulta: ' + new Date(lastChecked).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      } finally {
        clearTimeout(timer);
        card.setAttribute('aria-busy', 'false');
        if (button) button.disabled = false;
        inFlight = null;
      }
    })();
    return inFlight;
  }

  function init() {
    const button = byId('whatsappSettingsRefresh');
    const view = byId('view-settings');
    if (!button || !view) return;
    button.addEventListener('click', refresh);
    const refreshWhenVisible = () => {
      if (!view.classList.contains('hidden') && (!lastChecked || Date.now() - lastChecked > 30000)) refresh();
    };
    new MutationObserver(refreshWhenVisible).observe(view, { attributes: true, attributeFilter: ['class'] });
    refreshWhenVisible();
  }

  window.TPFWhatsAppSettingsStatus = { refresh };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
