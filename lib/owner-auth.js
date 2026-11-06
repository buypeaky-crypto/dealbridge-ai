import { createHmac, timingSafeEqual } from "node:crypto";

const SESSION_SECONDS = 60 * 60;

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

function signingSecret() {
  const secret = process.env.QUOTE_SIGNING_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("Owner dashboard signing is not configured.");
  }
  return secret;
}

export function issueOwnerSession() {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    purpose: "dealbridge-owner-dashboard",
    iat: now,
    exp: now + SESSION_SECONDS
  })).toString("base64url");
  const signature = createHmac("sha256", signingSecret()).update(payload).digest("base64url");
  return { token: payload + "." + signature, expiresIn: SESSION_SECONDS };
}

export function verifyOwnerSession(req) {
  try {
    const header = req.headers?.authorization;
    if (typeof header !== "string" || !header.startsWith("Bearer ")) return false;
    const token = header.slice(7);
    const parts = token.split(".");
    if (parts.length !== 2) return false;
    const [payload, signature] = parts;
    const expected = createHmac("sha256", signingSecret()).update(payload).digest("base64url");
    if (!safeEqual(signature, expected)) return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const now = Math.floor(Date.now() / 1000);
    return data?.purpose === "dealbridge-owner-dashboard" &&
      Number.isInteger(data.iat) && Number.isInteger(data.exp) &&
      data.iat <= now + 60 && data.exp > now && data.exp - data.iat <= SESSION_SECONDS;
  } catch {
    return false;
  }
}
