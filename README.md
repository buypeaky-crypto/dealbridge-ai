# DealBridge AI

**From customer request to server-approved quote to PayPal payment.**

DealBridge AI drafts editable quotes with Gemini and automatically falls back to OpenRouter's free-model router when Gemini is unavailable. The business owner reviews the quote and obtains server-side approval before PayPal checkout is enabled.

## Flow
1. Customer submits a request; Gemini drafts scope, USD price, delivery, and terms.
2. If Gemini is not configured, fails, times out, or returns invalid content, OpenRouter's free-model router is tried automatically.
3. If both AI providers fail or are not configured, a clearly labeled editable fallback draft is shown.
4. Owner edits the draft and enters a private approval code.
5. The server validates the code and signs the quote with a 30-minute HMAC token.
6. PayPal order creation accepts only a valid, unexpired signed quote; price is taken from the signed payload, not browser-submitted fields.
7. Before capture, the server retrieves the PayPal order and checks status, DealBridge custom ID, USD currency, and amount; it verifies the completed capture and matching amount.
8. The webhook endpoint verifies PayPal event signatures, then stores a minimal event record in Supabase. Event IDs are unique, so repeated PayPal deliveries do not create duplicate rows; a database failure returns HTTP 500 so PayPal can retry.

## Stack
Vanilla HTML/CSS/JavaScript, Vercel serverless Node.js functions, Gemini API, OpenRouter API, PayPal Orders v2 API, and Supabase for verified webhook-event storage.

## Environment variables
- \`GEMINI_API_KEY\` — optional primary AI provider key.
- \`GEMINI_MODEL\` — optional; defaults to \`gemini-3.8-flash\`.
- \`OPENROUTER_API_KEY\` — optional backup AI provider key. Store only in Vercel server-side environment variables.
- \`OPENROUTER_MODEL\` — optional; defaults to \`openrouter/free\`, which routes to an available free model.
- \`OWNER_APPROVAL_CODE\` — required; private code, minimum 16 characters.
- \`QUOTE_SIGNING_SECRET\` — required; random server-only secret, minimum 32 characters.
- \`PAYPAL_CLIENT_ID\` — PayPal app client ID.
- \`PAYPAL_CLIENT_SECRET\` — PayPal app secret, server-side only.
- \`PAYPAL_ENV\` — use \`sandbox\` for testing.
- \`PAYPAL_WEBHOOK_ID\` — webhook ID from the same PayPal environment.
- \`SUPABASE_URL\` — server-side Supabase project URL.
- \`SUPABASE_SERVICE_ROLE_KEY\` — server-only Supabase secret/service-role key; never expose it to the browser.

Never expose owner codes, signing secrets, AI provider keys, or PayPal secrets in browser code or GitHub.

## AI provider behavior
Gemini is attempted first. OpenRouter is attempted automatically if Gemini is absent, unavailable, times out, or returns an unusable draft. The default OpenRouter model is \`openrouter/free\`; its selected model and capacity can change, and free-model requests are rate limited. The app always retains an editable fallback. An AI draft is never an approved quote and cannot unlock checkout by itself.

## Local run
Install Vercel CLI, configure environment variables with \`vercel env add\`, then run \`vercel dev\`.

## Privacy
Only the customer request description is sent to the configured AI provider; customer name and email are not included in the AI prompt. Provider data handling depends on the selected model and its serving provider. Use synthetic demo details and do not enter real customer personal data, payment details, or confidential business information.

## Postman API tests
Import \`postman/DealBridge-AI.postman_collection.json\` into Postman. Set \`baseUrl\` to the deployed demo URL. Set \`ownerCode\` as a secret/secret-vault variable only when testing the owner approval route. The collection includes quote generation, owner approval, PayPal Sandbox order creation, and capture requests. Use sandbox buyer credentials only; never use live PayPal credentials or real payment details.

## Hackathon sponsor integrations
See \`HACKATHON_SPONSORS.md\` for sponsor tool roles, access links, and implementation notes.

## Security scope / demo limitations
This is a hackathon MVP, not a production payment platform. Signed approvals prevent changing the amount after approval, and PayPal order details are checked before capture. The shared owner code is a prototype, not full identity/session authentication. Approval tokens are not persisted or consumed, so one-time use/revocation is not enforced. Verified webhook events are stored in the Supabase \`paypal_webhook_events\` table with a unique event ID and minimal event data. Duplicate deliveries are ignored by the database. There is no customer authentication, tenant isolation, refund workflow, or production monitoring.

Keep \`PAYPAL_ENV=sandbox\`. Do not accept real payments until proper owner authentication, persistent quote/order records, one-time approval consumption, durable webhook processing, and a security review are completed.

## License
MIT. See [LICENSE](LICENSE).
