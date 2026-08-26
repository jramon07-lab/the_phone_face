const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    let last = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const r = await fetch(url, { method: 'GET' });
        const text = await r.text();
        let data;
        try { data = text ? JSON.parse(text) : null; } catch { data = text; }

        if (r.ok) {
          return {
            method,
            ok: true,
            status: r.status,
            ms: Date.now() - started,
            attempts: attempt + 1,
            data,
            error: null
          };
        }

        last = {
          method,
          ok: false,
          status: r.status,
          ms: Date.now() - started,
          attempts: attempt + 1,
          error: data?.message || data?.error || String(data || r.statusText)
        };

        const transient = r.status === 404 || r.status === 429 || r.status >= 500;
        if (!transient || attempt === 2) return last;
        await sleep(r.status === 429 ? 1000 * (attempt + 1) : 500 * (attempt + 1));
      } catch (e) {
        last = {
          method,
          ok: false,
          status: null,
          ms: Date.now() - started,
          attempts: attempt + 1,
          error: e?.message || String(e)
        };
        if (attempt === 2) return last;
        await sleep(500 * (attempt + 1));
      }
    }

    return last || { method, ok: false, status: null, ms: Date.now() - started, attempts: 3, error: 'GREEN-API no respondió.' };
  };

  const state = await call('getStateInstance');
  await sleep(250);
  const settings = await call('getSettings');

  const checks = [state, settings];
  const isTransientFailure = (check) => !check.ok && (check.status === null || check.status === 404 || check.status === 429 || check.status >= 500);
  const hardFailure = checks.some((check) => !check.ok && !isTransientFailure(check));
  const providerHealthy = checks.every((check) => check.ok);
  const authorized = state.ok && String(state.data?.stateInstance || '').toLowerCase() === 'authorized';

  if (hardFailure) {
    return res.status(502).json({
      ok: false,
      providerHealthy: false,
      degraded: false,
      instanceConfigured: true,
      state: state.ok ? state.data?.stateInstance || null : null,
      checks: checks.map((check) => ({
        method: check.method,
        ok: check.ok,
        status: check.status,
        ms: check.ms,
        attempts: check.attempts,
        error: check.error || null
      }))
    });
  }

  return res.status(200).json({
    ok: true,
    providerHealthy,
    degraded: !providerHealthy,
    instanceConfigured: true,
    state: authorized ? 'authorized' : (state.ok ? state.data?.stateInstance || null : 'unknown'),
    checks: checks.map((check) => ({
      method: check.method,
      ok: check.ok,
      status: check.status,
      ms: check.ms,
      attempts: check.attempts,
      error: check.error || null
    }))
  });
}
