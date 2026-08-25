import { createClient } from "jsr:@supabase/supabase-js@2";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function normalizeChatId(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (raw.includes("@")) return raw;
  const digits = raw.replace(/\D/g, "");
  return digits ? `${digits}@c.us` : "";
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  const workerSecret = Deno.env.get("TPF_WHATSAPP_WORKER_SECRET") || "";
  const suppliedSecret = req.headers.get("x-tpf-worker-secret") || "";
  if (!workerSecret || suppliedSecret !== workerSecret) {
    return json(401, { ok: false, error: "Unauthorized worker call" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const instanceId =
    Deno.env.get("GREEN_API_INSTANCE_ID") ||
    Deno.env.get("GREEN_API_ID_INSTANCE") ||
    Deno.env.get("GREEN_API_IDINSTANCE") ||
    "";
  const greenToken =
    Deno.env.get("GREEN_API_TOKEN") ||
    Deno.env.get("GREEN_API_API_TOKEN") ||
    Deno.env.get("GREEN_API_TOKEN_INSTANCE") ||
    "";
  const greenBase = (Deno.env.get("GREEN_API_API_URL") || "https://7107.api.greenapi.com").replace(/\/$/, "");

  if (!supabaseUrl || !serviceRole || !instanceId || !greenToken) {
    return json(500, { ok: false, error: "Worker secrets are not fully configured" });
  }

  const sb = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: due, error: claimError } = await sb.rpc("crm_claim_due_whatsapp_schedules", { p_limit: 10 });
  if (claimError) return json(500, { ok: false, error: claimError.message });

  const rows = Array.isArray(due) ? due : [];
  let sent = 0;
  let failed = 0;
  const results: Array<Record<string, unknown>> = [];

  for (const row of rows) {
    const id = String(row?.id || "");
    const chatId = normalizeChatId(row?.whatsapp_phone || row?.customer_phone || "");
    const message = String(row?.whatsapp_message || "").trim();

    if (!id || !chatId || !message) {
      failed += 1;
      const errorText = "Missing id, phone or message";
      await sb.rpc("crm_finish_whatsapp_schedule", {
        p_id: id || null,
        p_ok: false,
        p_message_id: null,
        p_error: errorText
      });
      results.push({ id, ok: false, error: errorText });
      continue;
    }

    try {
      const url = `${greenBase}/waInstance${instanceId}/sendMessage/${greenToken}`;
      const r = await fetch(url, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ chatId, message })
      });
      const text = await r.text();
      let payload: any = null;
      try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }

      if (!r.ok) {
        const msg = typeof payload === "object" && payload
          ? (payload.message || payload.error || JSON.stringify(payload))
          : String(payload || r.statusText || `HTTP ${r.status}`);
        throw new Error(msg);
      }

      const messageId = payload?.idMessage ? String(payload.idMessage) : null;
      const { error: finishError } = await sb.rpc("crm_finish_whatsapp_schedule", {
        p_id: id,
        p_ok: true,
        p_message_id: messageId,
        p_error: null
      });
      if (finishError) throw finishError;

      sent += 1;
      results.push({ id, ok: true, idMessage: messageId });
    } catch (e) {
      failed += 1;
      const errorText = String((e as Error)?.message || e).slice(0, 1000);
      await sb.rpc("crm_finish_whatsapp_schedule", {
        p_id: id,
        p_ok: false,
        p_message_id: null,
        p_error: errorText
      });
      results.push({ id, ok: false, error: errorText });
    }
  }

  return json(200, { ok: true, claimed: rows.length, sent, failed, results });
});
