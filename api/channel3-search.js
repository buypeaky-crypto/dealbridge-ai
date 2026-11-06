export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { query } = req.body || {};
  if (typeof query !== "string" || query.trim().length < 3) {
    return res.status(400).json({ error: "Enter a product or item to research." });
  }
  if (query.length > 1000) return res.status(400).json({ error: "Keep the product search under 1,000 characters." });

  const apiKey = process.env.CHANNEL3_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "Channel3 is not configured. Add CHANNEL3_API_KEY in Vercel to enable product price research." });

  try {
    const response = await fetch("https://api.trychannel3.com/v1/search", {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ query: query.trim(), limit: 5 }),
      signal: AbortSignal.timeout(5000)
    });
    const text = await response.text();
    let body = {};
    try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }
    if (!response.ok) {
      console.error("[channel3] search failed", { status: response.status });
      return res.status(502).json({ error: "Channel3 product research is temporarily unavailable." });
    }

    const sourceProducts = Array.isArray(body.products) ? body.products
      : Array.isArray(body.results) ? body.results
      : Array.isArray(body.items) ? body.items
      : Array.isArray(body.data?.products) ? body.data.products
      : [];
    const products = sourceProducts.slice(0, 5).map(product => {
      const offers = Array.isArray(product.offers) ? product.offers.slice(0, 3).map(offer => {
        const rawPrice = offer.price;
        const priceObject = rawPrice && typeof rawPrice === "object" ? rawPrice : {};
        const numericPrice = Number(priceObject.price ?? priceObject.value ?? rawPrice ?? offer.price_value);
        const currency = String(priceObject.currency_code || priceObject.currency || offer.currency_code || offer.currency || "").slice(0, 8);
        const rawUrl = offer.url || offer.offer_url || offer.link || "";
        let url = "";
        try { const parsed = new URL(rawUrl); if (parsed.protocol === "https:") url = parsed.toString().slice(0, 1000); } catch {}
        return {
          merchant: String(offer.merchant?.name || offer.merchant_name || offer.retailer || offer.merchant || "Retailer").slice(0, 100),
          price: Number.isFinite(numericPrice) && numericPrice > 0 ? numericPrice : null,
          currency,
          url
        };
      }).filter(offer => offer.price !== null || offer.url) : [];
      const rawImage = product.image_url || product.image?.url || product.image || product.images?.[0]?.url || "";
      let imageUrl = "";
      try { const parsed = new URL(rawImage); if (parsed.protocol === "https:") imageUrl = parsed.toString().slice(0, 1000); } catch {}
      return {
        title: String(product.title || product.name || product.product_title || "Product").slice(0, 200),
        brand: String(product.brand?.name || product.brand || "").slice(0, 100),
        imageUrl,
        offers
      };
    }).filter(product => product.title !== "Product" || product.offers.length);

    return res.status(200).json({ source: "channel3", products });
  } catch (error) {
    console.error("[channel3] search transport failure", {
      reason: error.name === "TimeoutError" || error.name === "AbortError" ? "timeout" : "network_error"
    });
    return res.status(502).json({ error: "Channel3 product research timed out. Please retry." });
  }
}
