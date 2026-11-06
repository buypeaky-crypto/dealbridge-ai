import { verifyOwnerSession } from "../../lib/owner-auth.js";

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!verifyOwnerSession(req)) return res.status(401).json({ error: "Owner session expired. Sign in again." });

  const licenseKey = process.env.AG_STUDIO_LICENSE_KEY || "";
  return res.status(200).json({
    agStudioConfigured: Boolean(licenseKey),
    licenseKey
  });
}
