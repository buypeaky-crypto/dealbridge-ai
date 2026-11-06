import crypto from "node:crypto";

export const config = {
  api: { bodyParser: false }
};

const ALLOWED_EVENTS = new Set([
  "PAYMENT.CAPTURE.COMPLETED",
  "PAYMENT.CAPTURE.DENIED",
  "PAYMENT.CAPTURE.REFUNDED"
]);

async function readRawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return Buffer.from(req.body);

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
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
    !transmissionId ||
    !transmissionTime ||
    !transmissionSig ||
    !certUrl ||
    algorithm !== "SHA256withRSA"
  ) {
    return false;
  }

  const cert = new URL(certUrl);
  const allowedHosts = new Set([
    "api-m.sandbox.paypal.com",
    "api.sandbox.paypal.com"
  ]);

  if (
    cert.protocol !== "https:" ||
    !allowedHosts.has(cert.hostname) ||
    !cert.pathname.startsWith("/v1/notifications/certs/")
  ) {
    return false;
  }

  const certResponse = await fetch(cert.toString(), {
    headers: { Accept: "application/x-pem-file, application/octet-stream" }
  });

  if (!certResponse.ok) {
    throw new Error("Could not retrieve PayPal Sandbox certificate.");
  }

  const certificate = await certResponse.text();
  if (!certificate.includes("BEGIN CERTIFICATE")) {
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

async function persistEvent(event) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase server credentials are not configured.");
  }

  const resource = event.resource || {};
  const amount = resource.amount || {};

  const safePayload = {
    verification_mode: "paypal_simulator_self_verified",
    id: event.id,
    event_type: event.event_type,
    create_time: event.create_time || null,
    resource_type: event.resource_type || null,
    resource: {
      id: resource.id || null,
      status: resource.status || null,
      amount: amount.value
        ? {
            value: String(amount.value),
            currency_code: amount.currency_code || null
          }
        : null,
      custom_id: resource.custom_id || null,
      invoice_id: resource.invoice_id || null
    }
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
        resource_id: resource.id ? String(resource.id) : null,
        payment_status: resource.status
          ? String(resource.status)
          : null,
        payload: safePayload
      })
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    console.error(
      "Simulator event persistence failed:",
      response.status,
      detail.slice(0, 300)
    );
    throw new Error("Could not persist the verified simulator event.");
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (process.env.PAYPAL_ENV !== "sandbox") {
    return res.status(403).json({
      error: "Simulator endpoint is restricted to PayPal Sandbox."
    });
  }

  try {
    const rawBody = await readRawBody(req);

    if (!rawBody.length || rawBody.length > 1024 * 1024) {
      return res.status(400).json({ error: "Invalid event body." });
    }

    const valid = await verifySimulatorSignature(rawBody, req.headers || {});

    if (!valid) {
      return res.status(400).json({
        error: "Simulator signature verification failed."
      });
    }

    let event;
    try {
      event = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return res.status(400).json({ error: "Invalid JSON event." });
    }

    if (
      !event ||
      typeof event.id !== "string" ||
      !event.id ||
      !ALLOWED_EVENTS.has(event.event_type)
    ) {
      return res.status(400).json({
        error: "Unsupported or incomplete simulator event."
      });
    }

    await persistEvent(event);

    return res.status(200).json({
      received: true,
      verified: true,
      persisted: true,
      mode: "sandbox-simulator"
    });
  } catch (error) {
    console.error("PayPal simulator webhook failed:", error);
    return res.status(500).json({
      error: "Simulator event processing failed."
    });
  }
}
