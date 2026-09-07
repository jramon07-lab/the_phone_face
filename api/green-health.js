let healthCache = { at: 0, payload: null };
let healthInFlight = null;
let healthBackoffUntil = 0;

const FRESH_MS = 60000;
const STALE_MS = 600000;

function retryAfterMs(headers) {
  const raw = String(headers?.get?.('retry-after') || '').trim();
  if (!raw) return 0;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
  const date = Date.parse(raw);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0;
}

function degradedPayload(providerStatus = null, error = '') {
  const stale = healthCache.payload;
  return {
    ok: true,
    providerHealthy: false,
    degraded: true,
    instanceConfigured: true,
    state: stale?.state || 'unknown',
    cached: Boolean(stale),
    providerStatus,
    checks: [{ method: 'getStateInstance', ok: false, status: providerStatus, ms: 0, attempts: 1, error: error || 'Comprobación temporalmente limitada.' }]
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const id = process.env.GREEN_API_INSTANCE_ID || process.env.GREEN_API_ID_INSTANCE || process.env.GREEN_API_IDINSTANCE || '';
  const token = process.env.GREEN_API_TOKEN || process.env.GREEN_API_API_TOKEN || process.env.GREEN_API_TOKEN_INSTANCE || '';
  const base = String(process.env.GREEN_API_API_URL || 'https://7107.api.greenapi.com').replace(/\/$/, '');

  if (!id || !token) {
    return res.status(500).json({ ok: false, stage: 'env', hasInstanceId: Boolean(id), hasToken: Boolean(token), error: 'Faltan credenciales GREEN-API en Vercel.' });
  }

  const now = Date.now();
  const age = healthCache.payload ? now - healthCache.at : Infinity;
  if (age < FRESH_MS) return res.status(200).json({ ...healthCache.payload, cached: true });
  if (now < healthBackoffUntil) return res.status(200).json(degradedPayload(429));

  if (!healthInFlight) {
    healthInFlight = (async () => {
      const started = Date.now();
      try {
        const response = await fetch(`${base}/waInstance${id}/getStateInstance/${token}`, { method: 'GET' });
        const text = await response.text();
        let data;
        try { data = text ? JSON.parse(text) : null; } catch { data = null; }
        if (!response.ok) {
          const error = new Error(data?.message || data?.error || response.statusText || `HTTP ${response.status}`);
          error.status = response.status;
          error.retryAfterMs = retryAfterMs(response.headers);
          throw error;
        }
        const state = String(data?.stateInstance || 'unknown');
        const payload = {
          ok: true,
          providerHealthy: true,
          degraded: false,
          instanceConfigured: true,
          state,
          checks: [{ method: 'getStateInstance', ok: true, status: response.status, ms: Date.now() - started, attempts: 1, error: null }]
        };
        healthCache = { at: Date.now(), payload };
        healthBackoffUntil = 0;
        return payload;
      } catch (error) {
        const status = Number(error?.status || 0) || null;
        const transient = status === null || status === 404 || status === 429 || status >= 500;
        if (transient) {
          if (status === 429) healthBackoffUntil = Date.now() + Math.max(60000, Number(error?.retryAfterMs || 0));
          if (healthCache.payload && Date.now() - healthCache.at < STALE_MS) return degradedPayload(status, error?.message);
          return degradedPayload(status, error?.message);
        }
        const hard = new Error(error?.message || String(error));
        hard.status = status;
        throw hard;
      } finally {
        healthInFlight = null;
      }
    })();
  }

  try {
    return res.status(200).json(await healthInFlight);
  } catch (error) {
    return res.status(502).json({ ok: false, providerHealthy: false, degraded: false, instanceConfigured: true, state: 'unknown', error: error?.message || String(error) });
  }
}
