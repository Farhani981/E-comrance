# Task 09 — persisted business settings

## Inspection and scope

SystemSettings used React state with hardcoded values. Its Save handler only displayed success; none of that page's settings were persisted. The backend already supported promotions, per-product inventory thresholds, PKR quotes/orders, COD, and environment-configured Stripe. There was no store settings table.

| Setting | Previous support | Result |
| --- | --- | --- |
| Store name/tagline, contact email/phone, WhatsApp, address | Local form values and hardcoded storefront text | Persisted; used by storefront branding/contact displays |
| Logo | Inactive upload button, bundled storefront logo | Existing image upload component saves a validated reference; bundled logo remains fallback |
| Currency | Local PKR/USD selector; real prices/payment logic used PKR | Persisted PKR; other currencies rejected because no conversion model exists |
| Shipping fee/free threshold | Local 250/15000; real backend used 200/2000 | Persisted, defaults preserve real backend 200/2000; quotes/payment/orders read current settings |
| Delivery estimates/city list | Local preview; no fulfillment rules | Remain explicitly marked read-only previews; not saved as shipping restrictions |
| Low-stock threshold | Local 10; inventory backend already used per-product overrides with default 5 | Persisted inventory warning default 5; existing per-product overrides take precedence |
| Notification switches | Local preview, no delivery preference backend | Disabled previews; do not claim to configure notifications |
| Payment switches | Local preview, including unimplemented wallets/bank transfer | Marked preview; cannot save. Existing COD/Stripe behavior retained |
| Social/SEO | Local preview | Marked preview; cannot save |
| Coupons | Fake records and local mutations, despite real Promotions page | Replaced by link to existing backend Promotions page (`/admin/coupons`) |
| Tax/order settings | No tax configuration or additional order-setting model | No invented fields. Existing zero-tax/order behavior retained |

## Backend and security

The new singleton `store_settings` table stores validated settings as JSON text. Initialization inserts defaults only when absent; it never replaces saved values. Updates lock the row in a transaction and merge only allowed fields.

- `GET /api/settings`: authenticated Admin only.
- `PATCH /api/settings`: authenticated Admin only; database-backed role checks.
- `GET /api/settings/public`: explicitly public store/contact/branding/shipping subset; excludes the inventory warning threshold. No public mutation route exists.

Unknown fields, unsupported currency, invalid email/phone, empty store name, control characters, oversized text, invalid image references and invalid numeric settings are rejected. Money must be a nonnegative finite number with at most two decimals, up to 1,000,000; the stock threshold must be a nonnegative integer up to 1,000,000. Logo validation reuses Task 05's 512 KiB embedded-image limit and existing browser compression.

## Business logic

`quoteCart` reads settings from MySQL on every quote. Cart/Checkout continue using the shared backend quote; payment intent creation and order creation recalculate through that same function. Shipping remains free when pre-discount subtotal is strictly above the configured threshold or zero; otherwise the configured fee applies. A fee of zero makes standard shipping free. Tax remains zero and rounding remains integer paisa. Existing order snapshots are unchanged.

`inventoryReport` reads the saved default threshold, with `inventory_settings.low_stock_threshold` overriding it per product. This configures inventory warning classification, not notification delivery or manual product availability/status. Existing administrator-set product statuses remain intact.

Navbar/Footer branding, Contact details, and FAQ/Policy shipping text load the public subset. Shipping text no longer advertises the old USD/250/15000 rules. Settings loads/saves show errors and prevent unconfirmed saves; successful saves notify mounted storefront consumers to refresh.

Local migration verification confirmed PKR, shipping fee 200, free-shipping threshold 2000 and inventory default 5. The old demo defaults were not adopted. No products, customers or orders were deleted.

## Files changed

- `server/utils/storeSettings.js` (new)
- `server/routes/settingsRoutes.js` (new)
- `server/server.js`
- `server/config/db.js`
- `server/utils/variantSchema.js`
- `server/utils/operations.js`
- `server/utils/inventoryReport.js`
- `server/package.json`
- `server/tests/settings.test.js` (new)
- `server/tests/settings.integration.test.js` (new)
- `server/tests/pricing.test.js` (mock provides persisted settings)
- `server/tests/images.integration.test.js` (temporary settings fixture)
- `my-app/src/pages/admin/SystemSettings.tsx`
- `my-app/src/hooks/useStoreInfo.js` (new)
- `my-app/src/component/Navbar.jsx`
- `my-app/src/component/Footer.jsx`
- `my-app/src/pages/Contact.jsx`
- `my-app/src/pages/Faq.jsx`
- `my-app/src/pages/Policies.jsx`
- This report and `TASK09_TESTS.txt` / `TASK09_LINT.txt`.

## Tests and results

- `npm run test:settings`: **2 passed** (validation, defaults, thresholds, rounding and zero-fee behavior).
- Settings integration suite: **5 passed**, including Admin read/update, customer/anonymous denial, forged role-claim denial, atomic rejection, saved settings read by a fresh Node process, initializer idempotence, actual order shipping totals, and inventory overrides.
- `npm run test:all:isolated`: **89 passed, 0 failed, 0 skipped**. All database writes used the disposable test database, which was removed afterward. Exact output: `TASK09_TESTS.txt`.
- Frontend lint: exit 0 with existing warnings; no new warnings for the settings consumers. Output: `TASK09_LINT.txt`.
- Production build: TypeScript/Vite passed, with the existing large-bundle warning.

No browser automation or real Stripe charge was run. The existing mocked payment regression remains part of the passing suite. Changing settings between viewing a quote and placing/paying an order can trigger the existing stale-total rejection, requiring a refreshed quote. Public display refreshes on navigation or a same-window settings-save event; financial operations always reread MySQL. Unconverted preview settings are not represented as saved configuration.
