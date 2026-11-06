# PayPal AI Hackathon sponsor plan for DealBridge AI

Submission deadline: November 12, 2026 at 12:00 PM Pacific Time. Keep PayPal in Sandbox.

This plan uses partner tools where they improve the product or strengthen judging evidence. It avoids adding duplicate infrastructure just to display sponsor logos.

## Implemented in the repository

### Channel3 — real product and retailer price research
- Server-side POST endpoint at /api/channel3-search.
- Separate, optional product-query field in the customer form.
- Returns product titles, images, brands, retailer offers, prices, currencies and links.
- Passes only selected product references to Gemini/OpenRouter as context for a product-sourcing quote.
- Customer names, emails and the full service request are not sent to Channel3.
- Product listings are references, not guaranteed stock, supplier commitments or final payable prices.
- Required Vercel environment variable: CHANNEL3_API_KEY.

### Postman — repeatable API tests
- Repository includes postman/DealBridge-AI.postman_collection.json.
- Collection covers AI quote drafting, signed owner approval, PayPal Sandbox order creation and capture verification.
- Use synthetic data and a Sandbox buyer. Keep ownerCode in a secret Postman environment variable.

### AG Grid / AG Studio — private owner analytics dashboard
- New vanilla JavaScript owner area at /owner.html.
- Short-lived HMAC owner session based on the existing owner approval code and QUOTE_SIGNING_SECRET.
- Server-side metrics endpoint reads the existing Supabase paypal_webhook_events table using SUPABASE_SERVICE_ROLE_KEY.
- Dashboard separates registered PayPal webhook events from sandbox simulator events; simulator data is excluded from real PayPal capture and refund KPIs.
- AG Studio 3.1.0 is loaded from its version-pinned CDN. Owner can create and edit reports over a sanitized event dataset.
- Required Vercel variable: AG_STUDIO_LICENSE_KEY. It is returned only after dashboard authentication because AG Studio's JavaScript licence API validates the key client-side.
- Current metrics are limited to the stored webhook history (up to 500 rows). Quote/order persistence, quote conversion and AI-provider analytics are not yet implemented.

## Integrations and benefits to claim next

### APIMatic — PayPal API coding context
Use the PayPal Context Plugin in the coding assistant to review and improve the existing Orders API, OAuth, capture-verification and webhook implementation against PayPal's API contracts. Avoid running live payment operations.

Sponsor page and subscription claim: https://paypalaihackathon.devpost.com/details/apimatic

### AG Grid / AG Studio — owner analytics dashboard
This is now implemented as a vanilla JavaScript dashboard prototype using the AG Studio JavaScript bundle. It uses the existing webhook records and does not require a React migration. Add the AG Studio trial key to Vercel as AG_STUDIO_LICENSE_KEY before relying on the licensed production experience.

Official JavaScript quick start: https://www.ag-grid.com/studio/javascript/quick-start/
Licence instructions: https://www.ag-grid.com/studio/javascript/licence-install/
Sponsor page: https://paypalaihackathon.devpost.com/details/aggrid

### Render — background workflows and participant credits
Potential future use: retryable post-payment processing for receipt generation, event reconciliation, notifications and daily summaries. Keep the customer app and immediate PayPal API on Vercel unless a measured need justifies another runtime.

Docs: https://render.com/docs/workflows
Sponsor page: https://paypalaihackathon.devpost.com/details/render

### KERNEL — cloud-browser demo QA and participant credits
Potential use: repeatable synthetic end-to-end checks of the deployed request → quote → owner approval → PayPal Sandbox flow. Do not expose owner codes in browser scripts and do not automate live payments.

Docs: https://www.kernel.sh/docs
Sponsor page: https://paypalaihackathon.devpost.com/details/kernel

### Elastic — searchable payment and quote audit
Potential use: semantic search over verified webhook events and, after implementation, persisted quote records. Avoid making the deployed demo depend on a trial that expires.

Sponsor page: https://paypalaihackathon.devpost.com/details/elastic

### Astropods — agent runtime and observability
Potential use: a separate quote-follow-up or payment-triage prototype. This overlaps with the current Vercel setup, so defer it until a concrete workflow needs a second runtime.

Docs: https://docs.astropods.com
Sponsor page: https://paypalaihackathon.devpost.com/details/astropods

### Bryntum — post-approval delivery scheduling
Potential use: a delivery timeline where work milestones are released only after the linked PayPal payment is confirmed. Requires persistent job data first.

Sponsor page: https://paypalaihackathon.devpost.com/details/bryntum

## Priority before submission

1. Configure AG_STUDIO_LICENSE_KEY in Vercel and verify the owner dashboard in the production-like preview.
2. Run the Postman collection against PayPal Sandbox with synthetic data.
3. Add OpenRouter and Channel3 keys if not already configured, then test the respective fallback and product-search flows.
4. Use Kernel to record a reliable synthetic end-to-end browser demo.
5. Consider Elastic or Render only if they can be completed, tested and demonstrated without destabilizing the core flow.

## Important judging and access notes

Sponsor integrations must be meaningful and working in the demo. Tool access, credit eligibility, trial duration and payouts remain subject to each sponsor's official terms. Keep all payment activity in PayPal Sandbox.
