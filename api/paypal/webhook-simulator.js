import crypto from "node:crypto";

export const config = {
  api: { bodyParser: false }
};

const ALLOWED_EVENTS = new Set([
  "PAYMENT.CAPTURE.COMPLETED",
  "PAYMENT.CAPTURE.DENIED",
  "PAYMENT.CAPTURE.REFUNDED",
  "PAYMENT.SALE.COMPLETED"
]);

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

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }

  return ((crc ^ 0xffffffff) >>> 0).toString(10);
}

async function verifySimulatorSignature(rawBody, headers) {
  const transmissionId = headers["paypal-transmission-id"];
  const transmissionTime = headers["paypal-transmission-time"];
  const transmissionSig = headers["paypal-transmission-sig"];
  const certUrl = headers["paypal-cert-url"];
  const algorithm = headers["paypal-auth-algo"];

  if (
    typeof transmissionId !== "string" ||
    typeof transmissionTime !== "string" ||
    typeof transmissionSig !== "string" ||
    typeof certUrl !== "string" ||
    algorithm !== "SHA256withRSA"
  ) {
    return false;
  }

  let cert;
  try {
    cert = new URL(certUrl);
  } catch {
    return false;
  }

  const allowedHosts = new Set([
    "api-m.sandbox.paypal.com",
    "api.sandbox.paypal.com"
  ]);

  if (
    cert.protocol !== "https:" ||
    !allowedHosts.has(cert.hostname) ||
    !cert.pathname.startsWith("/v1/notifications/certs/") ||
    cert.username ||
    cert.password
  ) {
    return false;
  }

  const certResponse = await fetch(cert.toString(), {
    headers: { Accept: "application/x-pem-file, application/octet-stream" },
    signal: AbortSignal.timeout(10000)
  });

  if (!certResponse.ok) {
    throw new Error("Could not retrieve PayPal Sandbox certificate.");
  }

  const certificate = await certResponse.text();
  if (
    certificate.length > 32768 ||
    !certificate.includes("BEGIN CERTIFICATE")
  ) {
    throw new Error("PayPal returned an invalid certificate.");
  }

  const signedMessage = [
    transmissionId,
    transmissionTime,
    "WEBHOOK_ID",
    crc32(rawBody)
  ].join("|");

  return crypto.verify(
    "RSA-SHA256",
    Buffer.from(signedMessage, "utf8"),
    certificate,
    Buffer.from(transmissionSig, "base64")
  );
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

async function persistEvent(event) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase server credentials are not configured.");
  }

  const resource = normalizeResource(event.resource || {});
  const safePayload = {
    verification_mode: "paypal_simulator_self_verified",
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
      "[paypal-simulator] Supabase persistence failed",
      response.status,
      detail.slice(0, 300)
    );
    throw new Error("Could not persist the verified simulator event.");
  }

  return resource;
}

export default async function handler(req, res) {
  const id = requestId(req);

  if (req.method !== "POST") {
    console.warn("[paypal-simulator] rejected non-POST request", {
      requestId: id,
      method: req.method
    });
    return res.status(405).json({ error: "Method not allowed" });
  }

  const paypalEnv = String(process.env.PAYPAL_ENV || "").trim().toLowerCase();
  if (paypalEnv !== "sandbox") {
    console.error("[paypal-simulator] blocked because PAYPAL_ENV is not sandbox", {
      requestId: id
    });
    return res.status(403).json({
      error: "Simulator endpoint is restricted to PayPal Sandbox."
    });
  }

  console.info("[paypal-simulator] delivery received", {
    requestId: id,
    hasTransmissionId: Boolean(req.headers?.["paypal-transmission-id"]),
    hasTransmissionTime: Boolean(req.headers?.["paypal-transmission-time"]),
    hasSignature: Boolean(req.headers?.["paypal-transmission-sig"]),
    hasCertificateUrl: Boolean(req.headers?.["paypal-cert-url"]),
    algorithm: req.headers?.["paypal-auth-algo"] || null
  });

  try {
    const rawBody = await readRawBody(req);

    if (!rawBody.length || rawBody.length > 1024 * 1024) {
      console.warn("[paypal-simulator] rejected empty or oversized body", {
        requestId: id,
        bodyLength: rawBody.length
      });
      return res.status(400).json({ error: "Invalid event body." });
    }

    const valid = await verifySimulatorSignature(rawBody, req.headers || {});
    if (!valid) {
      console.warn("[paypal-simulator] signature verification rejected", {
        requestId: id
      });
      return res.status(400).json({
        error: "Simulator signature verification failed."
      });
    }

    let event;
    try {
      event = JSON.parse(rawBody.toString("utf8"));
    } catch {
      console.warn("[paypal-simulator] rejected invalid JSON", { requestId: id });
      return res.status(400).json({ error: "Invalid JSON event." });
    }

    if (
      !event ||
      typeof event.id !== "string" ||
      !event.id ||
      !ALLOWED_EVENTS.has(event.event_type)
    ) {
      console.warn("[paypal-simulator] rejected unsupported event", {
        requestId: id,
        eventType:
          event && typeof event.event_type === "string"
            ? event.event_type
            : "missing"
      });
      return res.status(400).json({
        error: "Unsupported or incomplete simulator event."
      });
    }

    const resource = await persistEvent(event);

    console.info("[paypal-simulator] event verified and persisted", {
      requestId: id,
      eventId: event.id,
      eventType: event.event_type,
      resourceId: resource.id,
      paymentStatus: resource.status
    });

    return res.status(200).json({
      received: true,
      verified: true,
      persisted: true,
      mode: "sandbox-simulator"
    });
  } catch (error) {
    console.error("[paypal-simulator] processing failed", {
      requestId: id,
      error: error instanceof Error ? error.message : "Unknown error"
    });
    return res.status(500).json({
      error: "Simulator event processing failed."
    });
  }
}
