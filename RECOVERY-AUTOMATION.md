# Date-filtered subscription payment retries

Applying dates only reads Stripe. The date range uses failed charge dates in America/New_York, including both selected calendar days. Results retain subscription failures even when the invoice is now written off, blocked, voided, unavailable or paid. Repeated failures for one invoice appear in one row; distinct payment counts are shown separately to compare with Stripe. The Unresolved view excludes only invoices already paid; All failure history includes those too. After charge pagination, payment intents created in the selected range are scanned for failed-invoice cancellations without a Charge; the cancellation timestamp must also be in range. Unavailable invoice associations stay visible as unverified records, rather than being claimed as verified subscriptions. Genuine standalone payments are excluded. Pagination must complete before a run can start.

The account owner clicks **Retry filtered payments** to start one run of the displayed invoices explicitly marked Included in the retry run. Written-off, blocked, unavailable, voided, cancelled, processing and paid rows stay visible but have no signed collection token and cannot authorize a run. The server signs the selection, binds it to the user, Stripe key and dates, and rechecks the outstanding debt before each attempt. Changed currencies or increased balances are skipped.

Invoices are processed sequentially. For each invoice, the first/default card is included, then the remaining saved cards attached to that customer. Expired cards and duplicate physical card fingerprints are excluded. Each eligible card gets at most one submission per invoice in that run. A successful payment stops that invoice immediately. A confirmed decline or authentication requirement moves to the next card. Exhausting all cards stops that invoice and proceeds to the next invoice.

The tool pays the original invoice using Stripe invoices.pay; it never creates a replacement invoice or separate PaymentIntent. Unknown outcomes and processing payments stop that invoice for review instead of trying another card. Existing pending/uncertain attempts also prevent a new run from charging the same debt blindly.

There are no scheduled runs, startup workers, or automatic restarts. Only authenticated Start and Resume requests execute payments. Reloading the app reads progress. Stop prevents further submissions; a payment already submitted cannot be recalled. An interrupted run needs an explicit Resume click. Declined cards may be tried again only in a new, deliberately requested run after applying dates again.

A persisted attempt ledger, unique run/invoice/card index, account lease, runner fencing, and Stripe idempotency keys prevent duplicate submissions from repeated clicks or resumes. Attempts are recorded before Stripe submission. An interrupted pending submission is held for review. The original Stripe account's own configured retry policy is independent and has not been changed.

## Run preparation and table feedback

The Saved credit cards column replaces invoice status. Counts are loaded automatically from the customer's saved card payment methods, including expired cards in the total. A separate eligible count excludes expired cards and duplicate physical fingerprints, matching the retry runner. Counts are paginated, fetched with limited concurrency, and cached for two minutes per user/Stripe-key/customer. Unavailable reads show Unavailable rather than a false zero. The runner always reads cards again when attempting collection.

After a completed filter, the authenticated GET /api/payment-batches/ready checks the connected Stripe account and creates/verifies the collection and unique indexes required by the attempt ledger. It never calls a payment endpoint, starts a worker or launches a run. A failed readiness check keeps the collection button disabled.

A confirmed paid item turns its entire invoice row green and updates its displayed balance to zero. Successfully collected rows stay in the recovery queue for that run, including after reapplying the same dates. Historical paid invoices are also green in All failure history. A decline, processing state or unconfirmed result never receives the paid styling.

## Monthly collection traceability

The first-page monthly chart, its month labels and the month buttons open an authenticated, read-only list of that month's recorded recoveries. It intersects the selected month with the applied From/To dates and USD chart currency. Summary dates, grouping and payment timestamps consistently use America/New_York. The API scopes every record and aggregate to the authenticated user; a date/id cursor supports complete pagination with deterministic ordering.

The list shows customer, collection timestamp, actual collected amount, card brand/last four digits and links to the original Stripe payment. New manual collection records additionally retain the original invoice, subscription and retry run references. Missing historical invoice/card data is explicitly labelled as not recorded; old records are not fabricated or rewritten. Viewing history never invokes payment collection.

## Verification

Run `node --test backend/tests/*.test.js`, `CI=true npm test -- --watchAll=false --runInBand`, and `npm run build`.

All payment execution tests use fake Stripe clients and an in-memory ledger. They never charge customers.
