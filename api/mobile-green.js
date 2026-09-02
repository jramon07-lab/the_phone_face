import greenHandler from './green.js';
import greenReadSafeHandler from './green-read-safe.js';

const SUPABASE_URL = String(
  process.env.SUPABASE_URL || 'https://overfzbjtpjqxzbujezg.supabase.co'
).replace(/\/$/, '');
const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'sb_publishable_o6_eM5v04EBInhfiSnyFLA_5yRHlB4j';

const MOBILE_ACTION_METHODS = new Map([
  ['state', 'GET'],
  ['summary', 'GET'],
  ['chats', 'GET'],
  ['file', 'POST'],
  ['history', 'POST'],
  ['send', 'POST'],
  ['read', 'POST'],
  ['sendfile', 'POST']
]);
const CHAT_ACTIONS = new Set(['file', 'history', 'send', 'read', 'sendfile']);
const MAX_HISTORY_COUNT = 200;
const MAX_ID_MESSAGE_LENGTH = 256;
const MAX_FILE_NAME_LENGTH = 180;
const MAX_MIME_TYPE_LENGTH = 120;
const MAX_CAPTION_LENGTH = 1024;
const MAX_FILE_BYTES = 2500000;
const MAX_BASE64_LENGTH = Math.ceil(MAX_FILE_BYTES / 3) * 4;
const MIME_TYPE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]{0,63}\/[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]{0,63}$/;

function bearerToken(req) {
  const header = String(req.headers?.authorization || '').trim();
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match || match[1].length > 8192) return '';
  return match[1];
}

async function readPermissions(token) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/current_user_permissions`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: '{}',
      signal: controller.signal
    });

    if (response.status === 401 || response.status === 403) {
      return { authenticated: false, permissions: null };
    }
    if (!response.ok) throw new Error(`Supabase HTTP ${response.status}`);

    const payload = await response.json().catch(() => null);
    const permissions = Array.isArray(payload) ? payload[0] : payload;
    return { authenticated: true, permissions: permissions || null };
  } finally {
    clearTimeout(timeout);
  }
}

function parseBody(req) {
  if (typeof req.body !== 'string') return req.body && typeof req.body === 'object' ? req.body : {};
  try { return JSON.parse(req.body || '{}'); } catch { return null; }
}

function normalizeMobileChatId(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (!raw.includes('@')) {
    let phone = raw.replace(/\D/g, '');
    if (phone.length === 9) phone = `34${phone}`;
    return /^\d{10,15}$/.test(phone) ? `${phone}@c.us` : '';
  }
  const match = /^([^@]+)@(c\.us|g\.us|lid)$/i.exec(raw);
  if (!match) return '';
  const local = match[1], suffix = match[2].toLowerCase();
  if (suffix === 'c.us' && !/^\d{10,15}$/.test(local)) return '';
  if (suffix === 'g.us' && !/^(?=.{5,40}$)\d+(?:-\d+)*$/.test(local)) return '';
  if (suffix === 'lid' && !/^\d{5,30}$/.test(local)) return '';
  return `${local}@${suffix}`;
}

function normalizedBoundedString(value, maxLength, allowLineBreaks = false) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' || value.length > maxLength) return null;
  const normalized = value.trim();
  const controls = allowLineBreaks
    ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/
    : /[\u0000-\u001F\u007F]/;
  if (controls.test(normalized)) return null;
  return normalized;
}

function parseDataUrl(value) {
  const dataUrl = String(value || '');
  if (!dataUrl.startsWith('data:') || dataUrl.length > MAX_BASE64_LENGTH + MAX_MIME_TYPE_LENGTH + 16) return null;
  const comma = dataUrl.indexOf(',');
  if (comma < 6 || comma > MAX_MIME_TYPE_LENGTH + 13) return null;
  const metadata = dataUrl.slice(5, comma);
  if (!metadata.endsWith(';base64')) return null;
  const mediaType = metadata.slice(0, -7);
  if (mediaType && (mediaType.length > MAX_MIME_TYPE_LENGTH || !MIME_TYPE_PATTERN.test(mediaType))) return null;
  const base64 = dataUrl.slice(comma + 1);
  if (!base64 || base64.length > MAX_BASE64_LENGTH || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return null;
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  const bytes = (base64.length / 4) * 3 - padding;
  if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > MAX_FILE_BYTES) return null;
  return { dataUrl, mediaType, bytes };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const action = String(req.query?.action || '').toLowerCase();
  const expectedMethod = MOBILE_ACTION_METHODS.get(action);
  if (!expectedMethod) {
    return res.status(405).json({ ok: false, error: 'Acción no disponible en el CRM móvil.' });
  }

  const requestMethod = String(req.method || '').toUpperCase();
  if (requestMethod !== expectedMethod) {
    res.setHeader('Allow', expectedMethod);
    return res.status(405).json({ ok: false, error: 'Método no permitido.' });
  }

  const token = bearerToken(req);
  if (!token) {
    return res.status(401).json({ ok: false, error: 'Inicia sesión para usar WhatsApp.' });
  }

  try {
    const auth = await readPermissions(token);
    if (!auth.authenticated) {
      return res.status(401).json({ ok: false, error: 'La sesión ha caducado. Vuelve a entrar.' });
    }

    const permissions = auth.permissions;
    if (!permissions || (permissions.is_admin !== true && permissions.can_use_whatsapp !== true)) {
      return res.status(403).json({ ok: false, error: 'No tienes permiso para usar WhatsApp.' });
    }

    if (CHAT_ACTIONS.has(action)) {
      const body = parseBody(req);
      if (!body) return res.status(400).json({ ok: false, error: 'Petición no válida.' });
      const chatId = normalizeMobileChatId(body.chatId);
      if (!chatId) return res.status(400).json({ ok: false, error: 'Chat de WhatsApp no válido.' });
      const nextBody = { ...body, chatId };

      if (action === 'history') {
        const count = body.count === undefined ? 100 : Number(body.count);
        if (!Number.isInteger(count) || count < 1 || count > MAX_HISTORY_COUNT) {
          return res.status(400).json({ ok: false, error: 'Cantidad de mensajes no válida.' });
        }
        nextBody.count = count;
      }

      if (action === 'file' || action === 'read') {
        const idMessage = normalizedBoundedString(body.idMessage, MAX_ID_MESSAGE_LENGTH);
        if (idMessage === null || (action === 'file' && !idMessage)) {
          return res.status(400).json({ ok: false, error: 'Identificador de mensaje no válido.' });
        }
        if (idMessage) nextBody.idMessage = idMessage;
        else delete nextBody.idMessage;
      }

      if (action === 'send' && String(body.message || '').trim().length > 4096) {
        return res.status(400).json({ ok: false, error: 'El mensaje supera los 4.096 caracteres.' });
      }

      if (action === 'sendfile') {
        const fileName = normalizedBoundedString(body.fileName || 'archivo', MAX_FILE_NAME_LENGTH);
        const mimeType = normalizedBoundedString(body.mimeType || 'application/octet-stream', MAX_MIME_TYPE_LENGTH);
        const caption = normalizedBoundedString(body.caption, MAX_CAPTION_LENGTH, true);
        const file = parseDataUrl(body.dataUrl);
        if (!fileName || !mimeType || !MIME_TYPE_PATTERN.test(mimeType) || caption === null || !file) {
          return res.status(400).json({ ok: false, error: 'Archivo de WhatsApp no válido.' });
        }
        nextBody.fileName = fileName;
        nextBody.mimeType = mimeType;
        nextBody.caption = caption || '';
        nextBody.dataUrl = file.dataUrl;
      }

      req.body = nextBody;
    }

    if (action === 'read') return greenReadSafeHandler(req, res);
    return greenHandler(req, res);
  } catch (error) {
    console.error('MOBILE_GREEN_AUTH_ERROR', error?.message || String(error));
    return res.status(503).json({ ok: false, error: 'No se pudo comprobar la sesión. Inténtalo de nuevo.' });
  }
}
