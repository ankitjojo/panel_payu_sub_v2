(() => {
  const D = window.__DEFAULTS__ || {};
  const C = window.__CONFIG__ || {};
  const $ = id => document.getElementById(id);

  const FIELDS = ["iProviderSkuId", "sPaymentMethod", "sVpa", "sUserId", "sUsername", "sEmail", "sPhoneCode", "sPhoneNumber", "sState", "sCity", "sCountryCode2", "sCurrencyCode", "userIp", "userAgent"];
  const STORE_KEY = "payu_sub_v2_form";
  const state = { polling: false, timer: null, tick: null, deadline: 0, intervalSec: 3, attempts: 0 };

  // ── helpers ────────────────────────────────────────────────────────────
  const pretty = o => JSON.stringify(o, null, 2);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); } catch { return {}; } },
    set(v) { try { localStorage.setItem(STORE_KEY, JSON.stringify(v)); } catch { /* private mode: just don't persist */ } }
  };
  const alertBox = (el, type, msg) => { el.innerHTML = msg ? `<div class="alert alert-${type} py-2 mb-0">${esc(msg)}</div>` : ""; };

  async function api(path, payload) {
    try {
      const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      return await r.json();
    } catch (e) {
      return { ok: false, error: `Request to this server failed: ${e.message}` };
    }
  }

  function setBadge(status) {
    const cls = { SUCCESS: "success", FAILED: "danger", PENDING: "warning", INITIATED: "warning", CANCELLED: "secondary" }[status] || "secondary";
    const b = $("statusBadge");
    b.className = `badge text-bg-${cls} fs-6`;
    b.textContent = status || "NOT VERIFIED";
  }

  // ── form: defaults, persistence, conditional fields ───────────────────
  const defaults = { iProviderSkuId: D.providerSkuId, sUserId: D.userId, sUsername: D.username, sEmail: D.email, sPhoneNumber: D.phone, sState: D.state, sCity: D.city, userIp: D.userIp, userAgent: D.userAgent };
  const saved = store.get();
  FIELDS.forEach(f => {
    const v = saved[f] ?? defaults[f];
    if (v !== undefined && v !== "" && $(f)) $(f).value = v;
  });
  const syncVpa = () => $("vpaGroup").classList.toggle("d-none", $("sPaymentMethod").value !== "UPI_VPA");
  syncVpa();
  $("sPaymentMethod").addEventListener("change", syncVpa);
  $("initiateForm").addEventListener("input", () => store.set(Object.fromEntries(FIELDS.map(f => [f, $(f).value]))));

  // ── 2. pay panel ──────────────────────────────────────────────────────
  function renderPay(oPayu) {
    const body = $("payBody");
    const mandate = oPayu.bIsMandate ? '<span class="badge text-bg-info">UPI Autopay mandate</span>' : '<span class="badge text-bg-secondary">one-time</span>';

    if (oPayu.ePaymentMethod === "UPI_QR") {
      body.innerHTML = `
        <div class="d-flex flex-wrap gap-4 align-items-start">
          <canvas id="qrCanvas"></canvas>
          <div class="vstack gap-2" style="min-width:220px;flex:1">
            <div>${mandate} <span class="badge text-bg-dark">UPI_QR</span></div>
            <div class="small">txnid: <code>${esc(oPayu.sTxnId)}</code></div>
            <div class="small">Scan with any UPI app${oPayu.bIsMandate ? " and approve the AutoPay mandate" : ""}. Expires in <strong id="countdown">${oPayu.nExpirySec}</strong>s.</div>
            <div class="mono-wrap border rounded p-2 bg-body" id="qrString">${esc(oPayu.sQrString)}</div>
            <div class="d-flex gap-2">
              <button class="btn btn-sm btn-outline-secondary" type="button" data-copy="${esc(oPayu.sQrString)}">Copy link</button>
              <a class="btn btn-sm btn-outline-primary" href="${esc(oPayu.sQrString)}">Open in a UPI app (phone)</a>
            </div>
          </div>
        </div>`;
      if (window.QRCode) window.QRCode.toCanvas($("qrCanvas"), oPayu.sQrString, { width: 260, margin: 1 }, err => err && console.error(err));
      else $("qrCanvas").replaceWith(Object.assign(document.createElement("div"), { className: "alert alert-warning", textContent: "QR library failed to load: copy the link instead." }));
      return;
    }

    if (oPayu.ePaymentMethod === "UPI_VPA") {
      const fields = payuCollectFields(oPayu.oSdkParams);
      body.innerHTML = `
        <div class="mb-2">${mandate} <span class="badge text-bg-dark">UPI_VPA</span></div>
        <p class="small">PayU sends a collect request to <code>${esc(fields.vpa)}</code>${oPayu.bIsMandate ? " to approve the AutoPay mandate" : ""}.
          Approve it in that UPI app; PayU then brings you back here and the page confirms with the backend.</p>
        <form method="post" action="${esc(C.payuPaymentUrl)}" class="vstack gap-2">
          ${Object.entries(fields).map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join("")}
          <div><button class="btn btn-primary" type="submit">Pay ₹${esc(fields.amount)} via PayU</button>
            <span class="small text-muted ms-2">posts to <code>${esc(C.payuPaymentUrl)}</code></span></div>
        </form>
        <details class="mt-2"><summary class="small text-muted">Fields posted to PayU (backend oSdkParams + web additions)</summary>
          <pre class="raw mt-2 mb-0">${esc(pretty(fields))}</pre></details>`;
      return;
    }

    body.innerHTML = `
      <div class="mb-2">${mandate} <span class="badge text-bg-dark">${esc(oPayu.ePaymentMethod)}</span></div>
      <p class="small text-muted">These are the <code>oSdkParams</code> for the Android PayU UPI SDK. They carry the server-computed <code>hash</code> and no salt.
      PayU doesn't support UPI intent through a browser form post, so use <strong>UPI_QR</strong> or <strong>UPI_VPA</strong> for an end-to-end payment here; for this method you can still check the response shape and call verify.</p>
      <pre class="raw mb-0">${esc(pretty(oPayu.oSdkParams))}</pre>`;
  }

  /**
   * What the Android SDK does for UPI_COLLECT, done as a browser form post: the backend's params unchanged
   * (hash, udfs, si_details must stay byte-identical) plus fields that are NOT part of the hash:
   * pg/bankcode select UPI collect, and surl/furl point back at this app instead of the SDK's cbjs.payu.in pages.
   */
  function payuCollectFields(sdkParams) {
    const back = `${location.origin}/payu/return`;
    return { ...sdkParams, pg: "UPI", bankcode: "UPI", surl: back, furl: back };
  }

  // ── 1. initiate ───────────────────────────────────────────────────────
  $("initiateForm").addEventListener("submit", async e => {
    e.preventDefault();
    stopPolling();
    setBadge("");
    $("verifyLog").textContent = "";
    alertBox($("verifyAlert"), "", "");
    const btn = $("initiateBtn");
    btn.disabled = true;
    btn.textContent = "Initiating…";

    const payload = Object.fromEntries(FIELDS.map(f => [f, $(f).value]));
    const res = await api("/api/initiate", payload);
    btn.disabled = false;
    btn.textContent = "Initiate payment";

    $("rawInitReq").textContent = pretty(res.sent ?? payload);
    $("rawInitRes").textContent = pretty(res);

    const init = res.data?.initiateData;
    if (!res.ok || res.status !== 200 || !init) {
      alertBox($("initiateAlert"), "danger", `${res.status ? res.status + ": " : ""}${res.message || res.error || "Initiate failed"}`);
      return;
    }
    alertBox($("initiateAlert"), "success", `${res.message} (sToken ${init.sToken})`);
    $("vToken").value = init.sToken;
    $("vTxn").value = init.sProviderToken || "";
    renderPay(init.oPayu);
    if (init.oPayu.ePaymentMethod === "UPI_QR") startPolling(init.oPayu.nPollIntervalSec || 3, init.oPayu.nExpirySec || 300);
  });

  // ── 3. verify ─────────────────────────────────────────────────────────
  async function verifyOnce() {
    const payload = { sToken: $("vToken").value, sProviderToken: $("vTxn").value, sUserId: $("sUserId").value };
    const res = await api("/api/verify", payload);
    $("rawVerReq").textContent = pretty(res.sent ?? payload);
    $("rawVerRes").textContent = pretty(res);

    const status = res.data?.sStatus;
    if (!res.ok || res.status !== 200 || !status) {
      alertBox($("verifyAlert"), "danger", `${res.status ? res.status + ": " : ""}${res.message || res.error || "Verify failed"}`);
      return null;
    }
    alertBox($("verifyAlert"), "", "");
    setBadge(status);
    const log = $("verifyLog");
    log.textContent += `${new Date().toLocaleTimeString()}  ${status}  ${res.message || ""}\n`;
    log.scrollTop = log.scrollHeight;
    return status;
  }

  $("verifyBtn").addEventListener("click", async () => {
    const b = $("verifyBtn");
    b.disabled = true;
    await verifyOnce();
    b.disabled = false;
  });

  // ── polling (the same loop the Android app runs) ──────────────────────
  function stopPolling(note) {
    state.polling = false;
    clearTimeout(state.timer);
    clearInterval(state.tick);
    $("pollBtn").textContent = "Start auto-poll";
    $("pollBtn").className = "btn btn-outline-secondary";
    if (note !== undefined) $("pollInfo").textContent = note;
  }

  function startPolling(intervalSec, durationSec) {
    stopPolling();
    state.polling = true;
    state.intervalSec = intervalSec;
    state.attempts = 0;
    state.deadline = Date.now() + durationSec * 1000;
    $("pollBtn").textContent = "Stop auto-poll";
    $("pollBtn").className = "btn btn-outline-danger";

    state.tick = setInterval(() => {
      const left = Math.max(0, Math.round((state.deadline - Date.now()) / 1000));
      $("pollInfo").textContent = `polling every ${intervalSec}s · ${state.attempts} checks · ${left}s left`;
      const cd = $("countdown");
      if (cd) cd.textContent = left;
    }, 500);

    const loop = async () => {
      if (!state.polling) return;
      const status = await verifyOnce();
      state.attempts++;
      if (status === "SUCCESS") return stopPolling("Payment confirmed: entitlement granted.");
      if (status === "FAILED") return stopPolling("Payment failed.");
      if (status === null) return stopPolling("Stopped: verify returned an error (see above).");
      if (Date.now() >= state.deadline) return stopPolling("Window ended while still PENDING (a late payment can still succeed: verify again).");
      state.timer = setTimeout(loop, state.intervalSec * 1000);
    };
    loop();
  }

  $("pollBtn").addEventListener("click", () => (state.polling ? stopPolling("Stopped.") : startPolling(3, $("payBody").querySelector("#qrCanvas") ? 300 : 120)));

  // ── back from PayU (UPI_VPA on the web): confirm with the backend ─────
  // sUserId comes from the remembered form; sToken (= udf1) and txnid come from PayU's redirect
  const q = new URLSearchParams(location.search);
  if (q.get("resume") === "1" && q.get("sToken")) {
    $("vToken").value = q.get("sToken");
    $("vTxn").value = q.get("txnid") || "";
    history.replaceState(null, "", location.pathname);
    if (!$("sUserId").value) {
      alertBox($("verifyAlert"), "warning", "Back from PayU: enter the same User id you initiated with, then press Verify now.");
    } else {
      alertBox($("initiateAlert"), "info", `Back from PayU (PayU said: ${q.get("payuStatus") || "unknown"}). Confirming with the backend…`);
      startPolling(3, 120);
    }
  }

  // copy buttons rendered into the pay panel
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-copy]");
    if (!t) return;
    navigator.clipboard?.writeText(t.dataset.copy).then(() => {
      const old = t.textContent;
      t.textContent = "Copied";
      setTimeout(() => (t.textContent = old), 1200);
    });
  });
})();
