export type GreenDeliveryState = "confirmed" | "failed" | "pending" | "missing";

export type GreenDeliveryResult = {
  state: GreenDeliveryState;
  status: string;
  description: string;
};

export function extractGreenMessageId(data: any): string {
  return String(data?.idMessage || data?.data?.idMessage || "").trim();
}

export function classifyGreenDelivery(messages: any[], idMessage: string): GreenDeliveryResult {
  const wanted = String(idMessage || "").trim();
  const message = (Array.isArray(messages) ? messages : []).find((item) =>
    String(item?.idMessage || item?.id || "").trim() === wanted
  );
  if (!message) return { state: "missing", status: "", description: "" };

  const status = String(message?.statusMessage || message?.status || "").trim().toLowerCase();
  const description = String(message?.description || message?.error || "").trim();
  if (["sent", "delivered", "read"].includes(status)) {
    return { state: "confirmed", status, description };
  }
  if (status === "failed") return { state: "failed", status, description };
  return { state: "pending", status: status || "pending", description };
}
