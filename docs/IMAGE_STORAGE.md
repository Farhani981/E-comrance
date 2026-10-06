# Product and order image handling

## Root cause and storage

ShopHub stores HTTP(S) URLs, local paths, and base64 data URLs as text in MySQL. There is no dedicated binary upload endpoint or object storage service: the browser processes files and submits image references through product/variant APIs.

The schema defined `order_items.image` as `TEXT` (65,535 bytes), while product and variant images could exceed that capacity. Checkout copied those images into order items, causing strict SQL inserts to fail. The database integration test reproduces this failure before widening the column.

These fields now consistently use `LONGTEXT`:

- `products.image`
- `product_variants.image_url`
- `order_items.image`

The idempotent migration runs during database initialization and variant-schema readiness. It widens columns without rewriting or deleting their contents. The local database was verified with all three fields already widened; running the migration again preserved record counts, image byte totals, and aggregate checksums.

## Limits and validation

- Original browser upload: maximum **5 MiB**, nonempty JPEG, PNG, WebP or GIF.
- Browser processing: decode the actual image, resize to the configured maximum dimension (default 1600 pixels), encode JPEG, reduce quality and then dimensions as necessary.
- New embedded image stored by product/variant APIs: maximum **512 KiB decoded**. Base64 expands this to approximately 683 KiB, below the local MariaDB server's 1 MiB `max_allowed_packet`.
- Backend checks: supported MIME type, base64 encoding, decoded byte limit, and file signatures/structural markers. Browser uploads additionally require successful image decoding. Signature checks are not a complete server-side image decoder.
- References: HTTP(S) URLs or root-relative paths, maximum 2048 characters. Remote URLs are not fetched or checked for availability by the server.
- Existing unchanged product/variant images are retained even when larger than the new limit; backend comparisons use existing database values. Replacements must pass validation.

The existing canvas/JPEG approach is retained without adding dependencies. It does not preserve GIF animation or image transparency.

## Checkout and history

Checkout, quote and payment-intent requests send item IDs and quantities instead of copying images and variant arrays from browser state. Backend pricing and selection remain authoritative.

Order creation uses `INSERT ... SELECT` to copy the selected product/variant image directly into the order snapshot. This avoids sending large image parameters back to MySQL and retains historical images if a product later changes. Existing order URLs and base64 images continue to be returned by the history API. No existing image data is deleted.

## Validation results (2026-09-13)

From `server`:

```powershell
node --test --test-isolation=none tests/auth.test.js tests/jwtConfig.test.js tests/variants.test.js tests/operations.test.js tests/banners.test.js tests/images.test.js
# 39 passed, 0 failed

$env:RUN_DB_TESTS='1'
npm run test:images:db
# 6 passed, 0 failed
```

The database suite uses connection-local temporary tables and disables outgoing email. It covers the old TEXT failure, repeated migration and byte preservation, maximum-size product and variant image checkout, server-selected images, and existing URL/base64 order history. Image unit tests cover normal and large images, invalid MIME/content/references, upload and embedded-size limits, unchanged legacy variants, and compact checkout payloads.

From `my-app`, `npm run lint` completed with existing warnings and `npm run build` passed with a large-bundle warning. The build and JWT startup subprocess test required execution outside the process-restricted sandbox. Browser canvas compression was reviewed and built, but was not exercised by a browser automation test.

## Files changed for Task 05

- `shared/images.js`, `shared/checkout.js`, `shared/variants.js`
- `server/schema.sql`, `server/config/db.js`
- `server/utils/imageSchema.js`, `server/utils/variantSchema.js`, `server/utils/variants.js`
- `server/routes/productRoutes.js`, `server/routes/orderRoutes.js`
- `server/tests/imageFixtures.js`, `server/tests/images.test.js`, `server/tests/images.integration.test.js`
- `server/package.json`
- `my-app/src/component/ImageUploadInput.jsx`
- `my-app/src/pages/Checkout.jsx`, `my-app/src/pages/StripeCheckoutForm.jsx`
- `my-app/src/pages/admin/ManageProducts.jsx`
- `docs/IMAGE_STORAGE.md`

## Remaining limits

Existing snapshots still consume database space because this architecture stores embedded images. External storage would require a separate migration and service. Remote image links can become unavailable. Already-corrupted historical images cannot be reconstructed without an intact source or backup. Deployments must restart the updated backend with permission to widen the image columns.
