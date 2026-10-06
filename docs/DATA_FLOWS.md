# Data flows and business rules

> Current men?s taxonomy and mega-navigation: [Men?s catalog](MENS_CATALOG.md) supersedes older static/six-department category notes below.

> Catalog changes: see [Catalog navigation update](CATALOG_NAVIGATION.md). This supersedes the older catalog mapping, subcategory persistence, silent-save and navigation-filter observations below.

## Catalog loading and editing

[ProductContext](../my-app/src/context/ProductContext.jsx) initializes from localStorage or [sample data](../my-app/src/productsData.jsx), then requests products and categories once on mount. It maps API `name -> title`, `original_price -> originalPrice`, `category_name -> category/subCategory`, and `reviews_count -> reviewsCount`. It fabricates sizes, colors, features, and some numeric defaults when absent. The API schema does not persist most of those fields. The initial API mapping also omits SKU even though the API returns it.

Cached and newly added/updated products pass through category normalization rules. The API fetch uses its own mapping rather than the same normalizer. This can change filtering behavior after reload. `Number(stock) || 10` turns zero into ten in some paths while `inStock` can still be false.

Product creation waits for successful API confirmation before adding to context. Product updates and deletes modify context first, ignore HTTP failure responses, and swallow network failures. Category creation attempts the API but still appends locally on failure; updates/deletes also modify locally without rollback. Collections instead check response success before updating their local list.

## Shopping and checkout

```mermaid
sequenceDiagram
  participant U as Shopper
  participant C as CartContext
  participant P as Checkout
  participant A as Orders API
  participant D as Database
  participant E as SMTP
  U->>C: Add product / size / color / quantity
  C->>C: Persist browser cart
  U->>P: Submit shipping details and COD order
  P->>A: customer, items, totalAmount, userId, payment fields
  A->>D: Begin transaction
  A->>D: Insert order + item snapshots; decrement stock
  A->>D: Commit
  A->>E: Attempt confirmation email
  A-->>P: 201 + orderId
  P->>P: Add local receipt, clear cart, navigate with receipt state
```

[CartContext](../my-app/src/context/CartContext.jsx) identifies a variant by `${id}-${size || 'std'}-${color || 'std'}`. Repeated additions merge quantities. Updating to zero removes an entry. Removal also accepts a product ID, which can remove multiple variants. No inventory ceiling is enforced by the context.

Current price rules differ by screen:

| Source | Rule |
| --- | --- |
| Cart | Shipping 10 unless subtotal > 50 or subtotal is zero |
| Checkout | Shipping 200 unless subtotal > 2000 or subtotal is zero |
| Checkout coupon | `WELCOME10`, case-insensitive, applies 10% of subtotal |
| System settings UI | Defaults: shipping 250, free above 15000; not consumed by checkout |
| Navbar / policy copy | Advertises free shipping above 15000 |

The backend trusts client totals and line prices instead of recomputing them. An existing supplied `userId` is attached without authenticating its ownership. Unknown product IDs produce order-item snapshots with null product references. Inventory uses `GREATEST(0, stock - quantity)`, so insufficient stock does not reject an order. Size/color choices and separate shipping/discount values are not stored in SQL.

Order IDs use `ORD-` plus the last six timestamp digits, so collisions are possible. SQL creation status is `Pending`; `AuthContext.addOrder` sets the local receipt status to `Processing`. The success page reads router state and does not fetch a receipt. With no state it still shows generic confirmation.

## Card branch

`StripeCheckoutForm` requests a PaymentIntent using the browser total, confirms with `CardElement`, then calls the parent's order-save callback on `succeeded`. The callback posts `Paid` and a transaction ID. It is not awaited by the child. Payment success and SQL order creation are separate operations, so payment can succeed while order creation fails. There is no webhook, signature verification, server-side payment lookup, idempotency, refund, or reconciliation path. The frontend key is a placeholder and the mounted intent uses USD while the UI labels values as rupees.

## Status changes and tracking

Admin `PUT /api/orders/:id/status` accepts any member of the six-status enum, without enforcing a transition graph. The database update occurs before email delivery is attempted. The email uses the stored checkout email except for empty/legacy guest addresses, when it falls back to the linked account email. Email failure does not undo a saved order/status.

`/orders?order=ORD-...` selects an order from the authenticated user's fetched orders and displays a four-stage timeline; `Completed` maps to the delivered stage. It is not anonymous tracking. Guest orders with null `user_id` are not available through `/my-orders`. Cancellation does not restore stock, change payment state, or trigger a refund.

## Purchases and stock-in

[Admin routes](../server/routes/adminRoutes.js) compute invoice total as the sum of quantity times cost. Paid amount is clamped to at least zero; due is `max(0, total - paid)`. Payment status is Paid when paid >= total, Partial when paid > 0, otherwise Unpaid. A missing invoice number gets `PUR-` plus six timestamp digits. The UI normally sends its own `INV-` number.

A transaction inserts the invoice and its lines, increases both `stock` and `stock_quantity`, and updates product status. If an item is not yet in the catalog, the purchase form can create a zero-stock product through `POST /api/products`, automatically select it, and then use the purchase quantity as its opening stock. Numeric validation rejects non-finite costs, fractional/non-positive quantities, repeated products, missing products, invalid suppliers, and paid values outside the invoice total. Invoice edits apply the net quantity change per product; deletion reverses received stock and is rejected if available stock has already fallen below the amount being reversed. A dedicated payment endpoint recalculates due and payment status. Failures roll back invoice and inventory changes. A separate stock movement audit table is still not implemented. The purchase screen reloads its invoice data after mutations but does not refresh ProductContext stock.

## Customer accounting

The details API creates virtual debit rows from non-cancelled orders and unions them with persisted `customer_ledger` entries. It calculates lifetime spend from non-cancelled orders, adds totals of orders marked Paid/Completed to manual credits as `totalPaid`, then clamps balance due to zero. A manual payment inserts a credit without attaching an order or changing an order's payment status.

This is a simple customer balance display, not a reconciled accounting ledger: paid order credit equivalents are included in summary but not emitted as credit rows; duplicate manual credits can double-count a paid order, and stored manual debits do not increase the summary's lifetime spend. Customer-list `spent` includes cancelled orders while the details summary excludes them.
