export default async function handler(req, res) {
  if(!await require('../lib/crm-api-auth').authorize(req,res,'can_manage_agenda'))return;
  res.setHeader("Cache-Control", "no-store");
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return res.status(500).json({ ok: false, error: "Falta TELEGRAM_BOT_TOKEN en Vercel." });
  }

  const tg = (method) => `https://api.telegram.org/bot${token}/${method}`;

  const telegram = async (method, body = {}) => {
    const response = await fetch(tg(method), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.description || `Telegram no pudo ejecutar ${method}.`);
    }
    return data.result;
  };

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
        chat_title: last.chat.title || "",
        is_forum: last.chat.is_forum === true,
        first_name: last.chat.first_name || "",
        username: last.chat.username || ""
      });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      if (!["test", "send", "setup-forum"].includes(body.action)) {
        return res.status(400).json({ ok: false, error: "Acción no válida." });
      }

      const chatId = String(body.chat_id || "").trim();
      if (body.action === "setup-forum") {
        if (!chatId) {
          return res.status(400).json({ ok: false, error: "Falta el Chat ID del grupo." });
        }
        const chat = await telegram("getChat", { chat_id: chatId });
        if (chat?.type !== "supergroup" || chat?.is_forum !== true) {
          return res.status(400).json({
            ok: false,
            error: "Tiene que ser un grupo privado de Telegram con Temas activados. Añade el bot como administrador y vuelve a detectarlo."
          });
        }

        const existing = body.topics && typeof body.topics === "object" ? body.topics : {};
        const topics = { agenda: null, ...existing };
        await telegram("editGeneralForumTopic", {
          chat_id: chatId,
          name: "📅 Agenda y tareas"
        });
        const wanted = [
          ["whatsapp", "💬 WhatsApp programados", 0x6FB9F0],
          ["offers", "💰 Ofertas y ventas", 0xFFD67E],
          ["followups", "🔄 Seguimientos", 0x6FB9F0],
          ["incidents", "🚨 Errores e incidencias", 0xFB6F5F],
          ["daily", "📊 Resumen diario", 0x8EEE98]
        ];
        const errors = [];
        for (const [key, name, iconColor] of wanted) {
          if (Number(topics[key]) > 0) continue;
          try {
            const topic = await telegram("createForumTopic", {
              chat_id: chatId,
              name,
              icon_color: iconColor
            });
            topics[key] = topic?.message_thread_id || null;
          } catch (error) {
            errors.push({ key, error: error?.message || String(error) });
          }
        }
        return res.status(200).json({
          ok: true,
          chat_id: chatId,
          chat_title: chat.title || "THE PHONE FACE CRM",
          topics,
          complete: errors.length === 0,
          errors
        });
      }

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
          message_thread_id: Number(body.message_thread_id) > 0 ? Number(body.message_thread_id) : undefined,
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
