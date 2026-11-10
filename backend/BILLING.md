# Rebound subscriptions

One plan: USD 50/month, one 14-day trial per Rebound user. Stripe Checkout collects a payment method before starting the trial. Cancellation and payment-method changes use Stripe Customer Portal.

Merchant billing is separate from customer recovery credentials. Only the dedicated Rebound key is used for Checkout, subscriptions and portal access. No key belongs in the frontend or this repository.

Required backend environment:
- BILLING_ENABLED=true
- BILLING_MODE=live (test for an isolated sandbox)
- REBOUND_BILLING_ACCOUNT: Rebound merchant account
- REBOUND_BILLING_PRICE: active USD 5000/month recurring price
- REBOUND_BILLING_PORTAL: portal configuration
- REBOUND_BILLING_KEY: dedicated restricted server key
- REBOUND_BILLING_WEBHOOK_SECRET: signing secret
- BILLING_APP_ORIGIN=https://app.reboundmrr.com
- REBOUND_BILLING_ENFORCE=true

Webhook: POST /api/billing/webhook. Raw bytes and Stripe signature required. Subscribe to checkout.session.completed, checkout.session.async_payment_succeeded/failed, customer.subscription.created/updated/deleted/trial_will_end, invoice.paid/payment_failed/payment_action_required. Duplicate and out-of-order events refresh current Stripe state. Temporary failures return a retryable error. Reads never start collection.

The trial clock is the earliest Stripe trial start and is capped at 14 days. A returning subscriber gets no second trial. A paid subscriber requires active status and a paid invoice covering the current service period for this plan. Test subscriptions never grant live access. At start/resume the server refreshes Stripe; before each card it checks expiry/blocking and refreshes Stripe if older than 60 seconds. Failed verification denies further attempts. An already-submitted charge cannot be recalled.

Administrators manage subscribers at /admin: search, sync Stripe, block/restore recovery access, cancel at period end or keep renewing, and inspect the administrator action history. Blocking access does not cancel subscription billing. Administrator workspaces are exempt from the plan gate; explicit blocks apply to them too. Legacy Free/Premium flags do not grant customer retry access and their update endpoint is retired.

No automatic tax configuration has been applied. Tax registrations and commercial terms must be set by the business as applicable.

Checks: node --test backend/tests/*.test.js; CI=true npm test -- --watchAll=false --runInBand; CI=true npm run build. Never run real invoice retries to test subscription gating.
