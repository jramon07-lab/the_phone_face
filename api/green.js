let greenStateCache = { at: 0, data: null };
let greenStateBackoffUntil = 0;
const greenReadCache = new Map();
const greenReadInFlight = new Map();
const greenReadBackoffUntil = new Map();
const greenMethodQueue = new Map();
const greenMethodNextAt = new Map();

// GREEN-API aplica los límites por método y por instancia. En especial,
// getChatHistory y los diarios solo admiten una petición por segundo.
// Este control se comparte entre todas las peticiones atendidas por una
// misma función caliente de Vercel y evita ráfagas desde varias pestañas.
const GREEN_METHOD_SPACING_MS = new Map([
  ["getSettings", 1100],
  ["getStateInstance", 1100],
  ["getChatHistory", 1100],
  ["lastIncomingMessages", 1100],
  ["lastOutgoingMessages", 1100],
  ["getAvatar", 120],
  ["downloadFile", 220],
  ["readChat", 120]
]);

const greenDelay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForGreenMethodSlot(method) {
  const spacing = Number(GREEN_METHOD_SPACING_MS.get(String(method || "")) || 0);
  if (!spacing) return;

  const previous = greenMethodQueue.get(method) || Promise.resolve();
  const turn = previous.catch(() => {}).then(async () => {
    const wait = Math.max(0, Number(greenMethodNextAt.get(method) || 0) - Date.now());
    if (wait) await greenDelay(wait);
    greenMethodNextAt.set(method, Date.now() + spacing);
  });
  greenMethodQueue.set(method, turn);
  try {
    await turn;
  } finally {
    if (greenMethodQueue.get(method) === turn) greenMethodQueue.delete(method);
  }
}

function retryAfterMs(headers) {
  const value = String(headers?.get?.("retry-after") || "").trim();
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0;
}

function pruneGreenReadCache() {
  if (greenReadCache.size <= 250) return;
  const oldest = [...greenReadCache.entries()]
    .sort((a, b) => Number(a[1]?.at || 0) - Number(b[1]?.at || 0))
    .slice(0, 50);
  for (const [key] of oldest) greenReadCache.delete(key);
}

async function cachedGreenRead(key, policy, loader) {
  const now = Date.now();
  const freshMs = Math.max(0, Number(policy?.freshMs || 0));
  const staleMs = Math.max(freshMs, Number(policy?.staleMs || freshMs));
  const cached = greenReadCache.get(key);
  const age = cached ? now - Number(cached.at || 0) : Infinity;

  if (cached && age < freshMs) {
    return { value: cached.value, cached: true, degraded: false, providerStatus: null };
  }

  const backoffUntil = Number(greenReadBackoffUntil.get(key) || 0);
  if (cached && age < staleMs && now < backoffUntil) {
    return { value: cached.value, cached: true, degraded: true, providerStatus: 429 };
  }
  if (now < backoffUntil) {
    const error = new Error('WhatsApp limita temporalmente las consultas. Espera antes de actualizar.');
    error.status = 429;
    error.retryAfterMs = backoffUntil - now;
    throw error;
  }

  if (greenReadInFlight.has(key)) return greenReadInFlight.get(key);

  const task = (async () => {
    try {
      const value = await loader();
      greenReadCache.set(key, { at: Date.now(), value });
      greenReadBackoffUntil.delete(key);
      pruneGreenReadCache();
      return { value, cached: false, degraded: false, providerStatus: null };
    } catch (error) {
      if (Number(error?.status || 0) === 429) {
        const wait = Math.max(45000, Number(error?.retryAfterMs || 0));
        greenReadBackoffUntil.set(key, Date.now() + wait);
        const stale = greenReadCache.get(key);
        if (stale && Date.now() - Number(stale.at || 0) < staleMs) {
          return { value: stale.value, cached: true, degraded: true, providerStatus: 429 };
        }
      }
      throw error;
    } finally {
      greenReadInFlight.delete(key);
    }
  })();

  greenReadInFlight.set(key, task);
  return task;
}

function sendCachedGreenRead(res, result) {
  return res.status(200).json({
    ...result.value,
    ...(result.cached ? { cached: true } : {}),
    ...(result.degraded ? { degraded: true, providerStatus: result.providerStatus || null } : {})
  });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const id =
    process.env.GREEN_API_INSTANCE_ID ||
    process.env.GREEN_API_ID_INSTANCE ||
    process.env.GREEN_API_IDINSTANCE ||
    "";

  const token =
    process.env.GREEN_API_TOKEN ||
    process.env.GREEN_API_API_TOKEN ||
    process.env.GREEN_API_TOKEN_INSTANCE ||
    "";

  const base = String(process.env.GREEN_API_API_URL || "https://7107.api.greenapi.com").replace(/\/$/, "");
  const mediaBase = String(process.env.GREEN_API_MEDIA_URL || "https://media.green-api.com").replace(/\/$/, "");

  if (!id || !token) {
    const visibleNames = Object.keys(process.env)
      .filter((k) => k.startsWith("GREEN_API"))
      .sort();

    return res.status(500).json({
      ok: false,
      error: "GREEN-API no está disponible en esta función de Vercel.",
      hasInstanceId: Boolean(id),
      hasToken: Boolean(token),
      greenApiEnvNames: visibleNames
    });
  }

  const apiUrl = (method) => `${base}/waInstance${id}/${method}/${token}`;

  function normalizeChatId(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (raw.includes("@")) return raw;
    const digits = raw.replace(/\D/g, "");
    return digits ? `${digits}@c.us` : raw;
  }

  const GREEN_RETRYABLE_METHODS = new Set([
    "getStateInstance", "getSettings", "getChats", "getChatHistory",
    "getAvatar", "downloadFile", "receiveNotification"
  ]);
  const greenSleep = greenDelay;
  async function greenTimedFetch(url, opts = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      return await fetch(url, { ...opts, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  async function greenFetchUrl(url, opts = {}, greenMethod = "") {
    const retryable = String(opts.method || "GET").toUpperCase() === "GET";
    let lastError;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await waitForGreenMethodSlot(greenMethod);
        const r = await greenTimedFetch(url, opts);
        const text = await r.text();
        let data;
        try { data = text ? JSON.parse(text) : null; } catch { data = text; }
        if (r.ok) return data;
        const msg = typeof data === "object" && data
          ? (data.message || data.error || JSON.stringify(data))
          : String(data || r.statusText);
        const err = new Error(msg || `GREEN-API HTTP ${r.status}`);
        err.status = r.status;
        err.retryAfterMs = retryAfterMs(r.headers);
        if (greenMethod) err.greenMethod = greenMethod;
        lastError = err;
        if (!(retryable && r.status >= 500 && attempt < 1)) throw err;
      } catch (err) {
        lastError = err;
        if (!(retryable && attempt < 1 && (!err?.status || err.status >= 500))) throw err;
      }
      await greenSleep(250 * (attempt + 1));
    }
    throw lastError || new Error("GREEN-API no respondió.");
  }

  async function greenFetch(method, opts = {}) {
    const retryable = GREEN_RETRYABLE_METHODS.has(method);
    let lastError;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await waitForGreenMethodSlot(method);
        const r = await greenTimedFetch(apiUrl(method), opts);
        const text = await r.text();
        let data;
        try { data = text ? JSON.parse(text) : null; } catch { data = text; }
        if (r.ok) return data;
        const msg = typeof data === "object" && data
          ? (data.message || data.error || JSON.stringify(data))
          : String(data || r.statusText);
        const err = new Error(msg || `GREEN-API HTTP ${r.status}`);
        err.status = r.status;
        err.greenMethod = method;
        err.retryAfterMs = retryAfterMs(r.headers);
        lastError = err;
        if (!(retryable && r.status >= 500 && attempt < 1)) throw err;
      } catch (err) {
        if (!err.greenMethod) err.greenMethod = method;
        lastError = err;
        if (!(retryable && attempt < 1 && (!err?.status || err.status >= 500))) throw err;
      }
      await greenSleep(250 * (attempt + 1));
    }
    throw lastError || new Error(`GREEN-API ${method} no respondió.`);
  }

  async function deleteNotification(receiptId) {
    if (receiptId === undefined || receiptId === null) return false;
    const r = await fetch(`${apiUrl("deleteNotification")}/${encodeURIComponent(receiptId)}`, {
      method: "DELETE"
    });
    const text = await r.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!r.ok) {
      const err = new Error(
        (data && typeof data === "object" && (data.message || data.error)) ||
        String(data || r.statusText || "No se pudo borrar la notificación")
      );
      err.status = r.status;
      err.greenMethod = "deleteNotification";
      throw err;
    }
    return data?.result !== false;
  }

  try {
    const action = String(req.query.action || "").toLowerCase();

    if (req.method === "POST" && action === "webhook") {
      return res.status(200).json({ ok:true });
    }

    if (req.method === "GET" && action === "state") {
      const now = Date.now();
      if (greenStateCache.data && now - greenStateCache.at < 30000) {
        return res.status(200).json({ ok: true, state: greenStateCache.data?.stateInstance || "", data: greenStateCache.data, cached: true });
      }
      if (greenStateCache.data && now < greenStateBackoffUntil) {
        return res.status(200).json({ ok: true, state: greenStateCache.data?.stateInstance || "", data: greenStateCache.data, cached: true, degraded: true });
      }
      try {
        const data = await greenFetch("getStateInstance");
        greenStateCache = { at: Date.now(), data };
        greenStateBackoffUntil = 0;
        return res.status(200).json({ ok: true, state: data?.stateInstance || "", data });
      } catch (e) {
        if (e?.status === 429 || e?.status === 404) {
          greenStateBackoffUntil = Date.now() + (e.status === 429 ? 60000 : 15000);
          if (greenStateCache.data) {
            return res.status(200).json({ ok: true, state: greenStateCache.data?.stateInstance || "", data: greenStateCache.data, cached: true, degraded: true, providerStatus: e.status });
          }
          return res.status(200).json({ ok: true, state: "unknown", data: null, degraded: true, providerStatus: e.status });
        }
        throw e;
      }
    }

    if (req.method === "GET" && action === "settings") {
      const data = await greenFetch("getSettings");
      return res.status(200).json({ ok: true, settings: data || {} });
    }

    if (req.method === "POST" && action === "ensure") {
      let current;
      try {
        current = await greenFetch("getSettings");
      } catch (e) {
        if (e?.status === 404 || e?.status === 429) {
          return res.status(200).json({
            ok: true,
            changed: false,
            degraded: true,
            providerStatus: e.status,
            message: "GREEN-API no permitió comprobar ajustes temporalmente; se conserva la configuración actual."
          });
        }
        throw e;
      }
      const needIncoming = String(current?.incomingWebhook || "").toLowerCase() !== "yes";
      const needOutgoingPhone = String(current?.outgoingMessageWebhook || "").toLowerCase() !== "yes";
      const needOutgoingApi = String(current?.outgoingAPIMessageWebhook || "").toLowerCase() !== "yes";

      if (needIncoming || needOutgoingPhone || needOutgoingApi) {
        const patch = {
          webhookUrl: "",
          incomingWebhook: "yes",
          outgoingMessageWebhook: "yes",
          outgoingAPIMessageWebhook: "yes"
        };
        const saved = await greenFetch("setSettings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch)
        });
        return res.status(200).json({
          ok: true,
          changed: true,
          message: "Recepción activada. GREEN-API puede tardar unos minutos en aplicar el cambio.",
          data: saved
        });
      }

      return res.status(200).json({ ok: true, changed: false, settings: current || {} });
    }

    if (req.method === "GET" && action === "summary") {
      const minutes = Math.max(60, Math.min(43200, Number(req.query.minutes || 10080)));
      const result = await cachedGreenRead(`summary:${minutes}`, { freshMs: 45000, staleMs: 300000 }, async () => {
        const chatsData = await greenFetch("getChats");
        const chats = Array.isArray(chatsData) ? chatsData.filter(c => c && c.id) : [];

        const [incoming, outgoing] = await Promise.all([
          greenFetchUrl(`${apiUrl("lastIncomingMessages")}?minutes=${minutes}`, {method:"GET"}, "lastIncomingMessages").catch(()=>[]),
          greenFetchUrl(`${apiUrl("lastOutgoingMessages")}?minutes=${minutes}`, {method:"GET"}, "lastOutgoingMessages").catch(()=>[])
        ]);

        const latest = new Map();
        for (const msg of [
          ...(Array.isArray(incoming)?incoming:[]),
          ...(Array.isArray(outgoing)?outgoing:[])
        ]) {
          const chatId = normalizeChatId(msg?.chatId);
          if (!chatId) continue;
          const ts = Number(msg?.timestamp || 0);
          const prev = latest.get(chatId);
          if (!prev || ts >= Number(prev?.timestamp || 0)) latest.set(chatId,msg);
        }

        // getChats ya aporta su último mensaje cuando está disponible. El
        // resumen completa los chats recientes con los diarios, pero nunca
        // dispara una ráfaga adicional de getChatHistory (límite: 1/segundo).
        return {
          ok:true,
          chats:chats.map(c=>({...c,_lastMessage:latest.get(normalizeChatId(c.id))||c.lastMessage||null}))
        };
      });
      return sendCachedGreenRead(res, result);
    }

    if (req.method === "GET" && action === "chats") {
      const result = await cachedGreenRead("chats", { freshMs: 15000, staleMs: 180000 }, async () => {
        const data = await greenFetch("getChats");
        const chats = Array.isArray(data) ? data.filter((c) => c && c.id) : [];
        return { ok: true, chats };
      });
      return sendCachedGreenRead(res, result);
    }

    if (req.method === "POST" && action === "avatar") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const chatId = normalizeChatId(body.chatId);
      if (!chatId) return res.status(400).json({ ok: false, error: "Falta chatId." });
      try {
        const data = await greenFetch("getAvatar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId })
        });
        return res.status(200).json({
          ok: true,
          chatId,
          urlAvatar: data?.urlAvatar || "",
          base64Avatar: data?.base64Avatar || "",
          available: data?.available !== false,
          data
        });
      } catch (e) {
        const providerMessage = String(e?.message || "");
        const providerNotReady = e?.status === 400 && /(instance.*starting|starting.*not authorized|not authorized|not authorised|not ready)/i.test(providerMessage);
        if (e?.status === 404 || e?.status === 429 || providerNotReady) {
          return res.status(200).json({
            ok: true,
            chatId,
            urlAvatar: "",
            base64Avatar: "",
            available: false,
            degraded: true,
            reason: providerNotReady ? "provider_not_ready" : "provider_unavailable",
            providerStatus: e.status
          });
        }
        throw e;
      }
    }

    if (req.method === "POST" && action === "file") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const chatId = normalizeChatId(body.chatId);
      const idMessage = String(body.idMessage || "").trim();
      if (!chatId || !idMessage) {
        return res.status(400).json({ ok: false, error: "Faltan chatId o idMessage." });
      }
      const data = await greenFetch("downloadFile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, idMessage })
      });
      const downloadUrl = String(data?.downloadUrl || "").trim();
      return res.status(200).json({
        ok: true,
        downloadUrl,
        available: Boolean(downloadUrl)
      });
    }

    if (req.method === "GET" && action === "download") {
      const chatId = normalizeChatId(req.query.chatId);
      const idMessage = String(req.query.idMessage || "").trim();
      const requestedName = String(req.query.name || "archivo").trim() || "archivo";
      if (!chatId || !idMessage) {
        return res.status(400).send("Faltan chatId o idMessage.");
      }

      const data = await greenFetch("downloadFile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, idMessage })
      });
      const downloadUrl = String(data?.downloadUrl || "").trim();
      if (!downloadUrl) return res.status(404).send("Archivo no disponible.");

      const remote = await fetch(downloadUrl);
      if (!remote.ok) return res.status(remote.status).send("No se pudo descargar el archivo.");

      const bytes = Buffer.from(await remote.arrayBuffer());
      const contentType = remote.headers.get("content-type") || "application/octet-stream";
      const safeName = requestedName.replace(/[\r\n"\/\\]/g, "_").slice(0, 180) || "archivo";
      const asciiName = safeName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "_");
      const utf8Name = encodeURIComponent(safeName).replace(/['()]/g, escape);

      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`);
      res.setHeader("Content-Length", String(bytes.length));
      return res.status(200).send(bytes);
    }

    if (req.method === "POST" && action === "previews") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const rawIds = Array.isArray(body.chatIds) ? body.chatIds : [];
      const chatIds = [...new Set(rawIds.map(normalizeChatId).filter(Boolean))].slice(0, 4);
      const key = `previews:${chatIds.join(",")}`;
      const result = await cachedGreenRead(key, { freshMs: 15000, staleMs: 180000 }, async () => {
        const previews = [];
        for (const chatId of chatIds) {
          try {
            const data = await greenFetch("getChatHistory", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chatId, count: 1 })
            });
            previews.push({
              chatId,
              message: Array.isArray(data) && data.length ? data[0] : null
            });
          } catch (e) {
            previews.push({ chatId, message: null });
          }
        }
        return { ok: true, previews };
      });
      return sendCachedGreenRead(res, result);
    }

    if (req.method === "POST" && action === "history") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const chatId = normalizeChatId(body.chatId);
      const count = Math.max(1, Math.min(200, Number(body.count || 100)));
      if (!chatId) return res.status(400).json({ ok: false, error: "Falta chatId." });

      const result = await cachedGreenRead(`history:${chatId}:${count}`, { freshMs: 2500, staleMs: 180000 }, async () => {
        const data = await greenFetch("getChatHistory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId, count })
        });
        return { ok: true, messages: Array.isArray(data) ? data : [] };
      });
      return sendCachedGreenRead(res, result);
    }

    if (req.method === "POST" && action === "send") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const chatId = normalizeChatId(body.chatId);
      const message = String(body.message || "").trim();
      if (!chatId || !message) {
        return res.status(400).json({ ok: false, error: "Faltan chatId o message." });
      }

      const data = await greenFetch("sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ chatId, message })
      });

      return res.status(200).json({
        ok: true,
        chatId,
        idMessage: data?.idMessage || null,
        data
      });
    }

    if (req.method === "POST" && action === "read") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const chatId = normalizeChatId(body.chatId);
      if (!chatId) return res.status(400).json({ ok: false, error: "Falta chatId." });
      const data = await greenFetch("readChat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId })
      });
      return res.status(200).json({ ok: true, data });
    }

    if (req.method === "POST" && action === "sendfile") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const chatId = normalizeChatId(body.chatId);
      const fileName = String(body.fileName || "archivo").trim();
      const mimeType = String(body.mimeType || "application/octet-stream");
      const caption = String(body.caption || "").trim();
      const dataUrl = String(body.dataUrl || "");
      if (!chatId || !dataUrl.includes(",")) return res.status(400).json({ ok: false, error: "Faltan chatId o archivo." });
      const raw = dataUrl.slice(dataUrl.indexOf(",") + 1);
      const bytes = Buffer.from(raw, "base64");
      if (bytes.length > 2600000) return res.status(413).json({ ok: false, error: "El archivo supera el límite de 2,5 MB de esta pantalla." });
      const form = new FormData();
      form.append("chatId", chatId);
      form.append("file", new Blob([bytes], { type: mimeType }), fileName);
      form.append("fileName", fileName);
      if (caption) form.append("caption", caption);
      const r = await fetch(`${mediaBase}/waInstance${id}/sendFileByUpload/${token}`, { method: "POST", body: form });
      const text = await r.text();
      let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
      if (!r.ok) return res.status(r.status).json({ ok: false, error: data?.message || data?.error || String(data || "No se pudo enviar el archivo") });
      return res.status(200).json({ ok: true, idMessage: data?.idMessage || null, urlFile: data?.urlFile || "", data });
    }

    if (req.method === "GET" && (action === "notification" || action === "notifications")) {
      const notifications = [];
      const receipts = [];
      for (let i = 0; i < 8; i += 1) {
        let packet;
        try {
          packet = await greenFetch("receiveNotification");
        } catch (e) {
          if (Number(e?.status || 0) === 408) break;
          throw e;
        }
        if (!packet || packet.receiptId === undefined || packet.receiptId === null) break;
        notifications.push(packet.body || null);
        receipts.push(packet.receiptId);
        await deleteNotification(packet.receiptId);
      }

      return res.status(200).json({
        ok: true,
        notifications,
        notification: notifications[0] || null,
        receiptIds: receipts
      });
    }

    return res.status(405).json({ ok: false, error: "Acción o método no permitido." });
  } catch (e) {
    const failedAction = String(req.query.action || "").toLowerCase();
    const providerStatus = Number(e?.status || 0);
    if ((failedAction === "notification" || failedAction === "notifications") && providerStatus === 408) {
      return res.status(200).json({
        ok: true,
        notifications: [],
        notification: null,
        receiptIds: [],
        timedOut: true
      });
    }
    console.error("GREEN_API_ERROR", {
      action: failedAction,
      requestMethod: req.method,
      greenMethod: e?.greenMethod || null,
      greenStatus: e?.status || null,
      message: e?.message || String(e)
    });
    const responseStatus = providerStatus >= 400 && providerStatus < 500 ? providerStatus : 502;
    if (responseStatus === 429) res.setHeader('Retry-After', String(Math.max(1, Math.ceil(Number(e?.retryAfterMs || 45000) / 1000))));
    return res.status(responseStatus).json({
      ok: false,
      error: e?.message || String(e),
      action: failedAction,
      greenMethod: e?.greenMethod || null,
      greenStatus: e?.status || null
    });
  }
}
