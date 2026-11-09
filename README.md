# DealBridge AI

**From customer request to owner-approved quote to PayPal payment.**

DealBridge AI uses AI to turn a customer's service request into an editable quote. A business owner reviews the scope and amount, explicitly approves it on the server, and only then can the customer pay through PayPal Sandbox.

## How it works

1. Customer enters a service request.
2. Gemini drafts the scope, USD price, delivery estimate and terms.
3. If Gemini is unavailable, fails, times out or produces invalid content, OpenRouter's free-model router is tried automatically.
4. For product-sourcing jobs, the customer may optionally enter a separate product query. Channel3 returns real product listings, retailer offers, prices and product links. Only that separate product query is sent to Channel3; it is not sent customer names, emails or the whole service request.
5. The AI may use the returned product references as context, but they are not a guarantee of stock, a supplier commitment or the final cost.
6. If both AI providers fail, the app shows an editable fallback quote.
7. The owner edits the draft and enters a private approval code.
8. The server validates the code and signs the quote with a 30-minute HMAC token.
9. PayPal order creation accepts only a valid, unexpired signed quote. The price is taken from the signed payload, not browser-submitted fields.
10. Before capture, the server retrieves the PayPal order and checks the order status, DealBridge custom ID, USD currency and amount. It then verifies the completed capture and matching amount.
11. The webhook endpoint verifies PayPal event signatures and stores a minimal event record in Supabase. Event IDs are unique; duplicate deliveries are ignored.

## Owner dashboard

Open `/owner.html` and sign in with the same owner approval code used for quote approval. The dashboard uses a short-lived, HMAC-signed one-hour owner session held in the browser's session storage. Its server API reads only the existing `paypal_webhook_events` table using the Supabase service-role key.

The dashboard separates registered PayPal webhook events from sandbox-simulator events. Its KPIs count completed capture/sale events, USD amounts present in those events, refund events, and simulator events. The AG Studio workspace receives a sanitized event dataset without customer names, email addresses, or raw webhook payloads. It supports owner-created charts, grids, filters and report layouts.

Set **AG_STUDIO_LICENSE_KEY** in Vercel for the trial licence. The key is returned only after the owner dashboard session is authenticated and is configured in the browser as required by AG Studio's JavaScript licence API. Do not commit the key to GitHub. AG Studio is loaded from its version-pinned CDN bundle.

Important data limitations:
- This is a view of stored webhook events, not a complete payment/order ledger.
- Simulator events are explicitly marked and excluded from verified PayPal KPI totals.
- No quote records are persisted yet, so quote totals, quote-to-payment conversion, AI-provider success rates and customer-level analytics are not reported.
- The dashboard loads up to 500 stored webhook records per request; the API does not currently guarantee chronological pagination.
- The shared owner code is a prototype authentication mechanism, not full identity/session authentication or tenant isolation.

## Stack

Vanilla HTML/CSS/JavaScript, Vercel serverless Node.js functions, Gemini API, OpenRouter API, Channel3 product API, PayPal Orders v2 API, Supabase webhook-event storage and AG Studio embedded analytics.

## Vercel environment variables

- **GEMINI_API_KEY** — optional primary AI provider key.
- **GEMINI_MODEL** — optional; defaults to gemini-3.8-flash.
- **OPENROUTER_API_KEY** — optional backup AI provider key. Store only server-side in Vercel.
- **OPENROUTER_MODEL** — optional; defaults to openrouter/free.
- **CHANNEL3_API_KEY** — optional key for on-demand product and retailer price research.
- **OWNER_APPROVAL_CODE** — required; private code, minimum 16 characters.
- **QUOTE_SIGNING_SECRET** — required; random server-only secret, minimum 32 characters.
- **AG_STUDIO_LICENSE_KEY** — AG Studio trial licence key; delivered to the authenticated owner dashboard client for AG Studio's client-side licence validation.
- **PAYPAL_CLIENT_ID** — PayPal app client ID.
- **PAYPAL_CLIENT_SECRET** — PayPal app secret, server-side only.
- **PAYPAL_ENV** — keep set to sandbox for the hackathon.
- **PAYPAL_WEBHOOK_ID** — webhook ID from the same PayPal environment.
- **SUPABASE_URL** — server-side Supabase project URL.
- **SUPABASE_SERVICE_ROLE_KEY** — server-only Supabase service-role key; never expose it to the browser.

Never expose owner codes, signing secrets, AI provider keys or PayPal secrets in browser code or GitHub.

## AI provider behavior

Gemini is attempted first. OpenRouter is attempted automatically if Gemini is missing, unavailable, times out or returns an unusable draft. The default OpenRouter model is openrouter/free, which routes to an available free model. Free models are rate limited and availability varies. The app always retains an editable fallback. An AI draft is never an approved quote and cannot unlock checkout by itself.

## Channel3 hackathon credits

Sign up at https://trychannel3.com/developers and use promo code **PAYPAL-HACKATHON-2026** to claim the hackathon's 20,000 free product-search credits. The optional product query is separate from the customer request. Channel3's attributed retailer links may earn commissions when users click and purchase, subject to its terms and eligible offers.

## Local run

Install the Vercel CLI, configure environment variables with vercel env add, then run vercel dev.

## Supabase webhook-event table

Before testing webhook persistence in a new Supabase project, apply `supabase/migrations/20261107000000_paypal_webhook_events.sql` in the Supabase SQL Editor. It creates the `paypal_webhook_events` table with a unique event ID and enables row-level security without exposing rows to anonymous or authenticated clients. The webhook writes with the server-only service-role key. This migration is idempotent for an already-created table; confirm its columns match the webhook handler before applying it to an existing custom schema.

## Postman API tests

Import `postman/DealBridge-AI.postman_collection.json` into Postman. Set baseUrl to the deployed demo URL. Store ownerCode as a secret environment variable; never export or commit an environment containing secrets. The collection covers quote generation, owner approval, PayPal Sandbox order creation and capture. After request 03, open the saved approveUrl in a browser, approve with a Sandbox buyer account, and then run request 04. Use sandbox buyer credentials only.

## Hackathon sponsor integrations

See HACKATHON_SPONSORS.md for sponsor tool roles, access links and implementation notes. Not every partner is integrated into the running app; the guide distinguishes live code changes from recommended tooling and future extensions.

## Privacy

Customer name and email are not included in prompts sent to AI providers. Only the service request and, when supplied, the separate Channel3 product references are passed to Gemini/OpenRouter. Only the standalone product query is sent to Channel3. Provider data handling depends on the selected model and the provider's terms. Use synthetic details only; do not enter real customer personal data, payment details or confidential business information.

## Security scope and demo limitations

This is a hackathon MVP, not a production payment platform. Signed approvals prevent changing the amount after approval, and PayPal order details are checked before capture. The shared owner code is a prototype, not full identity/session authentication. Approval tokens are not persisted or consumed, so one-time use and revocation are not enforced. Verified webhook events are stored in the Supabase paypal_webhook_events table with a unique event ID and minimal event data. There is no customer authentication, tenant isolation, refund workflow or production monitoring.

Keep PAYPAL_ENV=sandbox. Do not accept real payments until proper owner authentication, persistent quote/order records, one-time approval consumption, durable webhook processing and a security review are completed.

## License

MIT. See LICENSE.
