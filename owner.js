const $ = id => document.getElementById(id);
const SESSION_KEY = "dealbridge-owner-session";
let events = [];
let studioApi = null;
let studioMode = "view";

function sessionToken() {
  return sessionStorage.getItem(SESSION_KEY) || "";
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body) headers["Content-Type"] = "application/json";
  if (sessionToken()) headers.Authorization = "Bearer " + sessionToken();
  const response = await fetch(path, { ...options, headers, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && path !== "/api/owner/login") signOut("Your owner session expired. Sign in again.");
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

function signOut(message = "") {
  sessionStorage.removeItem(SESSION_KEY);
  $("dashboard").hidden = true;
  $("login-panel").hidden = false;
  $("logout").hidden = true;
  $("owner-code").value = "";
  $("login-status").textContent = message;
}

$("login-form").addEventListener("submit", async event => {
  event.preventDefault();
  const ownerCode = $("owner-code").value;
  $("login-button").disabled = true;
  $("login-status").textContent = "Verifying owner access…";
  try {
    const result = await api("/api/owner/login", {
      method: "POST",
      body: JSON.stringify({ ownerCode })
    });
    sessionStorage.setItem(SESSION_KEY, result.sessionToken);
    $("owner-code").value = "";
    await unlockDashboard();
  } catch (error) {
    $("login-status").textContent = error.message;
  } finally {
    $("login-button").disabled = false;
  }
});

$("logout").addEventListener("click", () => signOut("You have signed out."));
$("refresh").addEventListener("click", () => loadDashboard());
$("toggle-mode").addEventListener("click", () => {
  if (!studioApi) return;
  studioMode = studioMode === "view" ? "edit" : "view";
  studioApi.setProperty("mode", studioMode);
  $("toggle-mode").textContent = studioMode === "edit" ? "Lock dashboard layout" : "Enable dashboard editing";
});
$("event-search").addEventListener("input", renderEventTable);
$("source-filter").addEventListener("change", renderEventTable);

async function unlockDashboard() {
  $("login-panel").hidden = true;
  $("dashboard").hidden = false;
  $("logout").hidden = false;
  await loadDashboard();
}

async function loadDashboard() {
  $("refresh").disabled = true;
  $("refresh").textContent = "Refreshing…";
  try {
    const [data, config] = await Promise.all([
      api("/api/owner/metrics"),
      api("/api/owner/config")
    ]);
    events = Array.isArray(data.events) ? data.events : [];
    renderMetrics();
    renderEventTable();
    renderStudio(config);
    $("last-updated").textContent = "Updated " + new Date(data.generatedAt).toLocaleString();
    if (data.truncatedPossible) $("event-count").textContent += " · Showing latest 500 stored records; older records may be omitted.";
  } catch (error) {
    $("login-status").textContent = error.message;
    if (!sessionToken()) signOut(error.message);
  } finally {
    $("refresh").disabled = false;
    $("refresh").textContent = "Refresh data";
  }
}

function renderMetrics() {
  const registered = events.filter(item => item.source === "registered_webhook");
  const completed = registered.filter(item => item.eventType === "PAYMENT.CAPTURE.COMPLETED" || item.eventType === "PAYMENT.SALE.COMPLETED");
  const refunds = registered.filter(item => item.eventType === "PAYMENT.CAPTURE.REFUNDED" || item.eventType === "PAYMENT.SALE.REFUNDED");
  const simulator = events.filter(item => item.source === "sandbox_simulator");
  const usdTotal = completed.reduce((sum, item) => sum + (item.currency === "USD" && Number.isFinite(item.amount) ? item.amount : 0), 0);
  $("metric-completed").textContent = completed.length.toLocaleString();
  $("metric-volume").textContent = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(usdTotal);
  $("metric-refunds").textContent = refunds.length.toLocaleString();
  $("metric-simulated").textContent = simulator.length.toLocaleString();
}

function renderEventTable() {
  const query = $("event-search").value.trim().toLowerCase();
  const source = $("source-filter").value;
  const filtered = events.filter(item => {
    const matchesSource = source === "all" || item.source === source;
    const matchesQuery = !query || [item.eventType, item.resourceId, item.eventId, item.status].join(" ").toLowerCase().includes(query);
    return matchesSource && matchesQuery;
  });
  const tbody = $("event-rows");
  tbody.replaceChildren();
  if (!filtered.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.textContent = events.length ? "No events match this filter." : "No stored PayPal events yet.";
    row.appendChild(cell);
    tbody.appendChild(row);
  }
  for (const item of filtered.slice(0, 100)) {
    const row = document.createElement("tr");
    const values = [
      item.createdAt ? new Date(item.createdAt).toLocaleString() : "Time unavailable",
      item.eventType || "Unknown event",
      item.resourceId || "—",
      item.status || "—",
      item.amount !== null && item.currency ? new Intl.NumberFormat("en-US", { style: "currency", currency: item.currency }).format(item.amount) : "—"
    ];
    for (const value of values) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    }
    const sourceCell = document.createElement("td");
    const pill = document.createElement("span");
    pill.className = "source-pill" + (item.source === "registered_webhook" ? " real" : item.source === "sandbox_simulator" ? " sim" : "");
    pill.textContent = item.source === "registered_webhook" ? "PayPal verified" : item.source === "sandbox_simulator" ? "Sandbox simulator" : "Other";
    sourceCell.appendChild(pill);
    row.appendChild(sourceCell);
    tbody.appendChild(row);
  }
  $("event-count").textContent = "Showing " + Math.min(filtered.length, 100) + " of " + filtered.length + " matching events · " + events.length + " loaded";
}

function renderStudio(config) {
  const warning = $("studio-warning");
  if (!window.agStudio || typeof window.agStudio.createStudio !== "function") {
    warning.hidden = false;
    warning.textContent = "AG Studio could not be loaded from its CDN. Check the network connection and refresh.";
    return;
  }
  if (config.licenseKey && window.agStudio.AgStudioLicenseManager?.setLicenseKey) {
    window.agStudio.AgStudioLicenseManager.setLicenseKey(config.licenseKey);
  } else if (!config.agStudioConfigured) {
    warning.hidden = false;
    warning.textContent = "AG Studio trial key is not configured yet. Add AG_STUDIO_LICENSE_KEY in Vercel to remove the evaluation watermark in production.";
  } else {
    warning.hidden = true;
  }

  const studioData = events.map(item => ({
    eventId: item.eventId,
    eventType: item.eventType,
    resourceId: item.resourceId,
    paymentStatus: item.status,
    amount: item.amount,
    currency: item.currency,
    createdAt: item.createdAt,
    source: item.source
  }));
  const host = $("ag-studio");
  host.replaceChildren();
  studioMode = "view";
  $("toggle-mode").textContent = "Enable dashboard editing";
  studioApi = window.agStudio.createStudio(host, {
    data: { sources: [{ id: "paypal_events", data: studioData }] },
    mode: studioMode
  });
}

async function boot() {
  if (!sessionToken()) return;
  try {
    await unlockDashboard();
  } catch {
    signOut("Your owner session expired. Sign in again.");
  }
}
boot();
