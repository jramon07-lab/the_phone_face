const crypto = require("crypto");

const SB = String(process.env.SUPABASE_URL || "https://overfzbjtpjqxzbujezg.supabase.co").replace(/\/$/, "");
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const CLIENT_ID = process.env.GOOGLE_CONTACTS_CLIENT_ID || process.env.GOOGLE_DRIVE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_CONTACTS_CLIENT_SECRET || process.env.GOOGLE_DRIVE_CLIENT_SECRET || "";
const ENCRYPTION_KEY = process.env.CRM_BACKUP_ENCRYPTION_KEY || "";
const PROVIDER = "google_contacts_shared";
const JOB = "TPF_DIRECT_GOOGLE_SYNC_20260914";
const KEY_HASH = "0b64812c00a12aed6c0cdde0cc0d16cfbed4cf1c8cf5f582e6d24efd595449db";
const EXPIRES_AT = Date.UTC(2026, 8, 14, 18, 0, 0);

const safe = (value) => String(value ?? "").trim();
const fold = (value) =>
  safe(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-ES")
    .replace(/\s+/g, " ");
function phone(value) {
  let digits = safe(value).replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("34") && digits.length === 11) digits = digits.slice(2);
  return digits.slice(-9);
}
function serviceHeaders() {
  return {
    apikey: SERVICE,
    Authorization: "Bearer " + SERVICE,
    "Content-Type": "application/json",
  };
}
function fail(status, message) {
  return Object.assign(new Error(message), { status });
}
async function request(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(20000) });
}
function unseal(value) {
  const raw = Buffer.from(value, "base64url");
  const key = crypto.createHash("sha256").update(ENCRYPTION_KEY).digest();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString(),
  );
}
function authorized(req) {
  const supplied = safe(req.headers["x-tpf-pending-key"]);
  const got = crypto.createHash("sha256").update(supplied).digest();
  const wanted = Buffer.from(KEY_HASH, "hex");
  return got.length === wanted.length && crypto.timingSafeEqual(got, wanted);
}
async function storedCredential() {
  const response = await request(
    SB + "/rest/v1/crm_external_credentials?provider=eq." + PROVIDER + "&select=encrypted_value",
    { headers: serviceHeaders() },
  );
  if (!response.ok) throw fail(503, "No se pudo consultar la conexión de Google.");
  const encrypted = (await response.json())[0]?.encrypted_value;
  if (!encrypted) throw fail(409, "Google Contacts no está conectado.");
  return unseal(encrypted);
}
async function googleToken() {
  const stored = await storedCredential();
  if (!stored?.refresh_token) throw fail(409, "Google Contacts no está conectado.");
  const response = await request("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: stored.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token)
    throw fail(409, "Google ha caducado o retirado el permiso.");
  return { token: data.access_token, account: fold(stored.email) };
}
async function googleApi(token, path, options = {}) {
  const response = await request("https://people.googleapis.com/v1/" + path, {
    ...options,
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_) {}
  if (!response.ok)
    throw fail(
      response.status === 401 ? 409 : 502,
      data?.error?.message || "Google Contacts no pudo completar la operación.",
    );
  return data;
}
function googlePhones(person) {
  return (person?.phoneNumbers || []).map((item) =>
    phone(item?.canonicalForm || item?.value),
  );
}
function googleView(person) {
  const name =
    (person?.names || []).find((item) => item?.metadata?.primary) ||
    person?.names?.[0] ||
    {};
  return {
    first: safe(name.givenName),
    last: safe(name.familyName),
    nickname: safe(person?.nicknames?.[0]?.value),
  };
}
function googleAligned(person, fields) {
  const current = googleView(person);
  return (
    fold(current.first) === fold(fields.first) &&
    fold(current.last) === fold(fields.last) &&
    fold(current.nickname) === fold(fields.nickname)
  );
}
function replaceDni(items, dni) {
  const keys = ["dni", "nif", "dni / nif", "dni/nif", "documento", "documento de identidad"];
  const kept = (items || []).filter((item) => !keys.includes(fold(item?.key)));
  if (safe(dni)) kept.push({ key: "DNI / NIF", value: safe(dni) });
  return kept;
}
function personBody(fields, full = null) {
  const body = {
    names: [{ givenName: safe(fields.first), familyName: safe(fields.last) }],
    nicknames: safe(fields.nickname)
      ? [{ value: safe(fields.nickname), type: "DEFAULT" }]
      : [],
    phoneNumbers: phone(fields.phone)
      ? [{ value: phone(fields.phone), type: "mobile" }]
      : [],
    emailAddresses: safe(fields.email)
      ? [{ value: safe(fields.email), type: "work" }]
      : [],
    userDefined: replaceDni(full?.userDefined || [], fields.dni),
  };
  if (full?.resourceName) {
    body.resourceName = full.resourceName;
    body.etag = full.etag;
  }
  return body;
}
async function detailedPerson(token, person) {
  if (!person?.resourceName) return null;
  const qs = new URLSearchParams({
    personFields: "names,nicknames,emailAddresses,phoneNumbers,userDefined,metadata",
  });
  return googleApi(token, person.resourceName + "?" + qs.toString());
}
async function listContacts(token) {
  const all = [];
  let pageToken = "";
  do {
    const qs = new URLSearchParams({
      personFields: "names,nicknames,emailAddresses,phoneNumbers,userDefined,metadata",
      pageSize: "1000",
    });
    qs.append("sources", "READ_SOURCE_TYPE_CONTACT");
    if (pageToken) qs.set("pageToken", pageToken);
    const data = await googleApi(token, "people/me/connections?" + qs.toString());
    all.push(...(data.connections || []));
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return all;
}
function findGoogle(rows, fields, all) {
  const bound = safe(rows?.TPF_GOOGLE_CONTACT?.resource_name || rows?.TPF_GOOGLE_CONTACT?.resourceName);
  if (bound) {
    const direct = all.find((person) => safe(person.resourceName) === bound);
    if (direct) return [direct];
  }
  const wantedPhone = phone(fields.phone);
  const wantedEmail = fold(fields.email);
  if (!wantedPhone && !wantedEmail) return [];
  return all.filter((person) => {
    const phones = googlePhones(person);
    const emails = (person?.emailAddresses || []).map((item) => fold(item?.value));
    return (
      (wantedPhone && phones.includes(wantedPhone)) ||
      (!wantedPhone && wantedEmail && emails.includes(wantedEmail))
    );
  });
}
async function writeGoogle(token, person, fields) {
  if (!person) {
    return googleApi(
      token,
      "people:createContact?personFields=names,nicknames,emailAddresses,phoneNumbers,userDefined",
      { method: "POST", body: JSON.stringify(personBody(fields)) },
    );
  }
  const full = await detailedPerson(token, person);
  if (!full?.resourceName) throw fail(409, "No se encontró el contacto de Google elegido.");
  return googleApi(
    token,
    full.resourceName +
      ":updateContact?updatePersonFields=names,nicknames,emailAddresses,phoneNumbers,userDefined&personFields=names,nicknames,emailAddresses,phoneNumbers,userDefined",
    { method: "PATCH", body: JSON.stringify(personBody(fields, full)) },
  );
}
function savedAsRequested(person, fields) {
  return (
    !!person?.resourceName &&
    (!phone(fields.phone) || googlePhones(person).includes(phone(fields.phone))) &&
    googleAligned(person, fields)
  );
}
async function verifyGoogle(token, person, fields) {
  // La respuesta de create/update es la primera confirmación; las lecturas
  // inmediatas de Google pueden ir con unos segundos de retraso.
  if (savedAsRequested(person, fields)) return person;
  for (let attempt = 0; attempt < 3; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    const full = await detailedPerson(token, person);
    if (savedAsRequested(full, fields)) return full;
  }
  throw fail(409, "Google no confirmó los datos guardados.");
}
async function records() {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const response = await request(
      SB + "/rest/v1/records?select=id,data&limit=1000&offset=" + offset,
      { headers: serviceHeaders() },
    );
    if (!response.ok) throw fail(503, "No se pudieron leer las fichas del CRM.");
    const page = await response.json();
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}
function signature(id, fields) {
  return JSON.stringify([
    safe(id),
    phone(fields.phone),
    safe(fields.first),
    safe(fields.last),
    safe(fields.nickname),
  ]);
}
async function latestRecord(id) {
  const response = await request(
    SB + "/rest/v1/records?id=eq." + encodeURIComponent(id) + "&select=id,data",
    { headers: serviceHeaders() },
  );
  if (!response.ok) throw fail(503, "No se pudo releer la ficha del CRM.");
  const row = (await response.json())[0];
  if (!row?.id || !row?.data) throw fail(404, "La ficha del CRM ya no existe.");
  return row;
}
async function writeCrm(row, fields, person, account) {
  const latest = await latestRecord(row.id);
  const data = { ...(latest.data || {}) };
  const tag = data[JOB];
  if (tag?.kind !== "crm_google_without_whatsapp")
    throw fail(409, "La ficha cambió y ya no está marcada para esta corrección.");
  const name = [safe(fields.first), safe(fields.last)].filter(Boolean).join(" ");
  data.NOMBRE = safe(fields.first);
  data.APELLIDOS = safe(fields.last);
  data["NOMBRE Y APELLIDOS"] = name;
  data.APODO = safe(fields.nickname);
  data.TELÉFONO = safe(fields.phone);
  data["DNI / NIF"] = safe(fields.dni);
  data.EMAIL = safe(fields.email);
  data.TPF_GOOGLE_CONTACT = {
    version: 1,
    resource_name: safe(person.resourceName),
    google_account: account,
    updated_at: new Date().toISOString(),
  };
  delete data.TPF_CONTACT_VERIFIED;
  data.TPF_CRM_GOOGLE_SYNC = {
    version: 1,
    signature: signature(row.id, fields),
    google_account: account,
    google_resource: safe(person.resourceName),
    verified_at: new Date().toISOString(),
    no_whatsapp: true,
  };
  delete data[JOB];
  const response = await request(
    SB + "/rest/v1/records?id=eq." + encodeURIComponent(row.id),
    {
      method: "PATCH",
      headers: { ...serviceHeaders(), Prefer: "return=representation" },
      body: JSON.stringify({ data }),
    },
  );
  if (!response.ok) throw fail(503, "Google se actualizó, pero el CRM no pudo confirmar la sincronización.");
  const saved = (await response.json())[0];
  const marker = saved?.data?.TPF_CRM_GOOGLE_SYNC;
  if (
    !saved?.id ||
    saved?.data?.[JOB] ||
    marker?.signature !== signature(row.id, fields) ||
    marker?.google_resource !== safe(person.resourceName) ||
    marker?.no_whatsapp !== true
  )
    throw fail(503, "No se confirmó el guardado de CRM y Google.");
  return saved;
}
async function processOne(row, token, account, contacts) {
  const tag = row?.data?.[JOB] || {};
  const fields = {
    first: safe(tag?.fields?.first),
    last: safe(tag?.fields?.last),
    nickname: safe(tag?.fields?.nickname),
    phone: safe(tag?.fields?.phone),
    dni: safe(tag?.fields?.dni),
    email: safe(tag?.fields?.email),
  };
  if (!fields.first) throw fail(409, "La decisión pendiente no tiene nombre.");
  const matches = findGoogle(row.data, fields, contacts);
  if (matches.length > 1)
    return {
      id: row.id,
      label: safe(tag.label) || fields.first,
      state: "manual",
      message: "Google tiene contactos duplicados con este teléfono; no se modificó ninguno.",
    };
  const saved = await writeGoogle(token, matches[0] || null, fields);
  const verified = await verifyGoogle(token, saved, fields);
  await writeCrm(row, fields, verified, account);
  return {
    id: row.id,
    label: safe(tag.label) || fields.first,
    state: "synced",
    resource: safe(verified.resourceName),
  };
}

module.exports = async function (req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false });
  if (!authorized(req)) return res.status(404).json({ ok: false });
  if (Date.now() > EXPIRES_AT)
    return res.status(410).json({ ok: false, error: "La ejecución temporal ya ha caducado." });
  if (!SERVICE || !CLIENT_ID || !CLIENT_SECRET || !ENCRYPTION_KEY)
    return res.status(503).json({ ok: false, error: "Falta la configuración segura del servidor." });
  try {
    const requested = Math.max(1, Math.min(2, Number(req.query?.limit) || 1));
    const pending = (await records())
      .filter((row) => row?.data?.[JOB]?.kind === "crm_google_without_whatsapp")
      .sort((left, right) => Number(left.data?.[JOB]?.order || 0) - Number(right.data?.[JOB]?.order || 0));
    if (!pending.length) return res.status(200).json({ ok: true, completed: 0, remaining: 0, results: [] });
    const { token, account } = await googleToken();
    if (!account) throw fail(409, "La cuenta de Google conectada no está identificada.");
    const contacts = await listContacts(token);
    const results = [];
    for (const row of pending.slice(0, requested)) {
      try {
        results.push(await processOne(row, token, account, contacts));
      } catch (error) {
        results.push({
          id: row.id,
          label: safe(row?.data?.[JOB]?.label) || "Contacto",
          state: "error",
          message: error?.message || "Error no identificado.",
        });
      }
    }
    const remaining = (await records()).filter(
      (row) => row?.data?.[JOB]?.kind === "crm_google_without_whatsapp",
    ).length;
    return res.status(200).json({
      ok: true,
      completed: results.filter((item) => item.state === "synced").length,
      remaining,
      results,
    });
  } catch (error) {
    console.error("pending-google-sync", error?.message || error);
    return res.status(error?.status || 500).json({ ok: false, error: error?.message || "Error interno." });
  }
};