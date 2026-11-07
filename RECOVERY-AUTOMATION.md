# Automatic saved-card fallback

The backend worker pays the original open subscription invoice with alternate attached saved cards. It never creates a replacement PaymentIntent or a new invoice. Viewing the dashboard and preview do not collect money.

## Activation

Fallback defaults to paused for every user. The account owner previews the connected Stripe account, confirms authority to collect on the saved cards, then enables the global switch. Pausing stops new attempts; an already-submitted payment cannot be recalled. Changing or removing the Stripe key pauses fallback and requires reactivation.

## Scope and stopping rules

Only attempted, open subscription invoices with an outstanding balance, automatic collection enabled, and an active/past-due/unpaid expanded subscription are eligible. Canceled subscriptions, paused collection, expired cards, cards attached to another customer, and duplicate card fingerprints are excluded. The card that already failed in Stripe is remembered and skipped. The worker defers when Stripe's own next attempt is within ten minutes.

Each alternate card gets at most one tool submission per invoice. Attempts are recorded before submission. A unique account/invoice/method index and an account lease protect concurrent workers. A deterministic Stripe idempotency key is a second safeguard; permanent MongoDB history remains the safeguard after Stripe expires its keys. Only an explicit card decline with a confirmed retryable PaymentIntent state allows the next card. Processing, authentication, API errors, uncertain outcomes, and interrupted pending submissions stop that invoice for review.

## Runtime

The Express process checks five open invoices per enabled account per minute while awake, using a persistent pagination cursor. A GitHub Actions hourly public-health check wakes the existing free Render service. The scheduled workflow has no repository permissions, customer data, or secrets. GitHub cron is not an exact-time guarantee; public-repository schedules can be disabled after inactivity. An always-on host is preferable for continuous production operation. The worker does not require an open browser.

## Verification

Run `node --test backend/tests/*.test.js`, `CI=true npm test -- --watchAll=false --runInBand`, and `npm run build`.

Payment execution tests use mocked Stripe clients and an in-memory ledger. They do not charge live customers. The production preview is read-only. Pending/uncertain/action-required attempts are deliberately not reset automatically; inspect the original invoice in Stripe before resuming such debt through a future explicit reconciliation flow.
