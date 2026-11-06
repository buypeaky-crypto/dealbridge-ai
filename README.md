# DealBridge AI

**From customer request to server-approved quote to PayPal payment.**

Gemini drafts an editable quote. The business owner reviews it and obtains server-side approval before PayPal checkout is enabled.

## Flow
1. Customer submits a request; Gemini drafts scope, USD price, delivery, and terms.
2. Owner edits the draft and enters a private approval code.
3. The server validates the code and signs the quote with a 30-minute HMAC token.
4. PayPal order creation accepts only a valid, unexpired signed quote; price is taken from the signed payload, not browser-submitted fields.
5. Before capture, the server retrieves the PayPal order and checks status, DealBridge custom ID, USD currency, and amount; it verifies the completed capture and matching amount.
6. The webhook endpoint verifies PayPal event signatures.

## Stack
Vanilla HTML/CSS/JavaScript, Vercel serverless Node.js functions, Google Gemini API, PayPal Orders v2 API.

## Environment variables
- `GEMINI_API_KEY` — optional for AI quote generation; fallback is clearly labeled.
- `GEMINI_MODEL` — optional; defaults to `gemini-2.5-flash`.
- `OWNER_APPROVAL_CODE` — required; private code, minimum 16 characters.
- `QUOTE_SIGNING_SECRET` — required; random server-only secret, minimum 32 characters.
- `PAYPAL_CLIENT_ID` — PayPal app client ID.
- `PAYPAL_CLIENT_SECRET` — PayPal app secret, server-side only.
- `PAYPAL_ENV` — use `sandbox` for testing.
- `PAYPAL_WEBHOOK_ID` — webhook ID from the same PayPal environment.

Never expose owner codes, signing secrets, or PayPal secrets in browser code or GitHub.

## Local run
Install Vercel CLI, configure environment variables with `vercel env add`, then run `vercel dev`.

## Security scope / demo limitations
This is a hackathon MVP, not a production payment platform. Signed approvals prevent changing the amount after approval, and PayPal order details are checked before capture. The shared owner code is a prototype, not full identity/session authentication. Approval tokens are not persisted or consumed, so one-time use/revocation is not enforced. Webhook signatures are verified but events are not stored in a durable idempotent ledger. There is no customer authentication, tenant isolation, refund workflow, or production monitoring.

Keep `PAYPAL_ENV=sandbox`. Do not accept real payments until proper owner authentication, persistent quote/order records, one-time approval consumption, durable webhook processing, and a security review are completed.

## License
MIT. See [LICENSE](LICENSE).
