# PayPal AI Hackathon sponsor plan for DealBridge AI

Submission deadline: November 12, 2026 at 12:00 PM Pacific Time. Keep PayPal in Sandbox.

This plan uses partner tools where they improve the product or strengthen judging evidence. It avoids adding duplicate infrastructure just to display sponsor logos.

## Already implemented in the repository

### Channel3 — real product and retailer price research
- Added the server-side POST endpoint at /api/channel3-search.
- Added a separate, optional product-query field in the customer form.
- Returns product titles, images, brands, retailer offers, prices, currencies and links.
- Passes only the selected product references to Gemini/OpenRouter as context for a product-sourcing quote.
- Customer names, emails and the full service request are not sent to Channel3.
- Product listings are references, not guaranteed stock, supplier commitments or a final payable price.
- Required Vercel environment variable: CHANNEL3_API_KEY.

**Claim the 20,000 hackathon searches:** sign up at https://trychannel3.com/developers and apply promo code PAYPAL-HACKATHON-2026. The official Channel3 sponsor page says no credit card is required and the code provides 20,000 API credits / product searches. Channel3's API returns attributed retailer links; eligible purchases through those links may generate commissions under Channel3's program and payout terms.

Sponsor page: https://paypalaihackathon.devpost.com/details/channel3
API guide: https://channel3.ai/docs/guides/make-a-search
API schema: https://channel3.ai/docs/guides/response-overview

## Integrations and benefits to claim next

### APIMatic — PayPal API coding context
Use the PayPal Context Plugin in the coding assistant to review and improve the existing Orders API, OAuth, capture-verification and webhook implementation against PayPal's API contracts.

In the Codespaces terminal:
 
```bash
npx context-plugins install paypal
```

PayPal is pre-enabled in this plugin. The sponsor page says no extra APIMatic credentials are needed to use the plugin. Participants who use the plugin to build their PayPal integration can claim one month of APIMatic Basic free; qualifying winners receive six months of APIMatic Business. The sponsor prize is $1,000 for each of three winners plus the subscription.

Sponsor page and subscription claim: https://paypalaihackathon.devpost.com/details/apimatic

### Postman — repeatable API tests
The repository now includes postman/DealBridge-AI.postman_collection.json. Import it into Postman, set baseUrl, and store ownerCode only as a secret environment variable. The collection exercises AI quote drafting, signed owner approval, PayPal Sandbox order creation and capture verification. Request 03 saves approveUrl; open it in a browser, approve with a Sandbox buyer account, then run request 04. Do not export or commit an environment containing secrets.

Sponsor page: https://paypalaihackathon.devpost.com/details/postman

### AG Grid / AG Studio — owner analytics dashboard
This is the strongest next product feature and sponsor prize opportunity. Build a real owner dashboard showing verified PayPal captures, quote totals, payment status, refunds when available, quote-to-payment conversion and AI-provider reliability. Add cross-filtering and an agent that can answer questions such as "show me this week's completed payments" or "which quotes failed to convert?" The official challenge specifically encourages custom dashboard widgets, theming, layout tools and the AG Studio Agent Framework—not just a standalone table or chart.

Access: free 45-day AG Studio trial. Use the official PayPal + AG Studio starter to avoid a blank integration.

Sponsor page: https://paypalaihackathon.devpost.com/details/aggrid
Starter: https://github.com/paypaldev/hackathon-paypal-ag-grid-boilerplate
Quick start: https://www.ag-grid.com/studio/react/quick-start/

Sponsor prizes: $5,000 first, $2,000 second, and three $1,000 third-place awards.

### Render — background workflows and $50 credits
Claim the $50 participant credit offer. Keep the live customer app on Vercel; do not migrate hosting during the final week. A useful Render Workflows addition would be retryable post-payment processing: receipt generation, event reconciliation, notifications and daily summaries. This is separate from the immediate PayPal capture response.

Credits and details: https://paypalaihackathon.devpost.com/details/render
Workflow docs: https://render.com/docs/workflows

### KERNEL — cloud-browser demo QA and $50 credits
Claim the $50 participant credits. Use a remote real Chromium browser to run repeatable synthetic end-to-end checks of the deployed request → quote → owner approval → PayPal Sandbox flow, record the session and test desktop/mobile viewports. Do not expose the owner approval code in browser scripts and do not automate live payments.

Credits and docs: https://paypalaihackathon.devpost.com/details/kernel
Docs: https://www.kernel.sh/docs

### Elastic — searchable payment and quote audit
Use Elasticsearch hybrid/vector search over verified PayPal webhook events and, once implemented, persisted quote records. A meaningful agent could answer "find similar payment failures" or "summarize refunded transactions" using indexed, verified events. There is a 14-day trial with an extension option for 30 more days; Elasticsearch can also be run locally for free. Avoid making the deployed demo depend on a trial that expires.

Sponsor page: https://paypalaihackathon.devpost.com/details/elastic
Local download: https://www.elastic.co/downloads/elasticsearch

### Astropods — agent runtime and observability
Astropods provides agent deployment, tools, knowledge bases, traces and runtime guardrails. It is useful if DealBridge evolves into a longer-running workflow agent—for example, quote follow-up, status monitoring and payment-event triage. This overlaps with the current Vercel setup, so use it as a controlled prototype rather than adding a second production runtime before the deadline.

Free account and docs: https://docs.astropods.com
Sponsor page: https://paypalaihackathon.devpost.com/details/astropods

### Bryntum — post-approval delivery scheduling
A Bryntum Gantt/Scheduler could show delivery phases and resources for approved work. A compelling PayPal-specific rule is that a milestone is released only after the linked PayPal payment is confirmed; a failed or refunded payment flags dependent work. This needs persistent job data first, so it is a follow-on feature rather than a cosmetic calendar.

Bryntum offers a 45-day trial. Scheduler example install:
 
```bash
npm install @bryntum/scheduler@npm:@bryntum/scheduler-trial
```

Sponsor page and downloads: https://paypalaihackathon.devpost.com/details/bryntum

## Priority before submission

1. Add OPENROUTER_API_KEY to Vercel and verify Gemini → OpenRouter fallback.
2. Claim Channel3's 20,000 searches, add CHANNEL3_API_KEY to Vercel and test product research.
3. Import and run the Postman collection against PayPal Sandbox.
4. Install the APIMatic PayPal Context Plugin and review the PayPal endpoints.
5. Claim the AG Studio and Bryntum 45-day trials if there is enough time to integrate a real dashboard or delivery schedule. The trial windows can cover the judging period if activated before submission, but confirm trial terms with the sponsor.
6. Claim Render and KERNEL credits. Add a Render workflow or Kernel browser test only when it can be demonstrated reliably.
7. Consider Elastic and Astropods after the high-value features above; avoid duplicated infrastructure.

## Important judging and access notes

The official rules require a meaningful PayPal integration and meaningful AI use, and allow these sponsor tools as optional additions. Sponsor cash prizes include AG Grid, APIMatic, Bryntum and Channel3; Render awards Render credits. The rules allow a project to win up to one Grand Prize plus one Sponsor Prize, or one Honorable Mention plus one Sponsor Prize. Tool access, credit eligibility, trial duration and payouts remain subject to each sponsor's official terms.

Official challenge: https://paypalaihackathon.devpost.com/
Official rules: https://paypalaihackathon.devpost.com/rules
