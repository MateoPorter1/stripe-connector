# Rebound subscription billing — sandbox only

US testing does not require incorporation. A claimable Stripe sandbox was created November 10, 2026 and expires November 17 unless claimed. Claim it in Stripe; account activation and real payments are a separate later step. No live price or trial duration has been approved.

This implementation intentionally accepts only `BILLING_MODE=test` and test credentials. It never reads a user's recovery key or changes their existing plan/access. Test subscriptions are recorded in the separate BillingAccount collection, scoped by user and sandbox account. The $1 monthly test price is not launch pricing. Automatic tax is not enabled in this sandbox. Live billing requires a separate readiness review, approved pricing, merchant activation, tax decisions, and server-side access enforcement.

## Configuration

Store in backend environment or a secret manager, never frontend variables:

- BILLING_ENABLED=true
- BILLING_MODE=test
- REBOUND_BILLING_KEY: dedicated test restricted key with customers, products/prices, Checkout Sessions, subscriptions and customer portal permissions. Account read is needed to verify merchant identity.
- REBOUND_BILLING_ACCOUNT: the Rebound sandbox acct_ reference
- REBOUND_BILLING_PRICE: active, fixed monthly recurring test price
- REBOUND_BILLING_PORTAL: portal configuration with invoice history, card update and cancellation
- REBOUND_BILLING_WEBHOOK_SECRET: signing secret for this endpoint, not the API key
- BILLING_APP_ORIGIN: exact trusted frontend origin; localhost allowed only for local work

`node scripts/setupBillingSandbox.js` prepares a $1 monthly test product and portal and saves an ignored mode-0600 `.env.test.local`. It requires a suitable test key in REBOUND_BILLING_KEY. Do not overwrite an existing file. The generated local webhook secret is for local signature tests only; use the actual Stripe endpoint/listener secret when connecting real deliveries.

Load `.env.test.local` explicitly for local billing testing. `server.js` loads the normal `.env`; it does not silently activate subscription tests. Never copy a customer recovery key into the billing configuration.

## Routes and confirmation

Authenticated GET /api/billing, POST /checkout, POST /confirm, POST /portal. Session success/cancel returns to /billing. Redirects alone never activate a subscription. Confirmation verifies the session's customer, user reference, subscription mode and test mode, then reads current subscriptions from Stripe.

Unauthenticated POST /api/billing/webhook uses the raw request body and verifies Stripe-Signature before processing. Subscribe to checkout.session.completed, checkout.session.async_payment_succeeded/failed, customer.subscription.created/updated/deleted, invoice.paid, invoice.payment_failed and invoice.payment_action_required. Events for unknown customers do not create users. Live or connected-account events are rejected. Duplicate and out-of-order delivery converges through current Stripe state under an account lock; a temporary error is returned for retry. No card details are stored locally.

## Validation

Run `node --test tests/billing.test.js`. Build React with `npm run build` from the app root. Exercise hosted checkout with Stripe test cards, confirm initial payment, check failed payment, portal cancellation at period end, duplicate checkout protection, rejected signatures and ownership checks. The billing SDK is installed under the `stripe-billing` alias so this new integration does not upgrade the recovery engine's older Stripe SDK.
