# Task 11: Cart and wishlist persistence

## Result
Guest shopping remains in localStorage. Authenticated carts and wishlists now persist in MySQL, scoped to the user resolved by existing JWT middleware. No frontend user ID, price, stock, SKU or image is trusted for saved cart values. Checkout still quotes database prices and stock independently.

## Storage and API
- customer_shopping: user_id primary/foreign key, cart JSON (product ID, optional variant ID, quantity), wishlist JSON (product IDs), updated_at.
- shopping_merge_receipts: composite user/kind/merge ID key makes repeated guest merges idempotent.
- GET /api/shopping/cart and /wishlist return current database product data.
- POST to the same endpoints accepts add, remove, clear, merge; cart also accepts set. Both require authentication and ignore submitted user identities.
- Existing startup/API schema readiness creates the two tables additively. No product, order or image data is deleted. Local database metadata confirms both tables exist.
- Explicit invalid quantities, unavailable products/variants and overstock additions/updates fail without changing saved state. Login/load reconciliation combines duplicates, drops unavailable references and clamps quantities to current stock. Maximum 200 distinct saved items.

## Frontend
Guest cart/wishlist storage is separate from authenticated state. Login sends only IDs/quantities and a stable merge UUID; the browser clears guest storage only after a successful acknowledgement. Failures retain it for retry. Signed-in changes use the API; requests are serialized and stale responses from a different session are ignored. Cart/wishlist/checkout display loading or synchronization errors, with retry. Cart displays merge adjustments. Product feedback waits for successful addition, and moving a wishlist item removes it only after cart addition succeeds.

Successful authenticated orders subtract purchased quantities from the saved cart inside the order transaction, preserving unpurchased items. The frontend then refreshes the saved cart. Logout does not copy authenticated items into guest localStorage.

## Files
Backend:
- server/utils/shopping.js (new)
- server/routes/shoppingRoutes.js (new)
- server/config/db.js
- server/utils/variantSchema.js
- server/server.js
- server/routes/orderRoutes.js
Frontend:
- my-app/src/utils/shopping.js (new)
- my-app/src/hooks/useShoppingStore.js (new)
- my-app/src/context/CartContext.jsx
- my-app/src/context/WishlistContext.jsx
- my-app/src/pages/Cart.jsx
- my-app/src/pages/Checkout.jsx
- my-app/src/pages/Wishlist.jsx
- my-app/src/pages/ProductDetail.jsx
Tests:
- server/tests/shopping.test.js (new)
- server/tests/images.integration.test.js
Documentation: this report and TASK11_TESTS.txt, TASK11_LINT.txt, TASK11_BUILD.txt.

## Validation
Previous complete suite: 98 passing. Final complete suite: 107 passing, 0 failing, 0 skipped.
Command: npm run test:all:isolated (server). All SQL tests ran against a newly created disposable database, removed afterward.
Coverage includes guest storage and receipt retries; authenticated cart; duplicate/login merge; current product and variant prices/SKU/stock; invalid and overstock quantities; inactive variants; out-of-stock removal; fresh-token login persistence; user isolation; wishlist persistence; purchased quantity removal. Existing real order integration tests also verify saved cart consumption for both product and variant orders.
Frontend lint: exit 0; existing repository warnings remain. No warnings in the new shopping hook/utilities.
Production build: exit 0; existing large-bundle warning remains (approximately 743 kB main JS).

## Limits
Cart stock validation does not reserve inventory; checkout remains the final authority. Updates from another device appear on the next load or mutation; there is no realtime cross-device push. Browser UI end-to-end automation was not run; automated coverage exercises storage helpers and actual authenticated Express/MySQL APIs.
