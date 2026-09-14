(function () {
  "use strict";
  const M = window.TPFModules;
  if (!M) return;
  const $ = (id) => document.getElementById(id),
    SOURCES = ["BASE DE DATOS", "DATA", "CONTACTOS"],
    PAGE_SIZE = 100;
  const state = {
    results: [],
    running: false,
    filter: "all",
    query: "",
    page: 1,
    progress: "",
    error: "",
    account: "",
    analysedAt: "",
    prepared: {},
    reviewed: {},
    selected: new Set(),
    applying: false,
  };
  const safe = (value) => String(value ?? "").trim();
  const esc = (value) =>
    safe(value).replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  const phone = (value) => {
    let digits = safe(value).replace(/\D/g, "");
    if (digits.startsWith("00")) digits = digits.slice(2);
    if (digits.startsWith("34") && digits.length === 11)
      digits = digits.slice(2);
    return digits.length >= 7 ? digits.slice(-9) : "";
  };
  const chatId = (value) => safe(value).toLowerCase(),
    batchApi = () => window.TPFContactGoogleInline?.batch || null;
  const connected = () =>
    typeof googleContactsConnected === "function" && googleContactsConnected();
  const account = () =>
    typeof googleContactsEmail === "function"
      ? safe(googleContactsEmail()).toLocaleLowerCase("es-ES")
      : "";
  function add(map, key, value) {
    if (!key) return;
    const list = map.get(key) || [];
    if (!list.includes(value)) list.push(value);
    map.set(key, list);
  }
  function indexByPhone(rows, phones) {
    const map = new Map();
    for (const row of rows) {
      for (const value of new Set(
        (phones(row) || []).map(phone).filter(Boolean),
      ))
        add(map, value, row);
    }
    return map;
  }
  function isWhatsappPerson(chat) {
    const id = chatId(chat?.id);
    return !!phone(id) && /@c\.us$/i.test(id);
  }
  function syncMarker(row, c, currentAccount) {
    const marks = [
        row?.data?.TPF_CONTACT_VERIFIED,
        row?.data?.TPF_CRM_GOOGLE_SYNC,
      ],
      signature = JSON.stringify([
        safe(row?.id),
        phone(c?.phone),
        safe(c?.first),
        safe(c?.last),
        safe(c?.nickname),
      ]);
    for (const mark of marks) {
      const resource = safe(mark?.google_resource),
        markerAccount = safe(mark?.google_account).toLocaleLowerCase("es-ES");
      if (
        mark?.version === 1 &&
        mark?.signature === signature &&
        !!mark?.verified_at &&
        !!resource &&
        markerAccount === currentAccount
      )
        return { resource, account: markerAccount };
    }
    return null;
  }
  function binding(row, c, currentAccount) {
    const marker = syncMarker(row, c, currentAccount);
    if (marker) return marker;
    const value = row?.data?.TPF_GOOGLE_CONTACT || {};
    return {
      resource: safe(
        value.resource_name ||
          value.resourceName ||
          row?.data?.TPF_GOOGLE_CONTACT_RESOURCE,
      ),
      account: safe(
        value.google_account ||
          value.account ||
          row?.data?.TPF_GOOGLE_CONTACT_ACCOUNT,
      ).toLocaleLowerCase("es-ES"),
    };
  }
  function label(status) {
    return (
      {
        coincide: "CRM y Google coinciden",
        crm_phone_missing: "Sin teléfono válido en CRM",
        crm_name_incomplete: "Nombre incompleto en CRM",
        crm_phone_duplicate: "Teléfono repetido en CRM",
        google_account_mismatch: "Vínculo de otra cuenta de Google",
        google_bound_missing: "Vínculo de Google no encontrado",
        google_missing: "No está en Google",
        google_duplicate: "Más de un contacto de Google",
        google_data_mismatch: "Datos diferentes entre CRM y Google",
      }[status] || "Revisar"
    );
  }
  function whatsappLabel(status) {
    return (
      {
        same: "Coincide con CRM",
        different: "Nombre distinto en WhatsApp",
        missing: "No existe conversación",
        duplicate: "Más de una conversación",
        bound_missing: "Vínculo de WhatsApp no encontrado",
        invalid: "Nombre no válido en WhatsApp",
      }[status] || "Sin dato"
    );
  }
  function statusOrder(status) {
    return (
      {
        google_data_mismatch: 0,
        google_missing: 1,
        google_duplicate: 2,
        crm_phone_duplicate: 3,
        crm_phone_missing: 4,
        crm_name_incomplete: 5,
        google_bound_missing: 6,
        google_account_mismatch: 7,
        coincide: 8,
      }[status] ?? 20
    );
  }
  function pickWhatsapp(row, c, byId, byPhone) {
    const bound = safe(row?.data?.TPF_WHATSAPP_CHAT_ID),
      p = phone(c.phone);
    if (bound) {
      if (phone(bound) !== p) return { status: "bound_missing" };
      const found = byId.get(chatId(bound));
      return found
        ? { chat: found, status: "same" }
        : { status: "bound_missing" };
    }
    const matches = byPhone.get(p) || [];
    if (!matches.length) return { status: "missing" };
    if (matches.length !== 1) return { status: "duplicate" };
    return { chat: matches[0], status: "same" };
  }
  function pickGoogle(row, c, byId, byPhone, currentAccount) {
    const saved = binding(row, c, currentAccount),
      p = phone(c.phone);
    if (saved.resource) {
      if (saved.account && saved.account !== currentAccount)
        return { status: "google_account_mismatch" };
      const found = byId.get(saved.resource);
      return found ? { person: found } : { status: "google_bound_missing" };
    }
    const matches = byPhone.get(p) || [];
    if (!matches.length) return { status: "google_missing" };
    if (matches.length !== 1) return { status: "google_duplicate" };
    return { person: matches[0] };
  }
  function whatsappInfo(found, c, api) {
    if (!found.chat) return { status: found.status };
    const name = safe(found.chat.name);
    if (!name) return { chat: found.chat, status: "invalid" };
    return {
      chat: found.chat,
      status: api.strictWhatsappAligned(found.chat, c) ? "same" : "different",
    };
  }
  function analyzeRows(
    crmRows,
    googleRows,
    whatsappRows,
    api = batchApi(),
    currentAccount = account(),
  ) {
    if (
      !api?.contactData ||
      !api?.googlePhones ||
      !api?.strictGoogleAligned ||
      !api?.strictWhatsappAligned
    )
      throw Error(
        "La comparación de contactos aún no está lista. Actualiza la página e inténtalo de nuevo.",
      );
    const crm = [];
    for (const row of crmRows || []) {
      const c = api.contactData(row);
      if (c?.id) crm.push({ row, c });
    }
    const crmByPhone = indexByPhone(crm, (item) => [item.c.phone]),
      people = (googleRows || []).filter((item) => safe(item?.resourceName)),
      googleById = new Map(
        people.map((item) => [safe(item.resourceName), item]),
      ),
      googleByPhone = indexByPhone(people, (item) => api.googlePhones(item));
    const chats = (whatsappRows || []).filter(isWhatsappPerson),
      whatsappById = new Map(chats.map((item) => [chatId(item.id), item])),
      whatsappByPhone = indexByPhone(chats, (item) => [item.id]),
      result = [];
    for (const { row, c } of crm) {
      const p = phone(c.phone),
        marker = syncMarker(row, c, currentAccount);
      let status = "coincide",
        person = null;
      if (!c.first) status = "crm_name_incomplete";
      else if (!p && !marker) status = "crm_phone_missing";
      else if (p && (crmByPhone.get(p) || []).length !== 1)
        status = "crm_phone_duplicate";
      const wa = whatsappInfo(
        p
          ? pickWhatsapp(row, c, whatsappById, whatsappByPhone)
          : { status: "missing" },
        c,
        api,
      );
      if (status === "coincide") {
        const google = pickGoogle(
          row,
          c,
          googleById,
          googleByPhone,
          currentAccount,
        );
        if (google.status) status = google.status;
        else {
          person = google.person;
          const googlePhones = api.googlePhones(person).map(phone).filter(Boolean),
            phoneMatches = p
              ? googlePhones.includes(p)
              : googlePhones.length === 0;
          if (!phoneMatches || !api.strictGoogleAligned(person, c))
            status = "google_data_mismatch";
        }
      }
      result.push({
        row,
        c,
        status,
        person,
        chat: wa.chat,
        whatsappStatus: wa.status,
      });
    }
    return result.sort(
      (a, b) =>
        statusOrder(a.status) - statusOrder(b.status) ||
        safe(a.c?.name).localeCompare(safe(b.c?.name), "es"),
    );
  }
  function summary(rows = state.results) {
    const out = {
      total: rows.length,
      coincide: 0,
      crmGoogleDifferent: 0,
      whatsappDifferent: 0,
      greenWhatsappSame: 0,
      greenWhatsappDifferent: 0,
      greenWhatsappOther: 0,
      byStatus: {},
    };
    for (const row of rows) {
      out.byStatus[row.status] = (out.byStatus[row.status] || 0) + 1;
      if (row.status === "coincide") {
        out.coincide++;
        if (row.whatsappStatus === "same") out.greenWhatsappSame++;
        else if (row.whatsappStatus === "different")
          out.greenWhatsappDifferent++;
        else out.greenWhatsappOther++;
      } else out.crmGoogleDifferent++;
      if (row.whatsappStatus !== "same") out.whatsappDifferent++;
    }
    return out;
  }
  async function loadCrm(progress) {
    const rows = [],
      size = 1000;
    for (let from = 0; ; from += size) {
      progress?.(`Leyendo contactos del CRM… ${rows.length}`);
      const result = await sb
        .from("records")
        .select("id,source_sheet,data")
        .in("source_sheet", SOURCES)
        .range(from, from + size - 1);
      if (result.error) throw result.error;
      const chunk = result.data || [];
      rows.push(...chunk);
      if (chunk.length < size) break;
    }
    return rows;
  }
  async function loadGoogle(progress) {
    if (!connected())
      throw Error("Conecta Google Contacts antes de iniciar la comparación.");
    if (!account())
      throw Error("Elige primero la cuenta de Google que se va a comprobar.");
    if (typeof googleApi !== "function")
      throw Error("Google Contacts no está disponible en esta página.");
    const rows = [],
      fields = "names,nicknames,emailAddresses,phoneNumbers,metadata";
    let pageToken = "";
    do {
      progress?.(`Leyendo contactos de Google… ${rows.length}`);
      const query = new URLSearchParams({
        personFields: fields,
        pageSize: "1000",
      });
      query.append("sources", "READ_SOURCE_TYPE_CONTACT");
      if (pageToken) query.set("pageToken", pageToken);
      const data = await googleApi("people/me/connections?" + query.toString());
      rows.push(...(data.connections || []));
      pageToken = data.nextPageToken || "";
      if (rows.length > 50000)
        throw Error(
          "Hay demasiados contactos de Google para una sola comparación.",
        );
    } while (pageToken);
    return rows;
  }
  async function loadWhatsapp(progress) {
    progress?.("Leyendo nombres originales de WhatsApp…");
    const response = await fetch("/api/green?action=chats", { method: "GET" }),
      data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false)
      throw Error(data.error || "No se pudo leer WhatsApp.");
    if (data.degraded)
      throw Error(
        "WhatsApp está reconectando. Espera a que indique “Conectado” y vuelve a intentar.",
      );
    return Array.isArray(data.chats) ? data.chats : [];
  }
  async function collect(progress) {
    const crm = await loadCrm(progress),
      google = await loadGoogle(progress),
      whatsapp = await loadWhatsapp(progress);
    progress?.("Comparando los tres sitios…");
    return analyzeRows(crm, google, whatsapp, batchApi(), account());
  }
  function ensureStyles() {
    if ($("tpfBatchVerifyStyles")) return;
    const style = document.createElement("style");
    style.id = "tpfBatchVerifyStyles";
    style.textContent = `.tpfBatchBack{position:fixed;inset:0;z-index:290000;display:grid;place-items:center;padding:16px;background:#101828b8}.tpfBatchBack.hidden{display:none!important}.tpfBatchModal{display:flex;flex-direction:column;width:min(1160px,100%);height:min(92vh,820px);background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 26px 85px #0007;color:#1d2939}.tpfBatchHead{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:18px 20px;border-bottom:1px solid #e4e7ec}.tpfBatchHead h2{margin:3px 0 4px;font-size:21px}.tpfBatchHead p{margin:0;color:#667085;font-size:12px}.tpfBatchHead small{font-weight:800;color:#175cd3}.tpfBatchHead button{border:0;background:#f2f4f7;border-radius:50%;width:36px;height:36px;font-size:21px}.tpfBatchBody{flex:1;min-height:0;overflow:auto;padding:18px 20px}.tpfBatchIntro,.tpfBatchProgress,.tpfBatchError{padding:18px;border:1px solid #d0d5dd;border-radius:12px;background:#f8fafc}.tpfBatchIntro b,.tpfBatchProgress b{display:block;margin-bottom:5px}.tpfBatchIntro ul{margin:10px 0 0;padding-left:20px;color:#475467;font-size:12px;line-height:1.55}.tpfBatchProgress{color:#175cd3}.tpfBatchError{border-color:#fecdca;background:#fff5f5;color:#9b2737}.tpfBatchStats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}.tpfBatchStat{padding:12px;border:1px solid #e4e7ec;border-radius:10px;background:#fff}.tpfBatchStat span{display:block;color:#667085;font-size:10px;text-transform:uppercase}.tpfBatchStat b{display:block;margin-top:3px;font-size:23px}.tpfBatchStat.ok{background:#ecfdf3;border-color:#abefc6}.tpfBatchStat.warn{background:#fff7ed;border-color:#fed7aa}.tpfBatchGreenGroups{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:12px}.tpfBatchGreenGroup{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 12px;border:1px solid #abefc6;border-radius:10px;background:#f0fdf4;color:#166534;text-align:left}.tpfBatchGreenGroup.is-active{outline:2px solid #175cd3;outline-offset:1px}.tpfBatchGreenGroup b{display:block;font-size:12px}.tpfBatchGreenGroup small{display:block;margin-top:2px;color:#15803d;font-size:10px}.tpfBatchGreenGroup strong{font-size:22px}.tpfBatchGreenGroup.different{border-color:#fed7aa;background:#fffbeb;color:#9a3412}.tpfBatchGreenGroup.different small{color:#b45309}.tpfBatchSelection{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:-2px 0 12px;padding:9px 10px;border:1px solid #d0d5dd;border-radius:10px;background:#f8fafc;font-size:11px}.tpfBatchSelection b{margin-right:auto}.tpfBatchSelection button{padding:5px 8px;font-size:10px}.tpfBatchBar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:10px 0 12px}.tpfBatchBar input{flex:1;min-width:230px}.tpfBatchBar select{min-width:220px}.tpfBatchBar small{color:#667085}.tpfBatchTable{width:100%;border-collapse:collapse;min-width:940px}.tpfBatchTableWrap{overflow:auto;border:1px solid #e4e7ec;border-radius:10px}.tpfBatchTable th,.tpfBatchTable td{padding:10px;border-bottom:1px solid #eaecf0;text-align:left;vertical-align:top;font-size:11px}.tpfBatchTable th{position:sticky;top:0;background:#f8fafc;text-transform:uppercase;color:#667085;font-size:9px;letter-spacing:.04em}.tpfBatchTable td small{display:block;color:#667085;margin-top:3px}.tpfBatchSelect{width:34px;text-align:center!important}.tpfBatchSelect input{width:16px;height:16px;accent-color:#175cd3}.tpfBatchBadge{display:inline-block;padding:4px 7px;border-radius:999px;background:#f2f4f7;font-weight:750;font-size:10px}.tpfBatchBadge.coincide{background:#ecfdf3;color:#027a48}.tpfBatchBadge.google_data_mismatch{background:#fff0e8;color:#b54708}.tpfBatchWa.same{color:#027a48}.tpfBatchWa.different{color:#b54708}.tpfBatchPager{display:flex;align-items:center;justify-content:center;gap:10px;padding-top:13px}.tpfBatchEmpty{padding:25px;color:#667085;text-align:center}.tpfBatchFoot{display:flex;align-items:center;justify-content:flex-end;gap:9px;padding:14px 20px;border-top:1px solid #e4e7ec}.tpfBatchFoot .tpfBatchNote{margin-right:auto;color:#667085;font-size:11px}.tpfBatchFoot button{min-height:38px}@media(max-width:760px){.tpfBatchBack{padding:6px}.tpfBatchModal{height:98vh;border-radius:12px}.tpfBatchStats{grid-template-columns:repeat(2,minmax(0,1fr))}.tpfBatchGreenGroups{grid-template-columns:1fr}.tpfBatchBody{padding:13px}.tpfBatchHead,.tpfBatchFoot{padding:13px}.tpfBatchBar{align-items:stretch}.tpfBatchBar input,.tpfBatchBar select{min-width:100%;width:100%}}`;
    document.head.appendChild(style);
  }
  function decisionStyles() {
    if ($("tpfBatchDecisionStyles")) return;
    const style = document.createElement("style");
    style.id = "tpfBatchDecisionStyles";
    style.textContent = `.tpfBatchDecision{position:fixed;inset:0;z-index:320000;display:grid;place-items:center;padding:18px;background:#101828b8}.tpfBatchDecision.hidden{display:none!important}.tpfDecisionCard{width:min(1220px,100%);max-height:92vh;overflow:auto;border-radius:16px;background:#fff;color:#1d2939;box-shadow:0 26px 85px #0008}.tpfDecisionCard header{display:flex;justify-content:space-between;gap:16px;padding:18px 20px;border-bottom:1px solid #e4e7ec}.tpfDecisionCard header small{font-weight:800;color:#175cd3}.tpfDecisionCard h3{margin:4px 0}.tpfDecisionCard p{margin:0;color:#667085;font-size:12px}.tpfDecisionCard header button{border:0;border-radius:50%;width:36px;height:36px;font-size:22px}.tpfDecisionWrap{padding:16px 20px}.tpfDecisionWrap table{width:100%;min-width:980px;border-collapse:collapse}.tpfDecisionWrap th,.tpfDecisionWrap td{padding:10px;border-bottom:1px solid #eaecf0;text-align:left;vertical-align:top;font-size:12px}.tpfDecisionWrap td button{display:block;margin-top:7px;padding:4px 7px;border:1px solid #b2ccff;border-radius:6px;background:#eff4ff;color:#1849a9;font-size:10px}.tpfDecisionWrap input{width:100%;box-sizing:border-box;padding:8px}.tpfDecisionHolder{margin:15px 0;padding:12px;border:1px solid #d0d5dd;border-radius:10px}.tpfDecisionHolder label{display:inline-flex;gap:6px;margin:4px 16px 4px 0;font-size:12px}.tpfDecisionHolder input[type=radio]{width:auto}.tpfDecisionHolder button{display:block;margin:6px 0}.tpfDecisionHolder small{display:block;color:#667085;margin-top:6px}.tpfDecisionActions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.tpfDecisionActions .danger,.tpfBatchTable .danger{border:1px solid #fecdca;background:#fff;color:#b42318}.tpfDecisionWrap>small{display:block;margin-top:10px;color:#667085}.tpfBatchTable td button{margin:2px;padding:5px 7px;font-size:10px}@media(max-width:800px){.tpfDecisionCard{max-height:98vh}.tpfDecisionWrap{overflow:auto;padding:12px}.tpfDecisionActions{align-items:stretch;flex-direction:column}}`;
    document.head.appendChild(style);
  }
  function ensureModal() {
    let back = $("tpfBatchVerifyBack");
    if (back) return back;
    ensureStyles();
    decisionStyles();
    back = document.createElement("div");
    back.id = "tpfBatchVerifyBack";
    back.className = "tpfBatchBack hidden";
    back.innerHTML = `<section class="tpfBatchModal" role="dialog" aria-modal="true" aria-labelledby="tpfBatchTitle"><header class="tpfBatchHead"><div><small>REVISIÓN COMPLETA · NO SE GUARDA HASTA EL FINAL</small><h2 id="tpfBatchTitle">CRM, Google y WhatsApp</h2><p>Elige y edita los datos. Todos los cambios se preparan primero y se confirman juntos al final.</p></div><button id="tpfBatchClose" type="button" aria-label="Cerrar">×</button></header><div id="tpfBatchBody" class="tpfBatchBody"></div><footer class="tpfBatchFoot"><span id="tpfBatchNote" class="tpfBatchNote"></span><button id="tpfBatchSaveDraft" class="secondary" type="button">Guardar borrador</button><button id="tpfBatchLoadDraft" class="secondary" type="button">Cargar borrador</button><input id="tpfBatchDraftFile" type="file" accept="application/json,.json" hidden><button id="tpfBatchApply" class="primary" type="button">Aplicar cambios preparados (0)</button><button id="tpfBatchRun" class="secondary" type="button">Actualizar comparación</button></footer></section><div id="tpfBatchDecision" class="tpfBatchDecision hidden"></div>`;
    document.body.appendChild(back);
    $("tpfBatchClose").onclick = close;
    back.onclick = (event) => {
      if (event.target === back) close();
    };
    $("tpfBatchRun").onclick = run;
    $("tpfBatchApply").onclick = applyPrepared;
    $("tpfBatchSaveDraft").onclick = saveDraft;
    $("tpfBatchLoadDraft").onclick = () => $("tpfBatchDraftFile").click();
    $("tpfBatchDraftFile").onchange = loadDraftFile;
    return back;
  }
  function close() {
    if (state.running) return;
    $("tpfBatchVerifyBack")?.classList.add("hidden");
  }
  function rowKey(item) {
    return safe(item?.row?.id);
  }
  function selectableGreen(row) {
    return (
      row?.status === "coincide" &&
      (row.whatsappStatus === "same" || row.whatsappStatus === "different")
    );
  }
  function matchesFilter(row, filter = state.filter) {
    if (filter === "green_whatsapp_same")
      return row.status === "coincide" && row.whatsappStatus === "same";
    if (filter === "green_whatsapp_different")
      return row.status === "coincide" && row.whatsappStatus === "different";
    return filter === "all" || row.status === filter;
  }
  function selectedRows(rows = state.results) {
    return (rows || []).filter(
      (row) => selectableGreen(row) && state.selected.has(rowKey(row)),
    );
  }
  function pruneSelected() {
    // Mientras la comparación está en curso no se borra la selección: al
    // terminar se conserva solo la de fichas que siguen siendo válidas.
    if (!state.results.length) return;
    const valid = new Set(
      state.results.filter(selectableGreen).map((row) => rowKey(row)),
    );
    for (const id of [...state.selected]) if (!valid.has(id)) state.selected.delete(id);
  }
  function setSelected(rows, checked) {
    for (const row of rows || []) {
      const id = rowKey(row);
      if (!id || !selectableGreen(row)) continue;
      if (checked) state.selected.add(id);
      else state.selected.delete(id);
    }
  }
  function filtered() {
    const text = safe(state.query).toLocaleLowerCase("es-ES");
    return state.results.filter(
      (row) =>
        matchesFilter(row) &&
        (!text ||
          [
            row.c?.name,
            row.c?.nickname,
            row.c?.dni,
            row.c?.phone,
            row.chat?.name,
            row.person && batchApi()?.googleView?.(row.person)?.name,
            row.status,
            row.whatsappStatus,
          ]
            .join(" ")
            .toLocaleLowerCase("es-ES")
            .includes(text)),
    );
  }
  function preparedKey(item) {
    return safe(item?.row?.id);
  }
  function preparedCount() {
    return Object.keys(state.prepared).length;
  }
  function setPrepared(item) {
    delete state.reviewed[preparedKey(item)];
    state.prepared[preparedKey(item)] = item;
    render();
  }
  function unsetPrepared(row) {
    delete state.prepared[safe(row?.row?.id)];
    render();
  }
  function markReviewed(row) {
    const id = safe(row?.id);
    if (!id) return;
    delete state.prepared[id];
    state.reviewed[id] = { id, kind: "keep" };
    render();
  }
  function reviewedCount() {
    return Object.keys(state.reviewed).length;
  }
  function draftItems() {
    const actions = Object.values(state.prepared).map((item) => ({
      id: safe(item?.row?.id),
      kind: item.kind,
      fields: item.fields || null,
      holder: item.holder || null,
      relationMode: item.relationMode || "self",
      label: safe(item.label),
    }));
    return [...actions, ...Object.values(state.reviewed)];
  }
  function saveDraft() {
    const items = draftItems();
    if (!items.length)
      return alert("No hay decisiones preparadas para guardar en el borrador.");
    const data = {
      type: "TPF_CONTACTS_DRAFT",
      version: 1,
      saved_at: new Date().toISOString(),
      google_account: state.account,
      decisions: items,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      }),
      link = document.createElement("a"),
      date = new Date().toISOString().slice(0, 10);
    link.href = URL.createObjectURL(blob);
    link.download = "Borrador-contactos-CRM-Google-WhatsApp-" + date + ".json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    alert("Borrador guardado. No se ha cambiado ningún contacto.");
  }
  function restoreDraft(draft) {
    if (draft?.type !== "TPF_CONTACTS_DRAFT" || !Array.isArray(draft.decisions))
      throw Error("Este archivo no es un borrador válido de contactos.");
    if (!state.results.length)
      throw Error("Primero pulsa “Actualizar comparación” para leer los contactos actuales.");
    const rows = new Map(state.results.map((item) => [safe(item.row?.id), item]));
    state.prepared = {};
    state.reviewed = {};
    let loaded = 0,
      missing = 0;
    for (const saved of draft.decisions) {
      const item = rows.get(safe(saved?.id));
      if (!item || !["edit", "trash", "keep"].includes(saved?.kind)) {
        missing++;
        continue;
      }
      if (saved.kind === "keep") {
        state.reviewed[safe(item.row.id)] = { id: safe(item.row.id), kind: "keep" };
        loaded++;
        continue;
      }
      state.prepared[safe(item.row.id)] = {
        kind: saved.kind,
        row: item.row,
        person: item.person,
        chat: item.chat,
        fields: saved.kind === "edit" ? saved.fields || {} : undefined,
        holder: saved.kind === "edit" ? saved.holder || null : null,
        relationMode: saved.kind === "edit" ? saved.relationMode || "self" : "self",
        label: safe(saved.label) || item.c?.name || "Contacto",
      };
      loaded++;
    }
    render();
    alert(
      "Borrador cargado: " +
        loaded +
        " decisión(es)." +
        (missing ? " " + missing + " no se encontró o ya no es aplicable." : "") +
        " Aún no se ha cambiado nada.",
    );
  }
  async function loadDraftFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      restoreDraft(JSON.parse(await file.text()));
    } catch (error) {
      alert(error?.message || "No se pudo cargar el borrador.");
    }
  }
  function googleFields(person) {
    const api = batchApi(),
      g = (person && api?.googleView?.(person)) || {},
      dni = safe(
        (person?.userDefined || []).find((x) =>
          /^(dni|nif|dni \/ nif|dni\/nif)$/i.test(safe(x?.key)),
        )?.value,
      ),
      email = safe(person?.emailAddresses?.[0]?.value),
      mobile = safe(person?.phoneNumbers?.[0]?.value);
    return {
      first: g.first || "",
      last: g.last || "",
      nickname: g.nickname || "",
      phone: mobile,
      dni,
      email,
    };
  }
  function waFields(item) {
    const name = safe(item?.chat?.name),
      parts = name.split(/\s+/).filter(Boolean);
    return {
      first: parts.shift() || "",
      last: parts.join(" "),
      // WhatsApp supplies its public display name, not an editable CRM alias.
      // Never present that name as an "apodo" that could be copied by mistake.
      nickname: "",
      phone: item?.c?.phone || "",
      dni: "",
      email: "",
    };
  }
  function decisionDialog(item) {
    const api = batchApi();
    if (!api) return alert("La comparación aún no ha terminado de cargar.");
    const c = item.c,
      g = googleFields(item.person),
      w = waFields(item),
      old = state.prepared[safe(item.row.id)]?.fields || {},
      value = (field, source) => source[field] || "";
    const fields = [
        ["Nombre", "first"],
        ["Apellidos", "last"],
        ["Apodo", "nickname"],
        ["Teléfono", "phone"],
        ["DNI / NIF", "dni"],
        ["Correo", "email"],
      ],
      back = $("tpfBatchDecision");
    const whatsappCell = (key) => {
      const publicName = safe(item.chat?.name);
      if (key === "nickname")
        return `${publicName ? `Sin apodo <small>Nombre público: ${esc(publicName)}</small>` : "Sin apodo"}<button data-pick="wa" data-field="${key}" disabled>Usar WhatsApp</button>`;
      return `${esc(value(key, w) || "—")}<button data-pick="wa" data-field="${key}" ${value(key, w) ? "" : "disabled"}>Usar WhatsApp</button>`;
    };
    back.innerHTML = `<section class="tpfDecisionCard" role="dialog" aria-modal="true"><header><div><small>DECIDIR Y EDITAR · SIN GUARDAR AÚN</small><h3>${esc(c.name || "Contacto")}</h3><p>Elige un valor por campo o escríbelo. Al confirmar al final se guardará la elección en CRM y Google; WhatsApp queda enlazado a esa ficha.</p></div><button id="tpfDecisionClose" type="button">×</button></header><div class="tpfDecisionWrap"><table><thead><tr><th>Dato</th><th>CRM</th><th>WhatsApp</th><th>Google</th><th>Tu elección final</th></tr></thead><tbody>${fields.map(([title, key]) => `<tr><th>${title}</th><td>${esc(value(key, c))}<button data-pick="crm" data-field="${key}">Usar CRM</button></td><td>${whatsappCell(key)}</td><td>${esc(value(key, g) || "—")}<button data-pick="google" data-field="${key}" ${value(key, g) ? "" : "disabled"}>Usar Google</button></td><td><input data-final="${key}" value="${esc(old[key] ?? value(key, c))}" placeholder="Vacío"></td></tr>`).join("")}</tbody></table><fieldset class="tpfDecisionHolder"><legend>Relación del contrato</legend><label><input type="radio" name="tpf-holder-mode" value="self" checked> Es titular del contrato</label><label><input type="radio" name="tpf-holder-mode" value="holder_of"> Es titular y está asociado a otra ficha</label><label><input type="radio" name="tpf-holder-mode" value="associated"> Está asociado a otro titular</label><div id="tpfDecisionHolderBox" hidden><b id="tpfDecisionHolderLabel">Buscar ficha asociada</b><input id="tpfDecisionHolderSearch" type="search" placeholder="Buscar por nombre, teléfono o DNI"><div id="tpfDecisionHolderResults"></div><small>Elige una ficha existente. No crea otra ficha.</small></div></fieldset><div class="tpfDecisionActions"><button id="tpfDecisionKeep" class="secondary">Mantener sin cambios</button><button id="tpfDecisionTrash" class="danger" ${item.person?.resourceName ? "" : "disabled"}>Preparar borrado en CRM y Google</button><button id="tpfDecisionSave" class="primary">Preparar esta elección</button></div><small>“Borrar” solo se prepara ahora: no se mueve nada a la papelera hasta pulsar “Aplicar cambios preparados”.</small></div></section>`;
    back.classList.remove("hidden");
    const sources = { crm: c, wa: w, google: g };
    back.querySelectorAll("[data-pick]").forEach(
      (button) =>
        (button.onclick = () => {
          const input = back.querySelector(
            `[data-final="${button.dataset.field}"]`,
          );
          input.value =
            sources[button.dataset.pick][button.dataset.field] || "";
          input.focus();
        }),
    );
    let holder = null;
    const holderBox = $("tpfDecisionHolderBox"), holderSearch = $("tpfDecisionHolderSearch"), holderResults = $("tpfDecisionHolderResults"), holderLabel = $("tpfDecisionHolderLabel");
    back.querySelectorAll('[name="tpf-holder-mode"]').forEach((input) => input.onchange = () => { const mode = back.querySelector('[name="tpf-holder-mode"]:checked')?.value || "self"; holderBox.hidden = mode === "self"; holderLabel.textContent = mode === "associated" ? "Buscar titular del contrato" : "Buscar persona asociada a este titular"; if (mode === "self") holder = null; });
    holderSearch.oninput = async () => { const q = safe(holderSearch.value); holder = null; if (q.length < 2) return holderResults.textContent = ""; holderResults.textContent = "Buscando titulares…"; try { const matches = await window.TPFContactRelations?.searchRecords?.(q) || []; holderResults.innerHTML = matches.filter(x => safe(x.id) !== safe(item.row.id)).slice(0,12).map((x,i) => `<button type="button" class="secondary" data-holder="${i}">${esc(x.name || "Sin nombre")} · ${esc(x.dni || x.phone || "sin datos")}</button>`).join("") || "No se encontró ningún titular."; holderResults.querySelectorAll("[data-holder]").forEach(button => button.onclick = () => { holder = matches.filter(x => safe(x.id) !== safe(item.row.id))[Number(button.dataset.holder)]; const mode = back.querySelector('[name="tpf-holder-mode"]:checked')?.value || "self"; holderResults.textContent = `${mode === "associated" ? "Titular elegido" : "Persona asociada elegida"}: ${holder.name}`; }); } catch (_) { holderResults.textContent = "No se pudo buscar el titular."; } };
    const close = () => back.classList.add("hidden");
    $("tpfDecisionClose").onclick = close;
    const prepareChoice = () => {
      const values = {};
      back
        .querySelectorAll("[data-final]")
        .forEach((input) => (values[input.dataset.final] = safe(input.value)));
      if (!values.first)
        return alert(
          "Necesitas al menos un nombre para preparar la sincronización. El teléfono puede quedar vacío.",
        );
      const relationMode = back.querySelector('[name="tpf-holder-mode"]:checked')?.value || "self";
      if (relationMode !== "self" && !holder) return alert(relationMode === "associated" ? "Elige el titular del contrato." : "Elige la persona asociada a este titular.");
      setPrepared({
        kind: "edit",
        row: item.row,
        person: item.person,
        chat: item.chat,
        holder,
        relationMode,
        fields: values,
        label: [values.first, values.last, values.nickname]
          .filter(Boolean)
          .join(" "),
      });
      close();
    };
    // One delegated handler for the three bottom actions. It remains active
    // even if the modal content is redrawn while the user is working.
    back.onclick = (event) => {
      const button = event.target.closest(
        "#tpfDecisionKeep, #tpfDecisionTrash, #tpfDecisionSave",
      );
      if (!button || button.disabled) return;
      event.preventDefault();
      if (button.id === "tpfDecisionKeep") {
        close();
        // "Mantener" does not add or change anything in any of the three sites.
        markReviewed(item.row);
      } else if (button.id === "tpfDecisionTrash") {
        setPrepared({
          kind: "trash",
          row: item.row,
          person: item.person,
          chat: item.chat,
          label: c.name,
        });
        close();
      } else {
        prepareChoice();
      }
    };
  }
  async function applyPrepared() {
    const items = Object.values(state.prepared).filter(
      (x) => x.kind !== "keep",
    );
    if (!items.length)
      return alert("No hay cambios preparados. “Mantener” no modifica nada.");
    const names = items
        .slice(0, 8)
        .map(
          (x) =>
            "• " +
            x.label +
            " (" +
            (x.kind === "trash"
              ? "enviar a papelera"
              : "guardar en CRM y Google") +
            ")",
        )
        .join("\n"),
      extra = items.length > 8 ? "\n… y " + (items.length - 8) + " más" : "";
    if (
      !confirm(
        "Se aplicarán " +
          items.length +
          " cambio(s) preparado(s):\n\n" +
          names +
          extra +
          "\n\nNo se tocará ningún otro contacto. ¿Confirmas aplicar ahora?",
      )
    )
      return;
    const api = window.TPFContactGoogleInline;
    if (!api?.applyPreparedDecision || !api?.applyPreparedTrash)
      return alert(
        "El módulo seguro todavía no está listo. Actualiza la página una vez e inténtalo de nuevo.",
      );
    state.applying = true;
    let done = 0;
    const failed = [],
      needsGoogleChoice = [];
    try {
      for (const item of items) {
        try {
          if (item.kind === "edit") await api.applyPreparedDecision(item);
          else if (item.kind === "trash") await api.applyPreparedTrash(item);
          else continue;
          done++;
          delete state.prepared[preparedKey(item)];
        } catch (error) {
          // No es un error técnico: hay varios Google para el mismo teléfono.
          // Abrimos el selector seguro en vez de dejar un aviso sin salida.
          if (error?.code === "TPF_GOOGLE_DUPLICATES") {
            needsGoogleChoice.push(item);
            continue;
          }
          failed.push({
            label: safe(item.label) || "Contacto sin nombre",
            message: error?.message || "Error desconocido",
          });
        }
      }
      // Si Google tiene varios contactos, la decisión debe aparecer ya:
      // no esperamos a releer los 1.318 contactos antes de abrirla.
      // Al guardar, el evento tpf:contact-updated elimina el borrador y recarga.
      if (needsGoogleChoice.length) {
        const item = needsGoogleChoice[0];
        state.applying = false;
        render();
        if (typeof api.openDecisionForRow === "function") {
          api.openDecisionForRow(item.row, item.chat || null);
          return;
        }
        failed.push({
          label: safe(item.label) || "Contacto sin nombre",
          message: "No se pudo abrir el selector de duplicados.",
        });
      }
      // Vuelve a leer los tres sitios cuando no queda una decisión abierta.
      await run();
      const failedLines = failed
          .slice(0, 5)
          .map((item) => "• " + item.label + ": " + item.message)
          .join("\n"),
        more =
          failed.length > 5
            ? "\n… y " + (failed.length - 5) + " contacto(s) más."
            : "";
      if (failed.length) {
        alert(
          "Se aplicaron " +
            done +
            " de " +
            items.length +
            " cambio(s) y se actualizó la comparación.\n\n" +
            "No se aplicaron estos contactos; quedan preparados para revisarlos:\n" +
            failedLines +
            more,
        );
      } else {
        alert(
          "Se han aplicado " +
            done +
            " cambio(s) y se ha actualizado la comparación. Los aplicados ya no quedan preparados.",
        );
      }
    } finally {
      state.applying = false;
      render();
    }
  }
  async function approveSelected() {
    const items = selectedRows();
    if (!items.length)
      return alert("Selecciona primero contactos verdes para confirmarlos.");
    const preview = items
        .slice(0, 8)
        .map((item) => "• " + safe(item.c?.name || "Contacto sin nombre"))
        .join("\n"),
      extra = items.length > 8 ? "\n… y " + (items.length - 8) + " más" : "";
    if (
      !confirm(
        "Se confirmarán " +
          items.length +
          " contacto(s) en CRM, Google y WhatsApp:\n\n" +
          preview +
          extra +
          "\n\nCRM y Google ya coinciden. Se guardará el vínculo seguro con el chat de WhatsApp y se mostrará el nombre final del CRM. No se cambia el nombre público de WhatsApp. ¿Confirmas?",
      )
    )
      return;
    const api = window.TPFContactGoogleInline;
    if (!api?.confirmThreeWayVerified)
      return alert(
        "El módulo seguro todavía no está listo. Actualiza la página una vez e inténtalo de nuevo.",
      );
    state.applying = true;
    let done = 0;
    const failed = [];
    try {
      for (const item of items) {
        try {
          await api.confirmThreeWayVerified(item.row, item.person, item.chat);
          state.selected.delete(rowKey(item));
          done++;
        } catch (error) {
          failed.push({
            label: safe(item.c?.name) || "Contacto sin nombre",
            message: error?.message || "Error desconocido",
          });
        }
      }
      await run();
      const failedLines = failed
          .slice(0, 5)
          .map((item) => "• " + item.label + ": " + item.message)
          .join("\n"),
        more =
          failed.length > 5
            ? "\n… y " + (failed.length - 5) + " contacto(s) más."
            : "";
      if (failed.length)
        alert(
          "Se confirmaron " +
            done +
            " de " +
            items.length +
            " contacto(s). Los que no se pudieron confirmar siguen seleccionados para revisarlos:\n\n" +
            failedLines +
            more,
        );
      else
        alert(
          "Se confirmaron " +
            done +
            " contacto(s) en CRM, Google y WhatsApp. Ya aparecen como verificados.",
        );
    } finally {
      state.applying = false;
      render();
    }
  }
  function render(options = {}) {
    const body = $("tpfBatchBody"),
      runButton = $("tpfBatchRun"),
      note = $("tpfBatchNote"),
      apply = $("tpfBatchApply");
    if (!body) return;
    runButton.disabled = state.running || state.applying;
    if (apply) {
      apply.disabled = state.running || state.applying || !preparedCount();
      apply.textContent = state.applying
        ? "Aplicando cambios…"
        : "Aplicar cambios preparados (" + preparedCount() + ")";
    }
    if (state.running) {
      body.innerHTML = `<div class="tpfBatchProgress"><b>Comparación en curso…</b><span>${esc(state.progress || "Preparando…")}</span></div>`;
      note.textContent = "Solo se están leyendo los tres sitios.";
      return;
    }
    if (state.error) {
      body.innerHTML = `<div class="tpfBatchError"><b>No se ha cambiado ningún contacto.</b><br>${esc(state.error)}</div>`;
      note.textContent = "Corrige la conexión y vuelve a comparar.";
      return;
    }
    if (!state.results.length) {
      body.innerHTML = `<div class="tpfBatchIntro"><b>Revisión completa.</b><span>Primero lee CRM, Google y WhatsApp. Después podrás preparar decisiones sin aplicar nada todavía.</span></div>`;
      note.textContent =
        "Pulsa “Actualizar comparación” para leer los datos actuales.";
      return;
    }
    pruneSelected();
    const data = summary(),
      all = filtered(),
      selectable = all.filter(selectableGreen),
      selectedTotal = selectedRows().length,
      allSelectableSelected =
        !!selectable.length &&
        selectable.every((row) => state.selected.has(rowKey(row))),
      pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    state.page = Math.min(state.page, pages);
    const rows = all.slice(
        (state.page - 1) * PAGE_SIZE,
        state.page * PAGE_SIZE,
      ),
      statuses = Object.entries(data.byStatus).sort(
        (a, b) => statusOrder(a[0]) - statusOrder(b[0]),
      );
    body.innerHTML = `<div class="tpfBatchStats"><div class="tpfBatchStat"><span>Contactos CRM</span><b>${data.total}</b></div><div class="tpfBatchStat ok"><span>CRM y Google iguales</span><b>${data.coincide}</b></div><div class="tpfBatchStat warn"><span>CRM y Google a revisar</span><b>${data.crmGoogleDifferent}</b></div><div class="tpfBatchStat"><span>WhatsApp distinto o no encontrado</span><b>${data.whatsappDifferent}</b></div></div><div class="tpfBatchGreenGroups"><button type="button" class="tpfBatchGreenGroup ${state.filter === "green_whatsapp_same" ? "is-active" : ""}" data-green-filter="green_whatsapp_same"><span><b>WhatsApp coincide con CRM</b><small>CRM y Google ya coinciden</small></span><strong>${data.greenWhatsappSame}</strong></button><button type="button" class="tpfBatchGreenGroup different ${state.filter === "green_whatsapp_different" ? "is-active" : ""}" data-green-filter="green_whatsapp_different"><span><b>Nombre distinto en WhatsApp</b><small>CRM y Google ya coinciden</small></span><strong>${data.greenWhatsappDifferent}</strong></button></div><div class="tpfBatchIntro"><b>Preparados: ${preparedCount()} · Revisados sin cambios: ${reviewedCount()}</b><span>Pulsa <b>Comprobar</b> para elegir campo por campo; <b>Mantener</b> deja una marca de revisión, pero no cambia nada; <b>Borrar</b> solo prepara el envío a papelera.</span></div><div class="tpfBatchBar"><input id="tpfBatchSearch" type="search" placeholder="Buscar nombre, teléfono, DNI o apodo" value="${esc(state.query)}"><select id="tpfBatchFilter"><option value="all">Todos (${data.total})</option><option value="green_whatsapp_same" ${state.filter === "green_whatsapp_same" ? "selected" : ""}>CRM y Google iguales · WhatsApp coincide (${data.greenWhatsappSame})</option><option value="green_whatsapp_different" ${state.filter === "green_whatsapp_different" ? "selected" : ""}>CRM y Google iguales · Nombre distinto en WhatsApp (${data.greenWhatsappDifferent})</option>${statuses.map(([key, count]) => `<option value="${esc(key)}" ${state.filter === key ? "selected" : ""}>${esc(label(key))} (${count})</option>`).join("")}</select><small>Cuenta: ${esc(state.account || "—")} · ${esc(state.analysedAt)}</small></div><div class="tpfBatchSelection"><b>${selectedTotal ? `${selectedTotal} seleccionado${selectedTotal === 1 ? "" : "s"}` : "Sin selección"}</b><button id="tpfBatchSelectAll" class="secondary" type="button" ${selectable.length ? "" : "disabled"}>${allSelectableSelected ? "Quitar todos de este grupo" : `Seleccionar todos de este grupo (${selectable.length})`}</button>${selectedTotal ? `<button id="tpfBatchClearSelected" class="secondary" type="button">Quitar selección (${selectedTotal})</button>` : ""}<small>Solo selecciona: no cambia ni guarda ninguna ficha.</small></div><div class="tpfBatchTableWrap"><table class="tpfBatchTable"><thead><tr><th class="tpfBatchSelect"><input id="tpfBatchSelectPage" type="checkbox" aria-label="Seleccionar todos los contactos de este grupo" ${allSelectableSelected ? "checked" : ""} ${selectable.length ? "" : "disabled"}></th><th>Estado</th><th>CRM</th><th>WhatsApp original</th><th>Google</th><th>Teléfono</th><th>DNI / NIF</th><th>Acciones</th></tr></thead><tbody>${
      rows
        .map((row, index) => {
          const g = row.person ? batchApi()?.googleView?.(row.person) : null,
            decision = state.prepared[safe(row.row.id)],
            reviewed = state.reviewed[safe(row.row.id)],
            checked = state.selected.has(rowKey(row)),
            wa = row.chat?.name || "—",
            gt =
              (
                (row.person && batchApi()?.googlePhones?.(row.person)) ||
                []
              ).join(", ") || "—",
            gd =
              safe(
                (row.person?.userDefined || []).find((item) =>
                  /^(dni|nif|dni \/ nif|dni\/nif)$/i.test(safe(item?.key)),
                )?.value,
              ) || "—";
          return `<tr><td class="tpfBatchSelect">${selectableGreen(row) ? `<input class="tpfBatchSelectRow" type="checkbox" data-row-index="${index}" aria-label="Seleccionar ${esc(row.c?.name || "contacto")}" ${checked ? "checked" : ""}>` : "—"}</td><td><span class="tpfBatchBadge ${esc(row.status)}">${esc(label(row.status))}</span>${decision ? `<small>Preparado: ${esc(decision.kind === "trash" ? "borrar" : "editar")}</small>` : reviewed ? "<small>Revisado: mantener</small>" : ""}</td><td><b>${esc(row.c?.name || "—")}</b>${row.c?.nickname ? `<small>Apodo: ${esc(row.c.nickname)}</small>` : ""}</td><td><b>${esc(wa)}</b><small class="tpfBatchWa ${esc(row.whatsappStatus)}">${esc(whatsappLabel(row.whatsappStatus))}</small></td><td>${g ? `<b>${esc(g.name || "—")}</b>${g.nickname ? `<small>Apodo: ${esc(g.nickname)}</small>` : ""}<small>Tel.: ${esc(gt)} · DNI: ${esc(gd)}</small>` : "—"}</td><td><b>CRM:</b> ${esc(row.c?.phone || "—")}<small><b>Google:</b> ${esc(gt)}</small></td><td><b>CRM:</b> ${esc(row.c?.dni || "—")}<small><b>Google:</b> ${esc(gd)}</small></td><td><button type="button" class="secondary tpfBatchCheck" data-row-index="${index}">Comprobar</button><button type="button" class="secondary tpfBatchKeep" data-row-index="${index}">Mantener</button><button type="button" class="danger tpfBatchTrash" data-row-index="${index}">${row.person?.resourceName ? "Borrar" : "Borrar del CRM"}</button>${decision || reviewed ? `<button type="button" class="secondary tpfBatchUndo" data-row-index="${index}">Quitar</button>` : ""}</td></tr>`;
        })
        .join("") ||
      '<tr><td colspan="8" class="tpfBatchEmpty">No hay resultados con este filtro.</td></tr>'
    }</tbody></table></div><div class="tpfBatchPager"><button id="tpfBatchPrev" class="secondary" type="button" ${state.page <= 1 ? "disabled" : ""}>Anterior</button><span>Página ${state.page} de ${pages}</span><button id="tpfBatchNext" class="secondary" type="button" ${state.page >= pages ? "disabled" : ""}>Siguiente</button></div>`;
    $("tpfBatchSearch").oninput = (event) => {
      state.query = event.target.value;
      state.page = 1;
      render({ focusSearch: true });
    };
    $("tpfBatchFilter").onchange = (event) => {
      state.filter = event.target.value;
      state.page = 1;
      render();
    };
    body.querySelectorAll("[data-green-filter]").forEach((button) => {
      button.onclick = () => {
        state.filter = button.dataset.greenFilter;
        state.page = 1;
        render();
      };
    });
    const toggleGroupSelection = () => {
      setSelected(selectable, !allSelectableSelected);
      render();
    };
    $("tpfBatchSelectAll").onclick = toggleGroupSelection;
    $("tpfBatchSelectPage").onchange = (event) => {
      setSelected(selectable, event.target.checked);
      render();
    };
    $("tpfBatchClearSelected")?.addEventListener("click", () => {
      state.selected.clear();
      render();
    });
    const selectionBar = body.querySelector(".tpfBatchSelection");
    if (selectionBar) {
      const approve = document.createElement("button");
      approve.id = "tpfBatchApproveSelected";
      approve.className = "primary";
      approve.type = "button";
      approve.disabled = !selectedTotal || state.applying;
      approve.textContent = selectedTotal
        ? "Dar por OK y sincronizar los " + selectedTotal + " seleccionados"
        : "Dar por OK y sincronizar seleccionados";
      approve.onclick = approveSelected;
      selectionBar.insertBefore(approve, selectionBar.querySelector("small"));
    }
    body.querySelectorAll(".tpfBatchSelectRow").forEach((input) => {
      input.onchange = () => {
        const row = rows[Number(input.dataset.rowIndex)];
        if (!row) return;
        setSelected([row], input.checked);
        render();
      };
    });
    $("tpfBatchPrev").onclick = () => {
      state.page = Math.max(1, state.page - 1);
      render();
    };
    $("tpfBatchNext").onclick = () => {
      state.page++;
      render();
    };
    body
      .querySelectorAll(".tpfBatchCheck")
      .forEach(
        (button) =>
          (button.onclick = () =>
            decisionDialog(rows[Number(button.dataset.rowIndex)])),
      );
    body
      .querySelectorAll(".tpfBatchKeep")
      .forEach((button) => {
        button.onclick = () => {
          const item = rows[Number(button.dataset.rowIndex)];
          // Keeping a contact only cancels a previous staged action.
          markReviewed(item.row);
        };
      });
    body.querySelectorAll(".tpfBatchTrash").forEach((button) => {
      button.onclick = () => {
        const item = rows[Number(button.dataset.rowIndex)];
        setPrepared({
          kind: "trash",
          row: item.row,
          person: item.person,
          chat: item.chat,
          label: item.c.name,
        });
      };
    });
    body
      .querySelectorAll(".tpfBatchUndo")
      .forEach((button) => {
        button.onclick = () => {
          const item = rows[Number(button.dataset.rowIndex)];
          delete state.prepared[safe(item.row.id)];
          delete state.reviewed[safe(item.row.id)];
          render();
        };
      });
    note.textContent = preparedCount()
      ? "Revisa el resumen y pulsa “Aplicar cambios preparados” una sola vez."
      : "Aún no se ha guardado ni borrado nada.";
    if (options.focusSearch) {
      const input = $("tpfBatchSearch");
      input?.focus();
      const at = input?.value?.length || 0;
      input?.setSelectionRange?.(at, at);
    }
  }
  async function run() {
    if (state.running) return;
    state.running = true;
    state.error = "";
    state.results = [];
    state.progress = "Preparando…";
    render();
    try {
      state.results = await collect((message) => {
        state.progress = message;
        render();
      });
      state.account = account();
      state.analysedAt = "Comparado " + new Date().toLocaleString("es-ES");
      state.filter = "all";
      state.query = "";
      state.page = 1;
    } catch (error) {
      state.error = error?.message || "No se pudo completar la comparación.";
    } finally {
      state.running = false;
      render();
    }
  }
  function open() {
    ensureModal();
    state.error = "";
    $("tpfBatchVerifyBack").classList.remove("hidden");
    render();
  }
  function install() {
    window.TPFContactBatchVerification = { open, analyzeRows, summary };
    window.addEventListener("tpf:contacts-batch-open", open);
    // Una corrección abierta desde este lote ya terminó de guardarse:
    // no debe quedar como borrador ni obligar a pulsar Aplicar por segunda vez.
    window.addEventListener("tpf:contact-updated", (event) => {
      if (event.detail?.resolution !== "google-duplicate") return;
      const id = safe(event.detail?.id);
      if (!id || !state.prepared[id]) return;
      delete state.prepared[id];
      delete state.reviewed[id];
      if (!$("tpfBatchVerifyBack")?.classList.contains("hidden"))
        setTimeout(() => run(), 0);
      else render();
    });
  }
  M.register("contact-batch-verification", { install });
})();
