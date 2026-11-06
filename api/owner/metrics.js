import { verifyOwnerSession } from "../../lib/owner-auth.js";

function mapEvent(row) {
  const payload = row?.payload && typeof row.payload === "object" ? row.payload : {};
  const resource = payload.resource && typeof payload.resource === "object" ? payload.resource : {};
  const amount = resource.amount && typeof resource.amount === "object" ? resource.amount : {};
  const amountValue = Number(amount.value);
  const verificationMode = String(payload.verification_mode || "unknown");

  return {
    eventId: String(row.event_id || ""),
    eventType: String(row.event_type || ""),
    resourceId: row.resource_id ? String(row.resource_id) : "",
    status: row.payment_status ? String(row.payment_status) : "",
    amount: Number.isFinite(amountValue) && amountValue >= 0 ? amountValue : null,
    currency: String(amount.currency_code || "").toUpperCase(),
    createdAt: payload.create_time ? String(payload.create_time) : "",
    source: verificationMode === "paypal_registered_webhook"
      ? "registered_webhook"
      : verificationMode === "paypal_simulator_self_verified"
        ? "sandbox_simulator"
        : "other"
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!verifyOwnerSession(req)) return res.status(401).json({ error: "Owner session expired. Sign in again." });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(503).json({ error: "Supabase storage is not configured." });

  try {
    const baseUrl = url.endsWith("/") ? url.slice(0, -1) : url;
    const query = "select=event_id,event_type,resource_id,payment_status,payload&limit=500";
    const response = await fetch(baseUrl + "/rest/v1/paypal_webhook_events?" + query, {
      headers: {
        apikey: key,
        Authorization: "Bearer " + key,
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) {
      console.error("[owner-dashboard] Supabase query failed:", response.status);
      return res.status(502).json({ error: "Could not load stored PayPal events." });
    }

    const rows = await response.json();
    const events = Array.isArray(rows) ? rows.map(mapEvent) : [];
    events.sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
    return res.status(200).json({
      events,
      limit: 500,
      truncatedPossible: events.length === 500,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("[owner-dashboard] request failed:", error instanceof Error ? error.message : "unknown");
    return res.status(502).json({ error: "Dashboard data is temporarily unavailable." });
  }
}
