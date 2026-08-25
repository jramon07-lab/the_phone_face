import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function extractText(messageData: any): string {
  if (!messageData || typeof messageData !== "object") return "";
  const direct = messageData?.textMessageData?.textMessage;
  if (typeof direct === "string") return direct;
  const extended = messageData?.extendedTextMessageData?.text;
  if (typeof extended === "string") return extended;
  const caption = messageData?.fileMessageData?.caption;
  if (typeof caption === "string") return caption;
  return "";
}

function normalizeAuthHeader(value: string): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const m = raw.match(/^(?:Bearer|Basic)\s+(.+)$/i);
  return (m ? m[1] : raw).trim();
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "POST required" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const workerSecret = Deno.env.get("TPF_WHATSAPP_WORKER_SECRET") || "";
  const greenId = Deno.env.get("GREEN_API_INSTANCE_ID") || "";
  const greenToken = Deno.env.get("GREEN_API_TOKEN") || "";
  const greenBase = (Deno.env.get("GREEN_API_API_URL") || "https://7107.api.greenapi.com").replace(/\/$/, "");

  if (!supabaseUrl || !serviceRole || !workerSecret) {
    return json({ ok: false, error: "Server configuration incomplete" }, 500);
  }

  const url = new URL(req.url);
  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }

  if (body?.action === "configure") {
    const supplied = req.headers.get("x-tpf-worker-secret") || "";
    if (!supplied || supplied !== workerSecret) return json({ ok: false, error: "Unauthorized" }, 401);
    if (!greenId || !greenToken) return json({ ok: false, error: "GREEN credentials unavailable" }, 500);

    const webhookUrl = `${supabaseUrl}/functions/v1/green-webhook`;
    const endpoint = `${greenBase}/waInstance${greenId}/setSettings/${greenToken}`;
    const payload = {
      webhookUrl,
      webhookUrlToken: workerSecret,
      incomingWebhook: "yes",
      outgoingMessageWebhook: "yes",
      outgoingAPIMessageWebhook: "yes"
    };
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const text = await r.text();
    if (!r.ok) return json({ ok: false, error: `GREEN HTTP ${r.status}`, detail: text.slice(0, 500) }, 502);
    return json({ ok: true, configured: true });
  }

  const rawAuth = req.headers.get("authorization") || req.headers.get("webhook-authorization") || req.headers.get("x-tpf-worker-secret") || "";
  const authSecret = normalizeAuthHeader(rawAuth);
  const urlSecret = url.searchParams.get("secret") || "";
  if (authSecret !== workerSecret && urlSecret !== workerSecret) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  if (body?.typeWebhook !== "incomingMessageReceived") {
    return json({ ok: true, ignored: true, typeWebhook: body?.typeWebhook || null });
  }

  if (greenId && String(body?.instanceData?.idInstance || "") !== String(greenId)) {
    return json({ ok: false, error: "Instance mismatch" }, 403);
  }

  const chatId = String(body?.senderData?.chatId || "").trim();
  const idMessage = String(body?.idMessage || "").trim();
  if (!chatId || !idMessage) return json({ ok: false, error: "Missing chatId or idMessage" }, 400);

  const sb = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: existing, error: existingError } = await sb
    .from("wa_messages")
    .select("id")
    .eq("id_message", idMessage)
    .limit(1);
  if (existingError) return json({ ok: false, error: existingError.message }, 500);
  if (existing && existing.length) return json({ ok: true, duplicate: true });

  const row = {
    chat_id: chatId,
    id_message: idMessage,
    direction: "in",
    ts: Number(body?.timestamp || Math.floor(Date.now() / 1000)),
    text_content: extractText(body?.messageData),
    type_message: String(body?.messageData?.typeMessage || ""),
    raw: body
  };

  const { error } = await sb.from("wa_messages").insert(row);
  if (error) return json({ ok: false, error: error.message }, 500);

  return json({ ok: true, persisted: true });
});
