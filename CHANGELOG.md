# Changelog

## 2026-09-10 - Inventory dashboard and stock traceability

- Added the Inventory page and admin navigation with live summary cards, stock/supplier search, warehouse/status filters, sorting, pagination and CSV export.
- Added weighted purchase cost, available inventory, delivered sales, open orders and received returns without multiplying totals across invoice/order joins.
- Added per-product supplier invoice, order and movement histories; stock settings, manual adjustments and warehouse creation are connected to the existing API.
- Added transactional movement records for purchase creation, quantity changes and deletion, including the staff member.
- Added database regression coverage and desktop/mobile browser checks. See `docs/INVENTORY.md` for metric definitions and valuation limits.

## 2026-09-09 - Supplier and purchase operations upgrade

### Added

- Added live supplier invoice counts, purchase totals, payments, outstanding balances, last-purchase dates, CSV export, and links into filtered purchase history.
- Added purchase editing, payment recording, deletion with inventory reversal, invoice printing, CSV export, date/supplier/status/method filters, pagination, and explicit loading/error/empty states.
- Added an inline "Add a new product" workflow to purchase lines. It creates a zero-stock catalog product and automatically selects it so the invoice supplies its opening stock.
- Added server-side purchase validation for finite costs, positive whole quantities, duplicate product lines, paid totals, supplier/product existence, and unique invoice numbers.
- Added transactional inventory reconciliation when purchase lines change or an invoice is deleted. Stock reversal is blocked when it would create negative inventory.

### Fixed

- Corrected the purchase product selector to use the mounted `/api/products` route.
- Replaced hardcoded supplier financial totals with aggregates from purchase records.
- Exposed a dedicated `total_unpaid` supplier value and moved Paid Amount and Unpaid Amount to prominent dashboard cards and leading table columns.

### Database

- No schema migration is required. The changes use the existing `suppliers`, `purchases`, `purchase_items`, and `products` tables.

## 2026-09-09 — Admin order visibility fix

### Fixed

- Confirmed the configured database contained orders and `/api/orders` returned them with a valid admin JWT; isolated the empty admin table to a hidden 401/403 session failure.
- Added server-backed admin session validation through `/api/auth/me` and redirect to login for missing, expired, demo, or non-admin sessions.
- Connected every admin logout button to `AuthContext.logout` and login navigation.
- Changed Order Management to use the current context token, display API/session failures with retry, distinguish an empty database from filtered-out results, and support every backend status option including Completed.
- Removed unused dashboard declarations and typed the Customer Details response so the production build can complete.

### Verified

- Live configured database: 15 order rows and 15 order-item rows during diagnosis.
- Authenticated `/api/orders`: HTTP 200 with all 15 orders through the running backend.
- Focused lint: exit 0 with existing React effect-pattern warnings only.
- Frontend production build: passed; 79 modules transformed, with a non-fatal large-chunk warning.

## 2026-09-09 — Documentation baseline

### Added

- Root project guide and linked documentation index.
- Architecture, feature/persistence map, and source-file inventory.
- Frontend routes, mounted API reference, and disconnected endpoint notes.
- Database table definitions, relationship diagram, startup DDL, and schema-change procedure.
- Shopping, payment, stock-in, order-status, and customer-ledger flow documentation.
- Integration/environment reference and source-derived page wireframes.
- Category maintenance guide, prioritized issue register, and development/testing guide.

### Verified

- Server JavaScript syntax checks completed successfully.
- Frontend lint exited successfully with warnings.
- Frontend production build failed with 10 unused-declaration errors in `AdminDashboard.tsx` and one response-type error in `CustomerDetails.tsx`.

### Scope

This entry records documentation work and observed baseline behavior. It does not claim application fixes, database migrations, or working live integrations. No Git metadata was visible in the project root and `git` was unavailable on PATH during inspection; earlier release dates and authors cannot be reconstructed reliably. Comments such as “FIX” and “MODIFIED” in source are not treated as a dated release history.

## Future entries

Add a dated entry for each completed change with the affected feature, user-visible behavior, schema/config changes, validation performed, and any remaining limitation. Put proposed work in `docs/KNOWN_ISSUES.md`, not under completed changes.

## 2026-09-09 ? Catalog navigation

Connected desktop/mobile navbar links to product categories and subcategories; fixed the numeric category-ID drawer crash, legacy slug matching and stale filters. Persisted product subcategories and made catalog mutations wait for API success. See [details](docs/CATALOG_NAVIGATION.md).

## 2026-09-09 ? Hero and campaigns

Built the responsive editorial hero, accessible carousel, dual CTAs and shared admin previews. Connected hero/promotional card CRUD, visibility and ordering to SQL; added validation and additive schema migration. Removed duplicate feature strip and automatic banner reseeding. See [Hero and campaigns](docs/HERO_CAMPAIGNS.md).

## 2026-09-09 ? Database-backed men?s mega-navigation

Added the four-department, three-level catalog with SQL-backed category management, responsive mega-menu and modal accordion drawer. Product and purchase quick-add forms share dependent selectors and persisted fit/occasion attributes. `/products` supports canonical slug filters while `/shop` remains compatible. See [Men?s catalog](docs/MENS_CATALOG.md).
