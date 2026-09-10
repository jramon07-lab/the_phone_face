const DIAGNOSTIC_BRANCH = 'codex/verify-whatsapp-delivery-20260910';
const TEST_CHAT = '34695661409@c.us';
const WINDOW_START = Date.parse('2026-09-10T06:00:00Z') / 1000;
const WINDOW_END = Date.parse('2026-09-10T06:15:00Z') / 1000;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (String(process.env.VERCEL_GIT_COMMIT_REF || '') !== DIAGNOSTIC_BRANCH) {
    return res.status(404).json({ ok: false });
  }
  if (req.method !== 'GET') return res.status(405).json({ ok: false });

  const id = process.env.GREEN_API_INSTANCE_ID || process.env.GREEN_API_ID_INSTANCE || process.env.GREEN_API_IDINSTANCE || '';
  const token = process.env.GREEN_API_TOKEN || process.env.GREEN_API_API_TOKEN || process.env.GREEN_API_TOKEN_INSTANCE || '';
  const base = String(process.env.GREEN_API_API_URL || 'https://7107.api.greenapi.com').replace(/\/$/, '');
  if (!id || !token) return res.status(503).json({ ok: false, error: 'GREEN-API no configurada' });

  const response = await fetch(`${base}/waInstance${id}/getChatHistory/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: TEST_CHAT, count: 200 })
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !Array.isArray(data)) {
    return res.status(response.status || 502).json({ ok: false, error: data?.message || 'Historial no disponible' });
  }

  const messages = data
    .filter((message) => Number(message?.timestamp || 0) >= WINDOW_START && Number(message?.timestamp || 0) <= WINDOW_END)
    .map((message) => ({
      idMessage: String(message?.idMessage || ''),
      timestamp: Number(message?.timestamp || 0),
      type: String(message?.type || ''),
      typeMessage: String(message?.typeMessage || ''),
      statusMessage: String(message?.statusMessage || ''),
      description: String(message?.description || ''),
      text: String(message?.textMessage || message?.extendedTextMessage?.text || '')
    }));
  return res.status(200).json({ ok: true, chatId: TEST_CHAT, messages });
}
