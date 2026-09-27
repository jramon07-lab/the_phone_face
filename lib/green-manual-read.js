// Only a successfully accepted manual reply may disclose reading to WhatsApp.
module.exports = async function markManualReplyRead({ manualReply, data, chatId, base, id, token }) {
  if (manualReply !== true || !data?.idMessage) return { setRead: false };
  try {
    const r = await fetch(`${base}/waInstance${id}/readChat/${token}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId }), signal: AbortSignal.timeout(5000)
    });
    const result = await r.json().catch(() => ({}));
    return { setRead: r.ok && result.setRead === true };
  } catch (_) {
    // The reply was already sent. Never turn a receipt failure into a send retry.
    return { setRead: false };
  }
};
