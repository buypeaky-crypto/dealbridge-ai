# PayPal AI Hackathon sponsor plan for DealBridge AI

Deadline: November 12, 2026 at 12:00 PM Pacific Time. Keep PayPal in Sandbox for the demo.

This plan uses partner tools where they strengthen the product. It deliberately avoids adding duplicate infrastructure just to display sponsor logos.

## Implemented in the repository

### Channel3 — real product-price research
- Added \`POST /api/channel3-search\` using Channel3's product search API.
- Added an opt-in "Research product prices with Channel3" control under the customer request.
- Product references can be passed to Gemini/OpenRouter as context for product-sourcing quotes.
- The UI treats the data as market references, not guaranteed stock, supplier commitments, or a final payable price.
- Required environment variable: \`CHANNEL3_API_KEY\`.
- Claim participant access at https://trychannel3.com/developers and apply promo code \`PAYPAL-HACKATHON-2026\` for 20,000 hackathon API credits. The official sponsor page says no credit card is required and credits cover 20,000 product searches.

## Use next / developer workflow

### APIMatic — PayPal API context for safer coding
Use its PayPal Context Plugin while editing or reviewing the PayPal server integration. In the Codespaces terminal, run:

\`\`\`bash
npx context-plugins install paypal
\`\`\`

Then use the coding agent's PayPal context when reviewing the Orders API, OAuth, capture verification, and webhook logic. PayPal is pre-enabled in the plugin, so the sponsor page says no extra APIMatic credentials are required for this plugin. Participants who use the plugin to build their PayPal integration can claim one month of APIMatic Basic; qualifying winners receive six months of Business. Sponsor prize: $1,000 for each of three winners plus the six-month subscription.

Claim / details: https://paypalaihackathon.devpost.com/details/apimatic

### Postman — API regression collection
Import \`postman/DealBridge-AI.postman_collection.json\` into Postman. It tests quote drafting, owner approval token issuance, PayPal Sandbox order creation, and capture verification after the buyer approval step. Set the collection's \`baseUrl\` and add \`ownerCode\` only as a secret environment variable. Do not export or commit an environment containing secrets.

PayPal sponsor resources: https://paypalaihackathon.devpost.com/details/postman

### AG Grid / AG Studio — owner payment and quote analytics
Recommended next feature: an owner-facing dashboard with quote status, verified PayPal capture/refund events, daily totals, AI-provider reliability, filters, and an agent panel that explains unusual trends. Use AG Studio for the embedded, customizable dashboard and its Agent Framework rather than adding an unrelated data grid. Build from the official PayPal + AG Grid workshop / starter to reduce integration risk.

Sponsor page: https://paypalaihackathon.devpost.com/details/aggrid
Official PayPal workshop: https://developer.paypal.com/community/blog/PayPal_AG_Grid_Part_1/
AG Grid says the hackathon judging license is provided, so do not buy a license just for the submission.

Sponsor prize: $5,000 first, $2,000 second, and three $1,000 third-place awards.

## Claim and use credits where they reduce risk

### Render — optional background workflow
Claim the participant offer of $50 Render credits from the sponsor page. Keep the existing Vercel production app in place; do not migrate hosting during the final hackathon week. The best follow-on use is a separate Render Workflow for slow/retryable post-payment tasks (receipt/event reconciliation, notifications, and report generation), with task retries and run observability.

Workflow docs: https://render.com/docs/workflows
Claim/details: https://paypalaihackathon.devpost.com/details/render

### KERNEL — remote browser QA
Claim the $50 KERNEL credit offer. Use its cloud browser to replay the public demo flow on desktop/mobile-sized viewports and capture a repeatable browser session. Keep the test strictly synthetic and use PayPal Sandbox; do not automate live payments or expose owner codes in browser scripts.

Docs: https://www.kernel.sh/docs
Claim/details: https://paypalaihackathon.devpost.com/details/kernel

### Elastic — payment-event search and audit
Use Elasticsearch hybrid/vector search for a searchable audit view over verified PayPal webhook events and later saved quote records. Useful questions include "show refunded captures", "find similar payment failures", and "why did quote generation fall back?". Start with the hackathon trial or local Elasticsearch; don't make production depend on a trial that expires during judging.

Sponsor page: https://paypalaihackathon.devpost.com/details/elastic

### Astropods — agent lifecycle and observability
Use its agent runtime, tool wiring, knowledge stores, secrets, deployment and traces if we decide to turn DealBridge's short quote step into a larger multi-step business agent. It overlaps with Vercel/Render, so keep it as a staging experiment rather than running duplicate production systems before submission.

Docs: https://docs.astropods.com
Sponsor page: https://paypalaihackathon.devpost.com/details/astropods

### Bryntum — delivery scheduling
Use a Bryntum Scheduler or Gantt timeline for approved jobs: delivery milestones, assigned resources, dependencies, and dates. This becomes valuable once DealBridge persists approved projects. Avoid adding a calendar before we have reliable project records; it would otherwise be a decorative, unsupported feature.

Sponsor page: https://paypalaihackathon.devpost.com/details/bryntum

## Order of work before submission

1. Add \`OPENROUTER_API_KEY\` to Vercel and verify Gemini → OpenRouter fallback.
2. Add \`CHANNEL3_API_KEY\` to Vercel and test a product-sourcing request.
3. Import and run the Postman collection against Sandbox.
4. Install the APIMatic PayPal Context Plugin and use it to review the PayPal endpoints.
5. Build one substantial AG Studio owner dashboard feature; this is the highest-value sponsor prize.
6. Claim the Render and KERNEL credits, but do not migrate or add production infrastructure unless the feature is actually demonstrated.
7. Only then consider Elastic search and Bryntum scheduling; use Astropods as an optional agent-runtime experiment.

## Claims and limitations
Credit/trial offers are participant benefits, not guaranteed cash awards. Account eligibility, expiration and final terms are controlled by each sponsor. Sponsor prize amounts and eligibility are listed in the official Devpost rules. A project can win a maximum of one Grand Prize plus one Sponsor Prize, or one Honorable Mention plus one Sponsor Prize.
