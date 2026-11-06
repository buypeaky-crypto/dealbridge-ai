# DealBridge AI

**From customer request to owner-approved quote to server-verified PayPal payment.**

DealBridge AI helps a small business turn an unstructured customer request into an editable quote. The business owner reviews and approves the scope and price before PayPal checkout is enabled.

## Product flow
1. Customer submits a request.
2. AI drafts scope, a suggested USD price, delivery estimate, and terms.
3. Business owner edits and approves the quote.
4. PayPal creates an order on the server and the customer checks out.
5. The server captures the order and checks PayPal's authoritative capture status.
6. A webhook endpoint verifies PayPal signatures for event notifications.

## Stack
Vanilla HTML/CSS/JavaScript, Vercel serverless Node.js functions, OpenAI-compatible Chat Completions API, PayPal Orders v2 API.

## Environment variables
Configure these in Vercel Project Settings → Environment Variables:

- `OPENAI_API_KEY` — optional for AI quote generation; without it, the app provides a clearly labeled editable fallback.
- `OPENAI_MODEL` — optional; defaults to `gpt-4o-mini`.
- `PAYPAL_CLIENT_ID` — PayPal app client ID.
- `PAYPAL_CLIENT_SECRET` — PayPal app secret (server-side only).
- `PAYPAL_ENV` — set to `sandbox` for testing (default) or `live` for production.
- `PAYPAL_WEBHOOK_ID` — webhook ID created in the matching PayPal environment.

The browser PayPal SDK currently uses the Sandbox demo client ID placeholder. Before testing, replace it with your public PayPal Sandbox client ID in `index.html`. Never put the PayPal secret in browser code.

## Run locally
Install the Vercel CLI, add environment variables with `vercel env add`, then run:

```bash
vercel dev
```

## Important demo limitations
This is a hackathon MVP scaffold, not a production payment platform. It currently has no database-backed quote/order ownership, customer authentication, or durable webhook event ledger. Do not use it to accept real payments until those controls, order-to-quote integrity checks, idempotency, and operational monitoring are implemented and tested.

## License
MIT. See [LICENSE](LICENSE).
