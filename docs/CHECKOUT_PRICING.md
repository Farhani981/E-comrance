# Task 06: consistent cart, checkout, payment and order pricing

## Previous inconsistency

Cart calculated prices from browser state, charged 10 shipping with free shipping above 50, displayed a dollar sign for shipping beside rupee totals, and did not apply backend promotions. Checkout already requested a database-backed quote with PKR 200 shipping and free shipping above PKR 2,000. Confirmation details were copied from frontend state, and orders stored only the final total, without a pricing breakdown.

The unused legacy `paymentRoutes.js` accepted a client-supplied amount directly. Its handler now delegates to the same authoritative payment-intent handler as orders, so mounting the legacy path cannot introduce a second calculation rule.

## Source of truth and preserved business rules

`server/utils/operations.js`: `quoteCart` loads current product prices, selected variant sale prices (or regular variant prices), stock and active promotions from MySQL. `calculateQuote` produces the sole pricing breakdown.

1. Subtotal: database unit prices in integer paisa multiplied by validated quantities.
2. Discount: best eligible automatic promotion or supplied valid coupon; discounts are not stacked. Product restrictions, dates, minimum spend and discount caps retain their existing behavior.
3. Shipping: PKR 200 unless the **pre-discount subtotal is strictly above PKR 2,000** or zero. Exactly PKR 2,000 still incurs shipping.
4. Tax: zero; the existing business rules add no tax.
5. Total: subtotal minus rounded discount plus shipping plus tax, calculated in integer paisa and returned both as `totalMinor` and `grandTotal`.
6. Currency: PKR, returned by the quote; Stripe receives the lowercase `pkr` representation and exactly `totalMinor`.

Client price, subtotal, discount, shipping, tax and currency do not determine the quote. Submitted payment/order totals are used only to reject a stale or altered checkout, never to set the payable amount. Confirmed card payments must match the recalculated total, currency and customer, and pass existing receipt-reuse checks.

## Frontend and persistence

Cart and Checkout share `useCartQuote`, sending only item IDs, variant IDs, quantities and coupon code. Pending/outdated quotes cannot enable checkout submission. Loading totals display placeholders. Cart includes the backend promotion discount. The applied coupon stays in CartContext when navigating between Cart and Checkout and clears when the cart is cleared.

Order creation recalculates under the existing transaction/row locks and stores `subtotal`, `discount_amount`, `shipping_amount`, `tax_amount`, `currency`, `coupon_code`, and authoritative `total_amount`. The response includes the authoritative quote and line prices, which Checkout passes to OrderSuccess. Existing order breakdown fields remain NULL because historical pricing details cannot be reconstructed reliably.

The additive migration runs through database initialization and API schema readiness. Local verification confirmed all new columns exist and that order count and summed historical totals were unchanged by the targeted migration check.

## Files changed

- `server/utils/operations.js`: authoritative currency and integer-paisa calculations.
- `server/routes/orderRoutes.js`: shared payment handler, currency/amount consistency, persisted breakdown and response quote.
- `server/routes/paymentRoutes.js`: legacy route delegates to the authoritative handler.
- `server/utils/orderPricingSchema.js`, `server/utils/variantSchema.js`, `server/config/db.js`, `server/schema.sql`: additive order breakdown schema.
- `my-app/src/hooks/useCartQuote.js`: shared backend quote loading and stale-response handling.
- `my-app/src/context/CartContext.jsx`: coupon shared across Cart and Checkout.
- `my-app/src/pages/Cart.jsx`: backend totals, promotions, PKR shipping and checkout readiness.
- `my-app/src/pages/Checkout.jsx`: shared quote hook, authoritative line prices and confirmation data.
- `server/tests/pricing.test.js`: shipping boundaries, currency, rounding, multiple products, variant sale pricing and untrusted client amounts.
- `server/tests/images.integration.test.js`: extends existing isolated SQL checkout coverage with quote/payment/order consistency and tampering rejection.
- `server/tests/runIsolatedDbTests.js`, `server/package.json`: runnable pricing/default/full isolated suites.
- `docs/CHECKOUT_PRICING.md`: this report.

## Tests and results

- `npm run test:pricing` in server: **6 passed**. Normal cart, multiple products, variant sale pricing, coupons, best-discount rules, shipping/free-shipping boundaries, zero subtotal, PKR and rounding.
- `RUN_DB_TESTS=1 npm run test:images:db`: **7 passed**. Uses connection-local temporary tables and mocked Stripe methods, with email disabled. Includes identical cart/checkout quotes, exact Stripe amount/currency, authoritative stored breakdown, rejected frontend total, rejected wrong payment currency and rejected one-paisa underpayment, plus prior large-image/history coverage.
- `npm test`: **47 passed, 3 failed, 7 opt-in skipped**.
- `npm run test:all:isolated`: **62 passed, 4 failed, 0 skipped**, including frontend catalog tests and all opt-in database suites. Disposable database removed after execution.
- Frontend `npm run lint`: exit 0, existing warnings.
- Frontend `npm run build`: passed, existing large-bundle warning.

The full-suite failures are two product-attribute normalization assertions and one storefront stock-normalization assertion documented in the earlier project review, plus `catalog.integration.test.js` failing with `SAVEPOINT catalog_test does not exist`. These unrelated behaviors were not modified.

Automatic approval review rejected running every opt-in suite against the configured application database. A disposable-database alternative was approved and completed. Initial test setup exposed the legacy schema's explicit `USE ecommerce_db`: the first setup invoked that legacy initializer before failing to find products in its empty test database. The final runner instead strips database-selection directives and initializes its own random database directly. The application initializer's existing database-selection behavior remains a separate concern.

## Limits

Stripe calls were mocked; no real payment was charged. The API flow was exercised, but browser navigation and display were not tested with browser automation. Quotes are refreshed on page entry and item/coupon changes; a price/promotion change between payment and order creation is rejected by the existing recalculation check, and there is no price reservation or automatic refund workflow added by this task. Deployments must run the updated backend/schema migration before accepting new orders.
