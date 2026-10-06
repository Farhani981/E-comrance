# Task 04 — Payment success / order failure recovery

## Issue found

The old browser flow confirmed a Stripe PaymentIntent first, then posted customer/cart details to `/api/orders`. That second request could fail after payment because of a database outage, stock changes, price/coupon changes, a closed browser, or a lost response. No durable checkout snapshot existed before the charge. The existing unique payment receipt prevented duplicate receipts, but an already-used payment returned an error rather than its existing order.

## Final flow

1. Before payment initialization, the browser saves a random checkout ID and a random recovery key. No card details, password, or Stripe client secret is saved in browser storage.
2. The backend validates customer fields, resolves current products/variants, and calculates the quote using existing pricing, coupon, shipping and currency rules. It saves the customer details and authoritative commercial snapshot in MySQL **before** creating a Stripe PaymentIntent.
3. One stable Stripe idempotency key belongs to that checkout. Retries reuse the saved PaymentIntent and immutable quote. The client secret is returned only after the provider reference is persisted.
4. Stripe.js confirms the actual card payment. A browser recovery request, signed Stripe webhook, or backend recovery worker can then finalize the same checkout.
5. The backend retrieves the PaymentIntent from Stripe and checks `succeeded`, the checkout metadata, currency, and amount received against the saved quote. Browser success flags and replacement prices/customer details cannot finalize a different order.
6. The verified `paid_pending` state is saved independently. A separate database transaction locks the checkout, checks its existing order/payment receipt, creates the order and item snapshots, records the unique receipt, deducts stock, updates the authenticated cart, and links the checkout to the order. These writes commit together or all roll back.
7. Every retry for that checkout/payment returns the same persisted order ID. Stock is deducted only by the first committed transaction. Order images are read back from stored order items for the confirmation response.
8. If fulfillment/database work fails, the paid checkout and original customer/quote remain available. The browser offers recovery without a new charge; the backend worker retries; administrators can inspect the recovery queue and saved details.

COD still calculates a fresh authoritative quote and uses the same shared order persistence transaction. Card recovery uses the authoritative quote saved **before payment**, so subsequent product-price or coupon changes cannot make an already-paid amount mismatch a newly calculated order total. Card references cannot be submitted through the COD path.

## Persistence and idempotency

New additive `payment_checkouts` table:

- `id`: random checkout UUID primary key.
- `recovery_hash`: SHA-256 hash of the separate random browser recovery key.
- `user_id`: authenticated customer identity when present; never taken from the request body.
- `snapshot`: customer details plus the authoritative quote, product/variant IDs, quantities, names, SKU/options and commercial amounts. Large image copies are omitted.
- `payment_intent_id`: unique Stripe reference.
- `order_id`: unique linked order; foreign key restricts deleting the linked order and losing its idempotency record.
- `state`, `last_error_code`, `attempts`, `next_attempt_at`, creation/update timestamps.

The existing `order_payment_receipts(transaction_id PRIMARY KEY, order_id UNIQUE)` remains the payment-to-order uniqueness constraint. Checkout row locks serialize concurrent browser callbacks, webhook deliveries and worker attempts. No financial uniqueness relies on browser state alone.

The provider-create/database-save gap is handled by the stable Stripe idempotency key and `checkout_id` metadata. A verified webhook can restore a missing local PaymentIntent reference. An uncertain initialization older than 23 hours requires review rather than risking a fresh create after provider idempotency retention. Stripe documents that reused keys can create a new request after they are pruned following their retention period: [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests).

## APIs and recovery UI

| API | Behavior |
| --- | --- |
| `POST /api/orders/create-payment-intent` | Save validated checkout, then create/reuse Stripe intent; optional JWT binds account |
| `POST /api/orders/payments/:id/reconcile` | Recovery-key/account-authorized verification and idempotent fulfillment |
| `POST /api/orders` with card method | Uses the same recovery implementation; requires checkout reference/key |
| `POST /api/orders/payments/:id/resume` | Authorized retrieval of the same intent/client secret |
| `POST /api/orders/payments/:id/cancel` | Clears an unpaid flow only after Stripe confirms cancellation; a succeeded intent is reconciled instead |
| `POST /api/orders/stripe-webhook` | Raw-body Stripe signature verification; handles `payment_intent.succeeded`; failures return non-2xx for redelivery |
| `GET /api/orders/payments/admin/pending` | Admin-only paginated unresolved queue, excluding confirmed cancellations |
| `GET /api/orders/payments/admin/:id` | Admin-only saved checkout details |
| `POST /api/orders/payments/admin/:id/reconcile` | Admin-only safe reconciliation |

Checkout shows a persistent recovery screen before its empty-cart view, so an already-consumed cart cannot hide recovery after refresh. It blocks starting another payment until the earlier flow is resolved. Authenticated recovery requires both its recovery key and the original account. Guest recovery requires the secret recovery key. Failure messages never imply a refund.

The Admin Panel now has **Payment Recovery** at `/admin/payment-recovery`, with state, Stripe reference, issue code, saved customer/items, and safe retry. Paid orders do not silently disappear into an error alert.

The backend runs a recovery batch on startup and every 60 seconds. It processes up to 25 due records, prioritizes known paid checkouts, and normally retries unresolved attempts after five minutes. This requires the backend process to be running; persisted records survive its restart. Multiple instances remain safe through database locks/unique references and Stripe idempotency.

## Stripe setup

The server's Stripe key is present in the current local configuration. `STRIPE_WEBHOOK_SECRET` is **not currently configured**. Its blank entry and setup comment were added to `server/.env.example`; no real secret was added to source control.

Register the backend's public HTTPS `/api/orders/stripe-webhook` endpoint for `payment_intent.succeeded` and put that endpoint's matching signing secret in the private server environment, then restart the backend. The route is mounted before JSON middleware so signature verification receives the unmodified body, following [Stripe's webhook requirements](https://docs.stripe.com/webhooks?lang=node). Until configured, that endpoint fails safely with 503; the database recovery worker and authorized browser retries remain available.

The cancellation path is not a refund flow. It requires the provider's actual canceled result; Stripe restricts cancellation by PaymentIntent state: [Stripe cancellation API](https://docs.stripe.com/api/payment_intents/cancel).

## Tests and results

Added `server/tests/paymentRecovery.test.js`, exercising:

- Browser reference persistence across retry/refresh and failure before charging if browser storage fails.
- Successful payment and real SQL order creation.
- Unconfirmed/failed payment without an order or stock deduction.
- Repeated initialization using one provider idempotency key.
- Three concurrent finalize requests returning one database order.
- Duplicate payment receipt rejection by MySQL.
- Injected database failure after one item's stock changed: order, receipt and stock all roll back; paid recovery state remains.
- Retry after that failure, including a product-price change, honoring the saved paid quote.
- Signed webhook without a browser; repeated events and browser requests deduct stock once.
- Invalid webhook signature rejection.
- Missing local provider-reference repair and recovery after stock shortage.
- Recovery-key/account authorization and admin-only queue/details.
- Background reconciliation without browser or webhook delivery.

Updated the existing image/pricing integration test to initialize a complete saved checkout, retain its payment reference, expect payment mismatches to enter review, and verify that frontend total manipulation after payment cannot alter the persisted paid amount. Real order-image and pricing assertions remain intact. Its temporary recovery table is isolated from application data.

Commands: `npm run test:all:isolated` in `server`; `npm run lint` and `npm run build` in `my-app`. The complete SQL suite uses a newly created disposable database removed afterward. Stripe network methods are isolated test doubles; production code has no fake-success path, and no real charge was made during testing. Webhook signatures use the Stripe SDK's signing/verification functions.

Final full-suite result: **130 passed, zero failures/skips**. Lint/build passed; existing lint warnings and the approximately 754 kB main-bundle warning remain. One run passed all assertions but a Windows Node banner-test worker crashed at teardown with `UV_HANDLE_CLOSING`; that output is preserved in `TASK04_TEST_RETRY.txt`, and the complete suite was rerun unchanged. Final outputs are in `TASK04_TESTS.txt`, `TASK04_LINT.txt`, and `TASK04_BUILD.txt`.

## Files changed

New:

- `server/utils/paymentSchema.js`
- `server/utils/paymentRecovery.js`
- `server/utils/orderPersistence.js`
- `server/routes/paymentRoutes.js`
- `my-app/src/utils/paymentRecovery.js`
- `my-app/src/pages/admin/PaymentRecovery.jsx`
- `server/tests/paymentRecovery.test.js`

Updated:

- `server/routes/orderRoutes.js`
- `server/config/db.js`
- `server/utils/variantSchema.js`
- `server/server.js`
- `server/.env.example`
- `my-app/src/pages/Checkout.jsx`
- `my-app/src/pages/StripeCheckoutForm.jsx`
- `my-app/src/context/CartContext.jsx`
- `my-app/src/App.tsx`
- `my-app/src/layout/AdminLayout.tsx`
- `server/tests/images.integration.test.js`

Documentation: this report and its four test/lint/build/retry evidence files.

## Remaining operational concerns

- Configure the Stripe webhook signing secret and endpoint as described above; live provider delivery was not exercised here.
- Stock is validated before payment and deducted during order finalization, not reserved indefinitely. If paid goods become unavailable, their checkout remains visibly paid/pending until stock/fulfillment is resolved. If fulfillment is impossible, an administrator must arrange an actual provider-confirmed refund; this implementation does not invent one.
- Historical payments created before this durable workflow lack the saved checkout snapshot. They require review against Stripe and existing order records; missing historical customer/cart data cannot be reconstructed safely.
- Confirmation email remains best effort after commit; an email failure cannot undo the paid order. This is not an email-delivery outbox.
- The worker needs backend uptime and the unresolved queue needs operational attention. Browser visual automation and live Stripe card charging were not run.
