import crypto from "node:crypto";

export const config = {
  api: { bodyParser: false }
};

const paypalApiBase = () =>
  String(process.env.PAYPAL_ENV || "sandbox").trim().toLowerCase() === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

function requestId(req) {
  const value = req.headers?.["x-vercel-id"] || req.headers?.["x-request-id"];
  return typeof value === "string" ? value.slice(0, 120) : "unavailable";
}

async function readRawBody(req) {
  // Do not access req.body: Vercel's Node helper lazily parses JSON there,
  // consuming the stream and changing the bytes needed for PayPal CRC32.
  if (typeof req[Symbol.asyncIterator] !== "function") {
    const raw = req.rawBody;
    if (Buffer.isBuffer(raw)) return raw;
    if (typeof raw === "string") return Buffer.from(raw);
    throw new Error("Request stream is unavailable for raw-body verification.");
  }

  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > 1024 * 1024) {
      throw new Error("Webhook request body exceeds the 1 MB limit.");
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks, total);
}

async function getPayPalAccessToken(baseUrl) {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;

  if (!id || !secret) {
    throw new Error("PayPal server credentials are not configured.");
  }

  const response = await fetch(baseUrl + "/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(id + ":" + secret).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(10000)
  });

  const data = await response.json();
  if (!response.ok || typeof data.access_token !== "string") {
    throw new Error("PayPal authentication failed.");
  }

  return data.access_token;
}

function normalizeResource(resource = {}) {
  const amount = resource.amount || {};
  const amountValue = amount.value ?? amount.total ?? null;
  const currencyCode = amount.currency_code ?? amount.currency ?? null;
  const status = resource.status ?? resource.state ?? null;

  return {
    id: resource.id ? String(resource.id) : null,
    status: status == null ? null : String(status),
    amount:
      amountValue == null
        ? null
        : {
            value: String(amountValue),
            currency_code:
              currencyCode == null ? null : String(currencyCode).toUpperCase()
          },
    custom_id: resource.custom_id || null,
    invoice_id: resource.invoice_id || null
  };
}

async function persistVerifiedEvent(event) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase server credentials are not configured.");
  }

  const resource = normalizeResource(event.resource || {});
  const safePayload = {
    verification_mode: "paypal_registered_webhook",
    id: event.id,
    event_type: event.event_type,
    create_time: event.create_time || null,
    resource_type: event.resource_type || null,
    resource
  };

  const baseUrl = url.endsWith("/") ? url.slice(0, -1) : url;
  const response = await fetch(
    baseUrl + "/rest/v1/paypal_webhook_events?on_conflict=event_id",
    {
      method: "POST",
      headers: {
        apikey: key,
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates,return=minimal"
      },
      body: JSON.stringify({
        event_id: event.id,
        event_type: event.event_type,
        resource_id: resource.id,
        payment_status: resource.status,
        payload: safePayload
      }),
      signal: AbortSignal.timeout(10000)
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    console.error(
      "[paypal-webhook] Supabase persistence failed",
      response.status,
      detail.slice(0, 300)
    );
    throw new Error("Could not persist the verified PayPal event.");
  }

  return resource;
}

export default async function handler(req, res) {
  const id = requestId(req);

  if (req.method !== "POST") {
    console.warn("[paypal-webhook] rejected non-POST request", {
      requestId: id,
      method: req.method
    });
    return res.status(405).json({ error: "Method not allowed" });
  }

  console.info("[paypal-webhook] delivery received", {
    requestId: id,
    hasWebhookId: Boolean(process.env.PAYPAL_WEBHOOK_ID),
    hasPayPalClientId: Boolean(process.env.PAYPAL_CLIENT_ID),
    hasTransmissionId: Boolean(req.headers?.["paypal-transmission-id"]),
    hasTransmissionTime: Boolean(req.headers?.["paypal-transmission-time"]),
    hasSignature: Boolean(req.headers?.["paypal-transmission-sig"]),
    hasCertificateUrl: Boolean(req.headers?.["paypal-cert-url"]),
    algorithm: req.headers?.["paypal-auth-algo"] || null
  });

  try {
    const rawBody = await readRawBody(req);
    if (!rawBody.length || rawBody.length > 1024 * 1024) {
      console.warn("[paypal-webhook] rejected empty or oversized body", {
        requestId: id,
        bodyLength: rawBody.length
      });
      return res.status(400).json({ error: "Invalid webhook body." });
    }

    let event;
    try {
      event = JSON.parse(rawBody.toString("utf8"));
    } catch {
      console.warn("[paypal-webhook] rejected invalid JSON", { requestId: id });
      return res.status(400).json({ error: "Invalid webhook event." });
    }

    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookId) {
      console.error("[paypal-webhook] missing registered webhook ID", {
        requestId: id
      });
      return res.status(503).json({
        error: "PayPal webhook verification is not configured."
      });
    }

    const headers = req.headers || {};
    const authAlgo = headers["paypal-auth-algo"];
    const certUrl = headers["paypal-cert-url"];
    const transmissionId = headers["paypal-transmission-id"];
    const transmissionSig = headers["paypal-transmission-sig"];
    const transmissionTime = headers["paypal-transmission-time"];

    if (
      typeof authAlgo !== "string" ||
      typeof certUrl !== "string" ||
      typeof transmissionId !== "string" ||
      typeof transmissionSig !== "string" ||
      typeof transmissionTime !== "string"
    ) {
      console.warn("[paypal-webhook] required PayPal signature headers missing", {
        requestId: id
      });
      return res.status(400).json({
        error: "Required PayPal signature headers are missing."
      });
    }

    const baseUrl = paypalApiBase();
    const accessToken = await getPayPalAccessToken(baseUrl);

    // Keep the original webhook JSON bytes intact inside webhook_event.
    // Re-stringifying a parsed object can alter formatting and break verification.
    const rawEvent = rawBody.toString("utf8");
    const verificationBody =
      "{\"auth_algo\":" + JSON.stringify(authAlgo) +
      ",\"cert_url\":" + JSON.stringify(certUrl) +
      ",\"transmission_id\":" + JSON.stringify(transmissionId) +
      ",\"transmission_sig\":" + JSON.stringify(transmissionSig) +
      ",\"transmission_time\":" + JSON.stringify(transmissionTime) +
      ",\"webhook_id\":" + JSON.stringify(webhookId) +
      ",\"webhook_event\":" + rawEvent + "}";

    const verification = await fetch(
      baseUrl + "/v1/notifications/verify-webhook-signature",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + accessToken,
          "Content-Type": "application/json"
        },
        body: verificationBody,
        signal: AbortSignal.timeout(10000)
      }
    );

    const result = await verification.json();
    if (!verification.ok || result.verification_status !== "SUCCESS") {
      console.warn("[paypal-webhook] PayPal rejected webhook signature", {
        requestId: id,
        eventId: typeof event?.id === "string" ? event.id : "missing",
        eventType: typeof event?.event_type === "string" ? event.event_type : "missing",
        httpStatus: verification.status,
        verificationStatus: result.verification_status || "unknown",
        paypalDebugId: typeof result.debug_id === "string" ? result.debug_id : null,
        paypalDetails: Array.isArray(result.details)
          ? result.details.slice(0, 3).map((item) => ({
              issue: item.issue || null,
              description: typeof item.description === "string"
                ? item.description.slice(0, 160)
                : null
            }))
          : []
      });
      return res.status(400).json({
        error: "Webhook signature verification failed."
      });
    }

    if (
      !event ||
      typeof event.id !== "string" ||
      !event.id ||
      typeof event.event_type !== "string" ||
      !event.event_type
    ) {
      console.warn("[paypal-webhook] verified event missing ID or type", {
        requestId: id
      });
      return res.status(400).json({
        error: "Verified webhook is missing its event ID or type."
      });
    }

    const resource = await persistVerifiedEvent(event);

    console.info("[paypal-webhook] event verified and persisted", {
      requestId: id,
      eventId: event.id,
      eventType: event.event_type,
      resourceId: resource.id,
      paymentStatus: resource.status
    });

    return res.status(200).json({ received: true, persisted: true });
  } catch (error) {
    console.error("[paypal-webhook] processing failed", {
      requestId: id,
      error: error instanceof Error ? error.message : "Unknown error"
    });
    return res.status(500).json({
      error: "Webhook processing failed. PayPal may retry this event."
    });
  }
}
