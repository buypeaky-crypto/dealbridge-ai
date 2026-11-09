import { timingSafeEqual } from "node:crypto";
import { issueOwnerSession } from "../../lib/owner-auth.js";

function equal(a, b) {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length === y.length && timingSafeEqual(x, y);
}

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ownerCode = process.env.OWNER_APPROVAL_CODE;
  const secret = process.env.QUOTE_SIGNING_SECRET;
  if (!ownerCode || ownerCode.length < 16 || !secret || secret.length < 32) {
    return res.status(503).json({ error: "Owner dashboard authentication is not configured." });
  }
  if (!equal(req.body?.ownerCode, ownerCode)) {
    return res.status(401).json({ error: "The owner code is incorrect." });
  }

  try {
    const session = issueOwnerSession();
    return res.status(200).json({
      sessionToken: session.token,
      expiresIn: session.expiresIn
    });
  } catch {
    return res.status(503).json({ error: "Owner dashboard authentication is unavailable." });
  }
}
