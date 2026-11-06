export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { request } = req.body || {};
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
      ...fallback, ai: false,
      error: "Gemini is not configured. Add GEMINI_API_KEY in Vercel Environment Variables."
    });
  }

  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const systemInstruction = [
    "You are a careful sales assistant for a small business.",
    "Turn the customer's request into a concise quote draft.",
    "Never claim the business has agreed to anything.",
    "Suggest a reasonable price in USD, not a binding offer.",
    "Return only a JSON object with scope (string), amount (number), delivery (string), and terms (string).",
    "Keep amount positive and no greater than 100000.",
    "Make clear that the business owner must review and approve the quote."
  ].join(" ");

  const payload = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: "user", parts: [{ text: request.trim() }] }],
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
  };

  let data;
  let lastStatus = 0;

  // Retry once for transient provider failures; bound each request to keep
  // the serverless function responsive and preserve the editable fallback.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(4000)
        }
      );

      const responseText = await response.text();
      let body = {};
      try { body = responseText ? JSON.parse(responseText) : {}; } catch { body = {}; }

      if (response.ok) {
        data = body;
        break;
      }

      lastStatus = response.status;
      console.error("Gemini quote request failed:", {
        status: lastStatus,
        providerCode: body.error?.status || body.error?.code || "provider_error",
        model,
        attempt: attempt + 1
      });

      if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 1) break;
    } catch (error) {
      console.error("Gemini quote request transport failure:", {
        reason: error.name === "TimeoutError" || error.name === "AbortError" ? "timeout" : "network_error",
        model,
        attempt: attempt + 1
      });
      if (attempt === 1) break;
    }

    await new Promise(resolve => setTimeout(resolve, 250));
  }

  if (!data) {
    const error = lastStatus === 404
      ? "Gemini could not find the configured model. Check GEMINI_MODEL and the API key's project access."
      : lastStatus === 400
        ? "Gemini rejected the request. Check the configured model and API settings."
        : lastStatus
          ? `Gemini is temporarily unavailable (HTTP ${lastStatus}). Please retry; the editable fallback is ready.`
          : "Gemini did not respond in time. Please retry; the editable fallback is ready.";
    return res.status(200).json({ ...fallback, ai: false, error });
  }

  const generatedText = data.candidates?.[0]?.content?.parts
    ?.map(part => part.text || "")
    .join("")
    .trim();

  if (!generatedText) {
    console.error("Gemini returned no quote content:", {
      model, finishReason: data.candidates?.[0]?.finishReason || "unknown"
    });
    return res.status(200).json({
      ...fallback, ai: false,
      error: "Gemini returned an empty draft. Please retry; the editable fallback is ready."
    });
  }

  try {
    const parsed = JSON.parse(generatedText);
    const amount = Number(parsed.amount);
    if (
      typeof parsed.scope !== "string" || !parsed.scope.trim() ||
      !Number.isFinite(amount) || amount <= 0 || amount > 100000
    ) throw new Error("Gemini returned an invalid quote");

    return res.status(200).json({
      scope: parsed.scope.trim().slice(0, 4000),
      amount,
      delivery: String(parsed.delivery || "To be agreed").slice(0, 500),
      terms: String(parsed.terms || "Subject to business owner approval.").slice(0, 1000),
      ai: true,
      provider: "gemini"
    });
  } catch (error) {
    console.error("Gemini quote response validation failed:", error.message);
    return res.status(200).json({
      ...fallback, ai: false,
      error: "Gemini returned an invalid quote format. Please retry; the editable fallback is ready."
    });
  }
}
