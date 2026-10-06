# Core operations

The admin sidebar now includes `/admin/inventory`, `/admin/reviews`, `/admin/returns` and `/admin/coupons`.

## Setup

Restart the backend after updating. `server/config/db.js` loads `server/operations-schema.sql` during normal database initialization. The additive operations tables have also been created in the current local database. No demo records are seeded.

Card checkout requires a backend `STRIPE_SECRET_KEY` and frontend `VITE_STRIPE_PUBLIC_KEY`. Restart Vite after changing its environment. Card intents now use PKR and the server-calculated cart total; the saved order checks the confirmed payment's amount, currency and customer email. See [Stripe PaymentIntent retrieval](https://docs.stripe.com/api/payment_intents/retrieve). Live card payments were not exercised during development.

## Behavior

- Inventory shows low stock at or below a configurable threshold, SKU editing, warehouse assignments and the latest 100 stock adjustments. Each SKU has one warehouse; this does not split a product's stock across multiple locations. Adjustments are transactional, reject negative resulting stock, and store an actor and reason. An assigned warehouse cannot be deleted.
- Signed-in customers submit one review per product. Pending and rejected reviews are private. Admin approval, edits and deletion update the product's rating and review count. Product detail reads approved reviews from the API.
- Customers and admins can cancel pending/processing orders. Cancellation restores stock once and puts paid orders into the refund queue. Cancelled orders cannot be reopened through the existing status endpoint.
- Returns cover whole orders. Customers request returns from order history; admins approve/reject them, mark all units received, and record a completed refund. Receipt restores stock once. Refund recording requires a paid order, an amount no greater than its total, and an external refund reference. **Issue the actual refund using the payment provider/bank first: the admin form records that completed transfer, and does not send money.** One return and one completed refund record are supported per order; item-level and multiple partial refunds are not implemented.
- Promotions support percentage/fixed discounts, optional coupon codes, product targeting, minimum cart spend and schedules. Blank codes are automatic checkout offers. Dates use server local time. Checkout applies the single best eligible offer without stacking. The server recomputes product prices, stock availability, discounts and shipping when saving an order. Product-targeted rules apply to that product's subtotal. Coupons no longer rely on the hard-coded `WELCOME10` code.
- Guests may check out, but authenticated customers must send their token to link new orders to their account. Guest return requests can be entered by an admin.

## API

All endpoints below are under `/api/operations`.

| Endpoint | Access | Purpose |
| --- | --- | --- |
| POST `/quote` | Public | Validate items/coupon and calculate totals |
| GET `/reviews/product/:id` | Public | Approved product reviews |
| POST `/reviews/product/:id` | Signed in | Submit a review |
| GET/POST `/my-returns` | Signed in | Own return requests |
| POST `/orders/:id/cancel` | Owner/admin | Cancel eligible orders |
| GET `/inventory` | Admin | Products, warehouses and adjustment history |
| PUT `/inventory/:id` | Admin | SKU, threshold and warehouse |
| POST `/inventory/:id/adjust` | Admin | Stock delta and reason |
| POST `/warehouses`, PUT/DELETE `/warehouses/:id` | Admin | Warehouse management |
| GET `/reviews`, PUT/DELETE `/reviews/:id` | Admin | Moderation |
| GET/POST `/returns`, PUT `/returns/:id` | Admin | Return/refund workflow |
| GET/POST `/promotions`, PUT/DELETE `/promotions/:id` | Admin | Coupon and automatic offer management |

## Verification

From `server`, run `node tests/operations.test.js` for discount and input-validation tests. For the integration suite, set `$env:RUN_DB_TESTS = '1'` in PowerShell and run `node tests/operations.integration.test.js`. It uses the configured database and the operations schema; fixture data is enclosed in a transaction and rolled back. It does not send emails, charge cards or transfer refunds. The suite checks admin access, inventory adjustments, warehouse assignment, promotions, review publication, return transitions, refund limits and repeat cancellation/receipt protection.

From `my-app`, run `npm run build` for TypeScript and the production bundle.
