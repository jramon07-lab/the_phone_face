from pathlib import Path

path = Path("api/green.js")
source = path.read_text(encoding="utf-8")

if "GREEN_RETRYABLE_METHODS" in source:
    print("Retry protection already present")
    raise SystemExit(0)

old = '''  async function greenFetchUrl(url, opts = {}) {
    const r = await fetch(url, opts);
    const text = await r.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!r.ok) {
      const msg = typeof data === "object" && data
        ? (data.message || data.error || JSON.stringify(data))
        : String(data || r.statusText);
      const err = new Error(msg || `GREEN-API HTTP ${r.status}`);
      err.status = r.status;
      throw err;
    }
    return data;
  }

  async function greenFetch(method, opts = {}) {
    const r = await fetch(apiUrl(method), opts);
    const text = await r.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!r.ok) {
      const msg = typeof data === "object" && data
        ? (data.message || data.error || JSON.stringify(data))
        : String(data || r.statusText);
      const err = new Error(msg || `GREEN-API HTTP ${r.status}`);
      err.status = r.status;
      err.greenMethod = method;
      throw err;
    }
    return data;
  }
'''

new = '''  const GREEN_RETRYABLE_METHODS = new Set([
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
        if (!(retryable && r.status >= 500 && attempt < 2)) throw err;
      } catch (err) {
        lastError = err;
        if (!(retryable && attempt < 2 && (!err?.status || err.status >= 500))) throw err;
      }
      await greenSleep(250 * (attempt + 1));
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
        if (!(retryable && r.status >= 500 && attempt < 2)) throw err;
      } catch (err) {
        if (!err.greenMethod) err.greenMethod = method;
        lastError = err;
        if (!(retryable && attempt < 2 && (!err?.status || err.status >= 500))) throw err;
      }
      await greenSleep(250 * (attempt + 1));
    }
    throw lastError || new Error(`GREEN-API ${method} no respondió.`);
  }
'''

if old not in source:
    raise SystemExit("Expected greenFetch block not found; refusing unsafe patch")

path.write_text(source.replace(old, new, 1), encoding="utf-8")
print("GREEN-API retry protection applied")
