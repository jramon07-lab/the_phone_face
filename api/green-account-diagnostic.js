const DIAGNOSTIC_BRANCH = 'codex/verify-whatsapp-delivery-20260910';

function masked(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits ? `***${digits.slice(-4)}` : '';
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (String(process.env.VERCEL_GIT_COMMIT_REF || '') !== DIAGNOSTIC_BRANCH) return res.status(404).json({ ok: false });
  if (req.method !== 'GET') return res.status(405).json({ ok: false });

  const id = process.env.GREEN_API_INSTANCE_ID || process.env.GREEN_API_ID_INSTANCE || process.env.GREEN_API_IDINSTANCE || '';
  const token = process.env.GREEN_API_TOKEN || process.env.GREEN_API_API_TOKEN || process.env.GREEN_API_TOKEN_INSTANCE || '';
  const base = String(process.env.GREEN_API_API_URL || 'https://7107.api.greenapi.com').replace(/\/$/, '');
  if (!id || !token) return res.status(503).json({ ok: false, error: 'GREEN-API no configurada' });

  const read = async (method) => {
    const response = await fetch(`${base}/waInstance${id}/${method}/${token}`);
    const data = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, data };
  };
  const [settings, account] = await Promise.all([read('getSettings'), read('getWaSettings')]);
  return res.status(200).json({
    ok: settings.ok || account.ok,
    instance: masked(settings.data?.wid || account.data?.wid || account.data?.phone || account.data?.phoneNumber),
    stateConfigured: Boolean(settings.data),
    accountConfigured: Boolean(account.data)
  });
}
