# Known issues and less obvious behavior

> Hero/banner implementation updated: [Hero and campaign management](HERO_CAMPAIGNS.md) supersedes the older banner storage, field mapping, API and carousel notes below.

> Catalog changes: see [Catalog navigation update](CATALOG_NAVIGATION.md). This supersedes the older catalog mapping, subcategory persistence, silent-save and navigation-filter observations below.

Source-inspection baseline: 2026-09-09. These findings are not fixes. Severity describes likely application impact, not a penetration-test score. Links point to the implementation that should be revisited.

## Authentication and integrity

| ID | Priority | Evidence and impact | Suggested next change |
| --- | --- | --- | --- |
| AUTH-01 | Critical | [Registration](../server/routes/authRoutes.js) trusts a submitted `role: admin` on a public endpoint | Assign public users the user role; provision admins through a controlled process |
| AUTH-02 | Critical | Same file's `isMasterAdminPass` accepts two fixed passwords for any existing admin email without checking its hash | Remove bypass and test valid/invalid stored-password paths |
| AUTH-03 | High | Auth routes and [middleware](../server/middleware/authMiddleware.js) share a hardcoded fallback signing secret | Require a configured secret and fail clearly if absent |
| AUTH-04 | High | [AuthContext](../my-app/src/context/AuthContext.jsx) creates demo sessions on loosely classified network errors and derives admin role from email text | Separate explicit demo mode from production login; do not infer roles |
| PAY-01 | Critical | [Order creation](../server/routes/orderRoutes.js) trusts prices, totals, payment status, transaction ID, and caller-supplied existing user ID | Authenticate ownership where applicable, calculate totals from SQL, verify provider state server-side |
| PAY-02 | High | [Checkout](../my-app/src/pages/Checkout.jsx) uses a placeholder publishable key; mounted intent currency is USD while UI uses Rs. | Establish one currency contract and wire test configuration |
| PAY-03 | High | Card confirmation and order creation are separate; no webhook, idempotency, or recovery exists | Add verified payment/order lifecycle and reconciliation |
| PAY-04 | High | [StripeCheckoutForm](../my-app/src/pages/StripeCheckoutForm.jsx) renders a form inside Checkout's form; outer handler can construct Paid with null transaction ID | Remove nested forms and route all paid state through verified backend logic |
| SEC-01 | High | [CustomerDetails](../my-app/src/pages/admin/CustomerDetails.tsx) interpolates unescaped order item summaries into `document.write` | Escape untrusted values or build the print DOM safely |
| SEC-02 | Medium | [SMTP](../server/utils/sendEmail.js) disables certificate verification | Restore verification and correct transport trust configuration |
| SEC-03 | Medium | [Server](../server/server.js) allows all CORS origins, 50 MB bodies, raw error messages; no rate limiting present | Apply explicit deployment policies and validation |

## Database and inventory

| ID | Priority | Evidence and impact | Suggested next change |
| --- | --- | --- | --- |
| DB-01 | High | [schema.sql](../server/schema.sql) hardcodes `USE ecommerce_db` while [db.js](../server/config/db.js) allows another DB_NAME | Use one database selection strategy |
| DB-02 | High | Startup depends on `ADD COLUMN IF NOT EXISTS`; compatibility with the actual MySQL-compatible engine is unverified; one failed DDL aborts later initialization work | Introduce versioned migrations and test the selected engine |
| DB-03 | High | `stock_quantity` exists only in startup DDL; purchases modify both stock fields, orders/product CRUD modify only stock | Choose a single inventory quantity and migrate consistently |
| DB-04 | High | Order creation clamps inventory to zero rather than rejecting overselling; weak quantity validation permits problematic values | Validate positive integers, lock/check stock, and reject insufficient inventory |
| DB-05 | Medium | Order default references use the last six timestamp digits; purchase references are randomized but requests have no idempotency key | Use collision-resistant order references and request idempotency |
| DB-06 | Medium | Order and purchase handlers acquire a pool connection outside their try blocks; order early-validation paths release again in finally | Move acquisition into handled control flow and release once |
| DB-07 | Medium | Startup continues despite DB errors and replays seed INSERT IGNORE on each boot | Add readiness handling and explicit seeding; deleted seeded categories/banners can return on restart |
| DB-08 | Medium | Customer-list spend includes cancelled orders; detail ledger combines paid orders with manual credits | Define consistent customer financial aggregates and reconciliation rules |
| DB-09 | Medium | Images are data URLs in TEXT fields; a permitted 5 MiB upload can still exceed SQL TEXT capacity after processing | Enforce stored-byte limits or move images to file/object storage |
| DB-10 | Medium | Product variants/subcategories are absent from SQL; order items omit selected size/color; collections have no product links | Add explicit variant/category/membership models if those features are intended |

## Frontend integration and content

| ID | Priority | Evidence and impact | Suggested next change |
| --- | --- | --- | --- |
| UI-01 | High | [ProductContext](../my-app/src/context/ProductContext.jsx) swallows category and product-update/delete failures, showing changes that may disappear on reload | Validate responses, report failure, and rollback or refresh |
| UI-03 | Medium | API product mapping drops SKU/subcategory detail and substitutes `stock: 10` for zero; update request omits SKU although SQL replaces it | Use a shared complete product contract and nullish defaults |
| UI-04 | Medium | [ManageCollections](../my-app/src/pages/admin/ManageCollections.jsx) edit payload omits `isActive` while the SQL update writes it unconditionally | Include current flag or implement allowed partial updates |
| UI-05 | Medium | [ManageBanners](../my-app/src/pages/admin/ManageBanners.jsx) is browser-only; [Hero](../my-app/src/component/Hero.jsx) expects subtitle/cta/link while editor saves description/buttonText | Connect persistence and unify banner field names |
| UI-06 | Medium | Disabling every hero banner restores default slides; shrinking the array may leave currentIndex outside it | Define empty state and clamp current index |
| UI-07 | Medium | Cart, checkout, settings, and marketing copy disagree on shipping prices and thresholds | Centralize pricing and use server-calculated totals |
| UI-08 | Medium | [Shop](../my-app/src/pages/Shop.jsx) season/gender/fit controls do not participate in filtering; brand query is ignored | Implement supported filters or remove inactive controls |
| UI-09 | Medium | Shop's default price ceiling is 15000; removing the search query from URL does not clear existing search state | Make default filters explicit and synchronize empty search |
| UI-10 | Medium | Category slug aliases and navbar subcategories do not consistently match exact Shop predicates | Normalize stable IDs/slugs and test every navigation link |
| UI-11 | Medium | [Category name handler](../my-app/src/pages/admin/ManageCategories.jsx) fills a link once and keeps it while the name changes | Track whether the link is manually edited or regenerate at save |
| UI-12 | Medium | Profile and local order records persist across sessions; logout does not clear account-related cached history | Partition personal data by user and define logout cache behavior |
| UI-13 | Medium | Guest checkout sends an authenticated-only tracking link; [Orders](../my-app/src/pages/Orders.jsx) can show empty results on auth failure | Add secure guest tracking or explain login/ownership requirements |
| UI-14 | Medium | [Email helper](../server/utils/sendEmail.js) never returns true; UI reports email failure even after SMTP acceptance | Return a defined delivery-attempt result and distinguish accepted/skipped/failed |
| UI-15 | Low | [OrderSuccess](../my-app/src/pages/OrderSuccess.jsx) says Total Paid even for COD and confirms without a stored receipt | Present payment state accurately and handle absent receipts |
| UI-16 | Low | Transactions, settings save, contact success, and product reviews are demo/local; customer city selector has no filtering handler | Connect intended features and avoid implying completed operations |
| UI-17 | Low | Dashboard/sidebar contain static counts and samples; dashboard revenue includes cancelled orders while `/admin/stats` excludes them | Consume one metrics definition |
| UI-18 | Low | Category feature strip promises 30-day returns; FAQ/policies say 7 days | Reconcile policy copy with the intended business rules |
| UI-19 | Low | Admin page title matches exact menu paths, so nested customer details falls back to Dashboard | Add nested-route title handling |

## Build and maintenance

The verified production build passes. Focused lint still reports effect-pattern warnings in some admin components. See [verification](DEVELOPMENT.md).

Resolved on 2026-09-09: AUTH-05. `AdminLayout` now validates the JWT and admin role through `/api/auth/me`, performs real logout, and redirects invalid sessions. The order module now distinguishes API/authentication failure from a genuinely empty database and offers retry. The dashboard unused-symbol and customer-details response-type build blockers were also removed.

Unused/disconnected code includes [paymentRoutes.js](../server/routes/paymentRoutes.js), the banner API from the current frontend, `/api/admin/stats`, `/api/auth/me`, and the template [App.css](../my-app/src/App.css), which is not imported by the current app. The Tailwind config file exists, but neither the CSS entry nor Vite config explicitly references it. No automated application test suite or CI workflow was found in the supplied first-party files. The existing `test_api.bat` mutates accounts and contains an outdated comment about admin requests lacking authorization.

Recommended work order: authentication bypasses and payment trust; build errors; schema/inventory consistency; incorrect endpoints and silent saves; then demo integrations and content cleanup. These are proposed tasks, not changes made by this documentation pass.
