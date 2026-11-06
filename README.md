# DealBridge AI

**From customer request to server-approved quote to PayPal payment.**

Gemini drafts an editable quote. The business owner reviews it and obtains server-side approval before PayPal checkout is enabled.

## Flow
1. Customer submits a request; Gemini drafts scope, USD price, delivery, and terms.
2. Owner edits the draft and enters a private approval code.
3. The server validates the code and signs the quote with a 30-minute HMAC token.
4. PayPal order creation accepts only a valid, unexpired signed quote; price is taken from the signed payload, not browser-submitted fields.
5. Before capture, the server retrieves the PayPal order and checks status, DealBridge custom ID, USD currency, and amount; it verifies the completed capture and matching amount.
6. The webhook endpoint verifies PayPal event signatures, then stores a minimal event record in Supabase. Event IDs are unique, so repeated PayPal deliveries do not create duplicate rows; a database failure returns HTTP 500 so PayPal can retry.

## Stack
Vanilla HTML/CSS/JavaScript, Vercel serverless Node.js functions, Google Gemini API, PayPal Orders v2 API.

## Environment variables
- `GEMINI_API_KEY` — optional for AI quote generation; fallback is clearly labeled.
- `GEMINI_MODEL` — optional; defaults to `gemini-3.8-flash`.
- `OWNER_APPROVAL_CODE` — required; private code, minimum 16 characters.
- `QUOTE_SIGNING_SECRET` — required; random server-only secret, minimum 32 characters.
- `PAYPAL_CLIENT_ID` — PayPal app client ID.
- `PAYPAL_CLIENT_SECRET` — PayPal app secret, server-side only.
- `PAYPAL_ENV` — use `sandbox` for testing.
- `PAYPAL_WEBHOOK_ID` — webhook ID from the same PayPal environment.\n- `SUPABASE_URL` — server-side Supabase project URL.\n- `SUPABASE_SERVICE_ROLE_KEY` — server-only Supabase secret/service-role key; never expose it to the browser.

Never expose owner codes, signing secrets, or PayPal secrets in browser code or GitHub.

## Local run
Install Vercel CLI, configure environment variables with `vercel env add`, then run `vercel dev`.

## Privacy
The Gemini request includes only the customer request description; the customer name and email are not sent to Gemini. The free Gemini tier may use submitted prompts and responses to improve Google products. Use synthetic demo details and do not enter real customer personal data, payment details, or confidential business information.

## Security scope / demo limitations
This is a hackathon MVP, not a production payment platform. Signed approvals prevent changing the amount after approval, and PayPal order details are checked before capture. The shared owner code is a prototype, not full identity/session authentication. Approval tokens are not persisted or consumed, so one-time use/revocation is not enforced. Verified webhook events are stored in the Supabase `paypal_webhook_events` table with a unique event ID and minimal event data. Duplicate deliveries are ignored by the database. There is no customer authentication, tenant isolation, refund workflow, or production monitoring.

Keep `PAYPAL_ENV=sandbox`. Do not accept real payments until proper owner authentication, persistent quote/order records, one-time approval consumption, durable webhook processing, and a security review are completed.

## License
MIT. See [LICENSE](LICENSE).
