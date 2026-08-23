export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return res.status(500).json({ ok: false, error: "Falta TELEGRAM_BOT_TOKEN en Vercel." });
  }

  const tg = (method) => `https://api.telegram.org/bot${token}/${method}`;

  try {
    if (req.method === "GET" && req.query.action === "chat-id") {
      const r = await fetch(tg("getUpdates"));
      const j = await r.json();

      if (!j.ok) {
        return res.status(502).json({ ok: false, error: j.description || "Telegram no respondió correctamente." });
      }

      const updates = Array.isArray(j.result) ? j.result : [];
      const candidates = updates
        .map(u => u.message || u.edited_message || u.channel_post)
        .filter(Boolean)
        .filter(m => m.chat && m.chat.id);

      if (!candidates.length) {
        return res.status(404).json({
          ok: false,
          error: "No encuentro mensajes del bot. Abre el bot en Telegram, pulsa Iniciar y envía Hola."
        });
      }

      const last = candidates[candidates.length - 1];
      return res.status(200).json({
        ok: true,
        chat_id: last.chat.id,
        chat_type: last.chat.type,
        first_name: last.chat.first_name || "",
        username: last.chat.username || ""
      });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      if (body.action !== "test" && body.action !== "send") {
        return res.status(400).json({ ok: false, error: "Acción no válida." });
      }

      const chatId = String(body.chat_id || "").trim();
      const text = String(body.text || "").trim();
      if (!chatId || !text) {
        return res.status(400).json({ ok: false, error: "Faltan chat_id o text." });
      }

      const r = await fetch(tg("sendMessage"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_web_page_preview: true
        })
      });
      const j = await r.json();

      if (!j.ok) {
        return res.status(502).json({ ok: false, error: j.description || "No se pudo enviar el mensaje." });
      }

      return res.status(200).json({ ok: true, message_id: j.result?.message_id || null });
    }

    return res.status(405).json({ ok: false, error: "Método no permitido." });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
