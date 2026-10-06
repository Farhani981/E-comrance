# Product variants

The existing `product_attributes` table is the attribute catalog. New relational tables are `attribute_values`, `product_attribute_values`, `product_variants`, and `variant_attribute_values`. Product and order JSON fields retain display snapshots; variant option relations enforce attribute/value ownership. `variantSchema.js` applies additive, retryable migrations before API requests. Existing products are not automatically converted or assigned duplicated stock.

Admin flow: Products → Add/Edit → select attributes → Generate variants (or Set up individual variants on an existing product) → enter image, unique SKU, regular price, optional sale price and stock for every combination → save. New variants start with zero stock. Updating combinations preserves matching rows; removed combinations become inactive. A maximum of 200 combinations is accepted. A product without options can use one default variant.

POST/PUT `/api/products` accepts `variants` alongside the existing `attributes` payload. Each row contains `options: [{attributeId, label}]`, `sku`, `imageUrl`, `price`, `salePrice`, `stockQuantity`, and `isActive`. Existing rows also return `id` and `originalStockQuantity`; sending the latter protects against overwriting stock changed since the editor loaded. Saving is transactional and preserves variant IDs. GET product responses contain `hasVariants` and `variants`.

The product's price/image summarize the cheapest active variant; stock is the sum of active variant stock. The customer product page uses the selected combination's image, price, discount and stock. Carts send `productVariantId`. Quotes use server prices and aggregate repeated variant quantities. Orders persist variant IDs, SKU and option snapshots; stock deduction and order creation use the same transaction. Cancellations and returns restore the purchased variant's stock.

General inventory adjustments and purchase invoices currently support products without variants. Edit variant quantities in the product matrix; these legacy operations reject variant products rather than changing only aggregate stock. Historical cart entries without a variant ID must be removed and added again after a product is converted. Existing historical order items are not assigned an invented variant.

Tests (from `server`, with the configured local database):

```powershell
node --test tests/variants.test.js tests/productAttributes.test.js tests/attributes.test.js tests/operations.test.js
$env:RUN_DB_TESTS='1'
node --test --test-concurrency=1 tests/variants.integration.test.js tests/productAttributes.integration.test.js tests/operations.integration.test.js
```

Database tests roll back their fixture transactions; additive schema migrations persist.
