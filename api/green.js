let greenStateCache = { at: 0, data: null };
let greenStateBackoffUntil = 0;

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
  const greenSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function greenFetchUrl(url, opts = {}) {
    const retryable = String(opts.method || "GET").toUpperCase() === "GET";
    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const r = await fetch(url, opts);
        const text = await r.text();
        let data;
        try { data = text ? JSON.parse(text) : null; } catch { data = text; }
        if (r.ok) return data;
        const msg = typeof data === "object" && data
          ? (data.message || data.error || JSON.stringify(data))
          : String(data || r.statusText);
        const err = new Error(msg || `GREEN-API HTTP ${r.status}`);
        err.status = r.status;
        lastError = err;
        if (!(retryable && (r.status === 429 || r.status >= 500) && attempt < 2)) throw err;
      } catch (err) {
        lastError = err;
        if (!(retryable && attempt < 2 && (!err?.status || err.status === 429 || err.status >= 500))) throw err;
      }
      await greenSleep(lastError?.status === 429 ? 1000 * (attempt + 1) : 250 * (attempt + 1));
    }
    throw lastError || new Error("GREEN-API no respondió.");
  }

  async function greenFetch(method, opts = {}) {
    const retryable = GREEN_RETRYABLE_METHODS.has(method);
    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const r = await fetch(apiUrl(method), opts);
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
        lastError = err;
        if (!(retryable && (r.status === 429 || r.status >= 500) && attempt < 2)) throw err;
      } catch (err) {
        if (!err.greenMethod) err.greenMethod = method;
        lastError = err;
        if (!(retryable && attempt < 2 && (!err?.status || err.status === 429 || err.status >= 500))) throw err;
      }
      await greenSleep(lastError?.status === 429 ? 1000 * (attempt + 1) : 250 * (attempt + 1));
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
      // Endpoint listo para recibir notificaciones GREEN-API desde servidor.
      // La persistencia principal se realiza desde el cliente vía Supabase RPC.
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

    // Comprueba y activa, solo si hace falta, las notificaciones necesarias
    // para recibir mensajes nuevos por la cola HTTP de GREEN-API.
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

    // Lista híbrida: getChats da contactos/orden base; los diarios aportan
    // el último mensaje; receiveNotification mantiene las novedades en tiempo real.
    if (req.method === "GET" && action === "summary") {
      const minutes = Math.max(60, Math.min(43200, Number(req.query.minutes || 10080)));
      const chatsData = await greenFetch("getChats");
      const chats = Array.isArray(chatsData) ? chatsData.filter(c => c && c.id) : [];

      const [incoming, outgoing] = await Promise.all([
        greenFetchUrl(`${apiUrl("lastIncomingMessages")}?minutes=${minutes}`, {method:"GET"}).catch(()=>[]),
        greenFetchUrl(`${apiUrl("lastOutgoingMessages")}?minutes=${minutes}`, {method:"GET"}).catch(()=>[])
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

      // Para chats visibles sin entrada reciente en los diarios, usa un único
      // mensaje de historial como respaldo (solo en carga/reconciliación).
      for (const chat of chats.slice(0,15)) {
        const chatId=normalizeChatId(chat?.id);
        if (!chatId || latest.has(chatId)) continue;
        try {
          const hist=await greenFetch("getChatHistory",{
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({chatId,count:1})
          });
          if (Array.isArray(hist) && hist[0]) latest.set(chatId,hist[0]);
        } catch (_) {}
      }

      return res.status(200).json({
        ok:true,
        chats:chats.map(c=>({...c,_lastMessage:latest.get(normalizeChatId(c.id))||null}))
      });
    }

    if (req.method === "GET" && action === "chats") {
      const data = await greenFetch("getChats");
      const chats = Array.isArray(data) ? data.filter((c) => c && c.id) : [];
      return res.status(200).json({ ok: true, chats });
    }

    // Foto de perfil del contacto o grupo. GREEN-API devuelve una URL
    // visible cuando la privacidad del interlocutor lo permite.
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
        if (e?.status === 404 || e?.status === 429) {
          return res.status(200).json({
            ok: true,
            chatId,
            urlAvatar: "",
            base64Avatar: "",
            available: false,
            degraded: true,
            providerStatus: e.status
          });
        }
        throw e;
      }
    }

    // Recupera el enlace de un archivo del historial cuando getChatHistory
    // no incluye downloadUrl (fotos/documentos antiguos).
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


    // Descarga real desde el mismo dominio de la app. Se responde como
    // "attachment" para que Safari respete "Consultar al iniciar la descarga".
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

    // Último mensaje real de varios chats. Las llamadas se hacen de forma
    // secuencial para evitar que GREEN-API rechace/rate-limitée una ráfaga.
    if (req.method === "POST" && action === "previews") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const rawIds = Array.isArray(body.chatIds) ? body.chatIds : [];
      const chatIds = [...new Set(rawIds.map(normalizeChatId).filter(Boolean))].slice(0, 10);
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

      return res.status(200).json({ ok: true, previews });
    }

    if (req.method === "POST" && action === "history") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const chatId = normalizeChatId(body.chatId);
      const count = Math.max(1, Math.min(200, Number(body.count || 100)));
      if (!chatId) return res.status(400).json({ ok: false, error: "Falta chatId." });

      const data = await greenFetch("getChatHistory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, count })
      });
      return res.status(200).json({ ok: true, messages: Array.isArray(data) ? data : [] });
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

    // Lee varias notificaciones de la cola en una sola petición.
    // GREEN-API mezcla mensajes, estados de entrega/lectura y otros eventos;
    // si leyéramos solo uno cada pocos segundos, un mensaje nuevo podría
    // quedar detrás de muchos eventos de estado y tardar en aparecer.
    if (req.method === "GET" && (action === "notification" || action === "notifications")) {
      const notifications = [];
      const receipts = [];
      for (let i = 0; i < 25; i += 1) {
        const packet = await greenFetch("receiveNotification");
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
    console.error("GREEN_API_ERROR", {
      action: failedAction,
      requestMethod: req.method,
      greenMethod: e?.greenMethod || null,
      greenStatus: e?.status || null,
      message: e?.message || String(e)
    });
    const providerStatus = Number(e?.status || 0);
    const responseStatus = providerStatus >= 400 && providerStatus < 500 ? providerStatus : 502;
    return res.status(responseStatus).json({
      ok: false,
      error: e?.message || String(e),
      action: failedAction,
      greenMethod: e?.greenMethod || null,
      greenStatus: e?.status || null
    });
  }
}
