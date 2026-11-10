# Rebound Stripe Marketplace integration

## Status
Version 0.1.0 uploaded and approved for external testing. This is not Marketplace listing approval. New live installations remain disabled until the sandbox round trip and review are complete.

## Product
Rebound finds failed Stripe subscription invoices within a selected date range. A user explicitly starts each recovery run. For each invoice, the service tries each distinct eligible saved card once in that run, stopping on payment, exhaustion or an uncertain outcome that needs review. Installing or opening the app never starts collections.

14-day trial, then USD 50/month or USD 500/year. Existing server-side billing gates apply to recovery endpoints and running batches.

## Installation
Public entry: https://app.reboundmrr.com/stripe/install
Callback: https://app.reboundmrr.com/stripe/callback
App identifier: com.reboundmrr.rebound
Stripe app object: app_61VjiZS08WnVk35p141EuNVUJyCmUNLU

App authentication uses Stripe Apps OAuth v2, not Connect OAuth. Test-mode, live and managed-sandbox publisher credentials are separate. Do not substitute restricted keys or Rebound Billing credentials. Test-channel links are not public launch links.

## Controls
- Random, hashed, single-use OAuth state bound to the signed-in Rebound user; ten-minute expiry.
- Tokens encrypted with AES-256-GCM and per-workspace authenticated context.
- Token rotation uses a database lease; ambiguous refresh outcomes require reconnection.
- The connection is checked before each Stripe operation; connection changes invalidate staged runs.
- Signature-checked raw webhooks separate live/test/sandbox environments.
- Uninstall or deauthorization clears tokens and requests running batches to stop. A request already sent to Stripe may finish.
- Local disconnect stops Rebound access. Uninstall in Stripe Apps removes Stripe-side permission.
- No card numbers or CVC are requested or stored by Rebound. Stripe-hosted tokens identify saved cards.

## Permission rationale
Customer/subscription/payment-method/payment-intent/charge reads support invoice discovery and eligible-card selection. Invoice write is Stripe's bundled permission needed to pay an existing invoice; app code does not create or void invoices. Event read supports installation lifecycle notifications. No payouts, transfers, refunds or card-edit permissions are requested.

## Review checklist
1. Complete a sandbox install through Rebound's sign-in and consent flow.
2. Confirm account and environment in settings; opening Collections must not create a charge.
3. Use synthetic failed invoices and multiple test cards; start a run deliberately. Check one attempt per distinct eligible card, stopping on success.
4. Disconnect and uninstall; confirm access stops, tokens clear and webhook delivery succeeds.
5. Confirm expired trial blocks collection; billing remains separate from merchant account authorization.
6. Publish actual support/privacy URLs and use only synthetic data in listing screenshots.
7. Prepare listing and submit for Stripe review. Do not describe external-test approval as public approval.

## Configuration
See backend/services/stripeAppConnection.js and backend/routes/stripeApp.js. Publisher keys, webhook secrets and the vault key belong only in the backend host's secret settings. Never commit them. Keep STRIPE_APP_LIVE_INSTALL_ENABLED=false while testing.

## Observed external test — November 10, 2026
- Separate synthetic Rebound workspace; connected ordinary Stripe Sandbox acct_1UaEPAIiCZhWCeVy.
- Stripe consent, OAuth callback and encrypted connection persistence completed; mode correctly stored as sandbox.
- Collections scan completed with zero test payments and no charges.
- Uninstalled through Stripe Dashboard; the lifecycle notification changed Rebound status to disconnected and hasConfiguredStripe=false.
- Evidence: reports/stripe-marketplace under the parent workspace (connected and disconnected screenshots).
- 81 backend tests and 54 frontend tests passed. Website build validated 36 pages and all internal links.
- This does not claim an end-to-end multi-card collection against real invoices or Marketplace approval.
