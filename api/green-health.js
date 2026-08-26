export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const id = process.env.GREEN_API_INSTANCE_ID || process.env.GREEN_API_ID_INSTANCE || process.env.GREEN_API_IDINSTANCE || '';
  const token = process.env.GREEN_API_TOKEN || process.env.GREEN_API_API_TOKEN || process.env.GREEN_API_TOKEN_INSTANCE || '';
  const base = String(process.env.GREEN_API_API_URL || 'https://7107.api.greenapi.com').replace(/\/$/, '');

  if (!id || !token) {
    return res.status(500).json({
      ok: false,
      stage: 'env',
      hasInstanceId: Boolean(id),
      hasToken: Boolean(token),
      error: 'Faltan credenciales GREEN-API en Vercel.'
    });
  }

  const call = async (method) => {
    const url = `${base}/waInstance${id}/${method}/${token}`;
    const started = Date.now();
    try {
      const r = await fetch(url, { method: 'GET' });
      const text = await r.text();
      let data;
      try { data = text ? JSON.parse(text) : null; } catch { data = text; }
      return {
        method,
        ok: r.ok,
        status: r.status,
        ms: Date.now() - started,
        data: r.ok ? data : undefined,
        error: r.ok ? undefined : (data?.message || data?.error || String(data || r.statusText))
      };
    } catch (e) {
      return { method, ok: false, status: null, ms: Date.now() - started, error: e?.message || String(e) };
    }
  };

  const [state, settings] = await Promise.all([
    call('getStateInstance'),
    call('getSettings')
  ]);

  const ok = state.ok && settings.ok;
  return res.status(ok ? 200 : 502).json({
    ok,
    instanceConfigured: true,
    state: state.ok ? state.data?.stateInstance || null : null,
    checks: [
      { method: state.method, ok: state.ok, status: state.status, ms: state.ms, error: state.error || null },
      { method: settings.method, ok: settings.ok, status: settings.status, ms: settings.ms, error: settings.error || null }
    ]
  });
}
