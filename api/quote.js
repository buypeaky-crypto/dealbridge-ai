export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { request, customer, email } = req.body || {};
  if (typeof request !== "string" || request.trim().length < 12) {
    return res.status(400).json({ error: "Please provide more detail about the request." });
  }
  if (request.length > 5000) {
    return res.status(400).json({ error: "Please keep the request under 5,000 characters." });
  }

  const fallback = {
    scope: "Deliver the service described by the customer. Confirm exact deliverables, exclusions, and acceptance criteria with the customer before work begins.",
    amount: 250,
    delivery: "To be agreed",
    terms: "Final scope and delivery date subject to owner confirmation."
  };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(200).json({
      ...fallback,
      ai: false,
      error: "Gemini is not configured. Add GEMINI_API_KEY in Vercel Environment Variables."
    });
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const systemInstruction = [
    "You are a careful sales assistant for a small business.",
    "Turn the customer's request into a concise quote draft.",
    "Never claim the business has agreed to anything.",
    "Suggest a reasonable price in USD, not a binding offer.",
    "Return only a JSON object with scope (string), amount (number), delivery (string), and terms (string).",
    "Keep amount positive and no greater than 100000.",
    "Make clear that the business owner must review and approve the quote."
  ].join(" ");

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          },
          contents: [{
            role: "user",
            parts: [{
              text: JSON.stringify({
                request: request.trim(),
                customer: typeof customer === "string" ? customer.slice(0, 160) : "",
                email: typeof email === "string" ? email.slice(0, 254) : ""
              })
            }]
          }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                scope: { type: "STRING" },
                amount: { type: "NUMBER" },
                delivery: { type: "STRING" },
                terms: { type: "STRING" }
              },
              required: ["scope", "amount", "delivery", "terms"]
            }
          }
        })
      }
    );

    if (!response.ok) {
      const providerError = await response.json().catch(() => ({}));
      console.error("Gemini quote request failed:", response.status, providerError.error?.status || "provider_error");
      throw new Error("Gemini request failed");
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();

    if (!generatedText) {
      throw new Error("Gemini returned no quote content");
    }

    const parsed = JSON.parse(generatedText);
    const amount = Number(parsed.amount);

    if (
      typeof parsed.scope !== "string" ||
      !parsed.scope.trim() ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > 100000
    ) {
      throw new Error("Gemini returned an invalid quote");
    }

    return res.status(200).json({
      scope: parsed.scope.trim().slice(0, 4000),
      amount,
      delivery: String(parsed.delivery || "To be agreed").slice(0, 500),
      terms: String(parsed.terms || "Subject to business owner approval.").slice(0, 1000),
      ai: true,
      provider: "gemini"
    });
  } catch (error) {
    console.error("Quote drafting unavailable:", error.message);
    return res.status(200).json({
      ...fallback,
      ai: false,
      error: "AI quote drafting is temporarily unavailable. You can edit the fallback draft manually."
    });
  }
}
