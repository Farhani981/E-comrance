# ShopHub final production readiness audit

Audit date: 13 September 2026. **Assessment: NOT production-ready.**

This was a source, schema, configuration, read-only database and automated-test audit. No application logic, tests, secrets or existing business records were changed. Integration tests used a newly created disposable database, which the runner removed afterward. Findings below distinguish source-verified defects from deployment checks that remain unverified. Passing tests do not cover every listed defect.

## 1. CRITICAL issues

No confirmed critical vulnerability was established in the inspected code. In particular, public administrator creation, password-bypass login and predictable JWT fallback are no longer present in the active authentication implementation. This is not a penetration-test certification: the high-priority blockers below still prevent approval for production.

## 2. HIGH issues

### H01 — Database startup can target the wrong database

- **Path:** `server/config/db.js:21`, `server/schema.sql:2`, `server/server.js` startup callback.
- **Problem:** Initialization selects configured `DB_NAME`, then executes schema SQL containing `CREATE DATABASE ... ecommerce_db` and `USE ecommerce_db`. The application pool still uses `DB_NAME`. Initialization catches errors without failing startup; the HTTP listener starts before database readiness. Startup also performs DDL, repairs and category seed inserts.
- **Impact:** A deployment with a different database name can initialize the wrong database or start with incomplete tables. Runtime accounts require excessive migration privileges. Repeated startup is not a controlled migration process.
- **Recommended fix:** Remove database selection from reusable schema, introduce explicit versioned migrations against the configured database, separate migration/runtime credentials, and fail before accepting requests when required migrations or connectivity fail. Add a real bootstrap test with a non-default database name.
- **Priority:** High; launch blocker. Source-verified. The isolated test runner deliberately strips these SQL statements and therefore does not validate production bootstrap.

### H02 — Refund completion is not verified with the payment provider

- **Path:** `server/routes/operationsRoutes.js:170`, `my-app/src/pages/admin/ManageReturns.tsx`.
- **Problem:** An administrator can submit an arbitrary nonempty `refund_reference`; the endpoint immediately records the return as Refunded and the order as Refunded/Partially Refunded. No Stripe refund creation or retrieval verifies that money was returned.
- **Impact:** Customer service and financial reports can claim a completed refund while the customer has received nothing. This is an authorized-admin financial-integrity defect, not a public authorization bypass.
- **Recommended fix:** Use idempotent provider refunds or verify an existing refund belongs to the order's payment and has actually succeeded. Model pending/failed refunds separately. Any manual cash refund must have a distinct, auditable process. Do not present an entered reference as provider confirmation.
- **Priority:** High; launch blocker for refund handling. Source-verified; no refund was attempted during this audit.

### H03 — Order status updates can race cancellation and permit backward transitions

- **Path:** `server/routes/orderRoutes.js:121`, `server/routes/operationsRoutes.js` cancellation handler.
- **Problem:** Non-cancellation updates read status without a lock and later update by ID alone. A cancellation can commit between those operations, after which the other request can overwrite Cancelled. The allowed-status list also permits Delivered/Completed to return to Pending without a transition policy.
- **Impact:** An order can become active after cancellation restored stock. Backward transitions can subsequently make delivered orders eligible for cancellation and inappropriate restocking.
- **Recommended fix:** Serialize all status transitions on the same locked order row; enforce a transition graph and coordinate return/cancellation restocking. Add concurrent cancellation/status-update and terminal-status regression tests.
- **Priority:** High; launch blocker. The race is a source-derived interleaving, not a reproduced concurrent production incident.

### H04 — Cash-on-delivery order submission is not idempotent

- **Path:** `server/routes/orderRoutes.js:18`, `server/utils/orderPersistence.js`.
- **Problem:** Each repeated COD POST creates a new UUID order and deducts stock again. The payment checkout/receipt uniqueness mechanism only covers card payments.
- **Impact:** Retrying after a lost response or duplicate submission can create two COD orders and consume stock twice, provided stock remains available.
- **Recommended fix:** Persist an account/guest-scoped checkout request key and immutable request fingerprint with a unique constraint; return the committed order on retry. Reject reuse with different contents. Test simultaneous requests and response-loss recovery.
- **Priority:** High; launch blocker. Source-verified; do not interpret the passing duplicate-payment tests as COD coverage.

### H05 — Public authentication and checkout lack sufficient abuse protection

- **Path:** `server/routes/authRoutes.js:18`, `server/routes/authRoutes.js:60`, `server/server.js`, public order/payment routes.
- **Problem:** No route-level login/registration throttling was found. Registration validates presence only, without robust string, email, length or password-policy checks. Global JSON and URL-encoded limits are 50 MB. Guest order and payment initialization also lack suitable abuse controls.
- **Impact:** Credential guessing, account creation abuse, expensive hashing requests and unwanted order/payment records are insufficiently constrained. Contact-form throttling does not protect these routes.
- **Recommended fix:** Add bounded server-side schemas, sensible per-route body limits and monitored rate controls for authentication and checkout initiation. Keep verified webhook/recovery processing available under abuse. Add validation and throttling tests.
- **Priority:** High; public-launch blocker.

### H06 — SMTP certificate verification is disabled

- **Path:** `server/utils/sendEmail.js:19`.
- **Problem:** Nodemailer sets `tls.rejectUnauthorized: false`.
- **Impact:** The SMTP connection can accept an untrusted certificate, exposing email credentials and customer notifications to an intercepting endpoint.
- **Recommended fix:** Restore certificate verification and resolve certificate/CA configuration properly. Verify delivery using the production transport without disabling TLS checks.
- **Priority:** High; launch blocker when email is enabled. Source-verified.

### H07 — Account overview displays shared local/demo order history

- **Path:** `my-app/src/context/AuthContext.jsx:41`, `:176`, `my-app/src/pages/Account.jsx:257`.
- **Problem:** `shophub_orders` is browser-global, initialized with a fabricated delivered order when missing, and retained by logout. Account displays this list and count. The separate Orders page uses the backend, so the two screens disagree.
- **Impact:** Customers can see invented orders or another account's locally retained order information on a shared browser. This does not bypass backend order ownership checks, but it is a privacy and trust defect in the UI.
- **Recommended fix:** Populate authenticated account summaries from the authenticated order API; clear account-specific state on logout/account switch. Remove demo order initialization and migrate or discard obsolete browser summaries safely.
- **Priority:** High; launch blocker. Source-verified; no cross-account backend IDOR was established.

### H08 — Production payment and database configuration is not ready

- **Path:** private server environment (values not included), `server/.env.example`, `server/routes/paymentRoutes.js`, `server/utils/paymentRecovery.js`, `server/config/db.js`.
- **Problem:** The inspected local configuration uses development mode, database root with no password, a Stripe test key, no webhook signing secret, and an HTTP frontend URL. The webhook safely rejects requests when its secret is absent. There is no evidence here of a separately validated production deployment.
- **Impact:** Deploying this configuration unchanged is unsafe and cannot demonstrate live payment operation or reliable webhook delivery. The worker can still recover payments while running; missing webhook configuration does not erase its durable recovery records.
- **Recommended fix:** Provision least-privilege password-protected database access, private production secrets, matching Stripe keys, HTTPS and a registered signed webhook. Exercise a real Stripe test-mode checkout/webhook/recovery on the deployed staging topology before enabling live transactions. Monitor unresolved paid checkouts and database backups.
- **Priority:** High; deployment acceptance blocker. These are verified local facts, not claims about an unseen production server.

## 3. MEDIUM issues

| ID / priority | File/path | Problem and impact | Recommended fix |
| --- | --- | --- | --- |
| M01 — Medium | `my-app/src/pages/admin/Transactions.tsx:8` | Reachable Transactions screen renders fixed demo records. Operators cannot treat it as a real payment ledger. | Connect it to verified payment/order data or explicitly remove it from production navigation until implemented. |
| M02 — Medium | `my-app/src/context/ProductContext.jsx:44`, `:118`, `my-app/src/productsData.jsx` | Catalog falls back to fixtures/cache on fetch failure; missing/zero review values become rating 4.8 and 12 reviews. This hides outages and fabricates social proof. Backend checkout still resolves real products. | Use truthful empty/error states and actual review aggregates; distinguish any valid cache as stale and preserve genuine zero values. |
| M03 — Medium | `server/routes/productRoutes.js:68`, `:127` | Simple-product price/stock writes lack the stronger range/type validation used for variants. Negative or otherwise invalid commercial data can enter through admin requests and undermine checkout. | Share validation across simple products and variants; reject nonfinite/negative prices and invalid integer quantities; add appropriate database constraints. |
| M04 — Medium | `server/routes/adminRoutes.js:15`, `:153`; `server/utils/analytics.js`; existing `orders` | Dashboard revenue sums differ from refund-aware, currency-aware analytics. All 18 local orders lack currency and subtotal; analytics excludes unknown-currency money while older totals include it. | Use consistent named financial metrics and explicit coverage notices. Backfill only from verified historical evidence; never guess old currency/tax/discount allocations. |
| M05 — Medium | `server/routes/adminRoutes.js` customer ledger/payment endpoints; `server/routes/operationsRoutes.js` returns | Manual customer credits are not a provider settlement ledger or order-specific COD collection reconciliation. Partial refunds become terminal in the current return state model. Financial workflow scope is incomplete. | Define order-linked payment allocations, retry-safe ledger entries, COD collection recording and cumulative refund constraints; distinguish receivables, booked sales and settled cash. |
| M06 — Medium | `server/routes/categoryRoutes.js:18`, `server/routes/collectionRoutes.js:18`, `server/schema.sql:23`, `:35` | Legacy category/collection image routes lack shared image validation and retain TEXT storage. Product/order LONGTEXT fixes do not make large uploads safe for these fields. | Apply matching reference validation and explicit limits; use URLs or appropriately sized columns via additive migration. Test these routes separately. |
| M07 — Medium | `shared/images.js`, `server/routes/productRoutes.js` | Server validation checks supported formats, size and signatures but is not full image decoding/dimension validation. Inline base64 also makes catalog payloads expensive. | Validate decoded image dimensions/content server-side and reject malformed/decompression-heavy inputs; consider durable image references and thumbnails. Preserve existing images during migration. |
| M08 — Medium | `my-app/src/pages/admin/CustomerDetails.tsx:54` | Printable invoice interpolates `items_summary` into `document.write` without escaping. Product names are administrator-managed, so this is a stored HTML/script sink rather than demonstrated anonymous XSS. Purchase printing already escapes text. | Build printable DOM with text nodes or consistently escape every interpolation; add a malicious-name regression test. |
| M09 — Medium | `server/server.js` error handler; `server/routes/orderRoutes.js:22`; `server/routes/adminRoutes.js:460` and other connection acquisition sites | Several responses expose raw error messages; some Express 4 async handlers acquire connections outside their try/catch. Database outages can leak details or produce unhandled rejections instead of controlled responses. | Centralize safe errors and wrap complete async handlers, including connection acquisition; test pool failure and rollback paths. |
| M10 — Medium | `server/routes/authRoutes.js:12`, `my-app/src/context/AuthContext.jsx`, `server/server.js` | Bearer tokens last 30 days in localStorage and logout does not revoke them server-side. Unrestricted CORS is configured; application-level security headers are absent. | Define a shorter-lived/revocable session policy, assess secure cookie/refresh-token options, restrict origins and configure appropriate headers at app/proxy level. Verify HTTPS at deployment. No cookie-based CSRF vulnerability is asserted for the current bearer flow. |
| M11 — Medium | `server/package-lock.json` | Current npm audit reports three moderate affected package entries: `qs`, `express`, `body-parser`; these derive from two qs advisories, not three independent exploits. | Update compatible dependency/lockfile versions and rerun tests. Assess actual parser exposure; no exploit was attempted. Evidence: `TASK13_SERVER_DEPENDENCIES.json`. |
| M12 — Medium | `server/routes/orderRoutes.js` order lists; product GET routes; `my-app/src/pages/Orders.jsx` | Unpaginated lists and per-order item queries increase load; inline image-heavy catalog responses amplify it. Orders fetch errors are logged rather than clearly surfaced, and guest email links lead to an authenticated order-history flow. | Paginate/batch queries, measure payloads, provide visible error/retry states, and implement scoped guest tracking if guest order tracking is promised. |
| M13 — Medium | Deployment/operations documentation and infrastructure, not established by this repository | Restore drills, recovery-queue alerting, production process supervision, HTTPS/proxy routing, delivery monitoring and load behavior were not demonstrated. Existing runtime log contains connection-refused errors, but their history does not prove a current outage. | Complete a staging acceptance run and documented backup/restore, monitoring and incident procedures before launch. |

Dependency advisory references returned by npm audit: [qs bracket-key parsing](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx), [qs attacker-controlled isBuffer](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g). The frontend dependency scan reported zero advisories at audit time; that is not proof of zero vulnerabilities.

## 4. LOW issues

| ID / priority | File/path | Problem and impact | Recommended fix |
| --- | --- | --- | --- |
| L01 — Low | Files identified in `TASK13_LINT.txt` | Lint exits successfully but reports existing unused declarations and React effect/state warnings. These reduce maintainability and can cause avoidable renders. | Address warnings in focused changes; retain meaningful assertions. |
| L02 — Low | `my-app` production bundle / route imports | Main JavaScript chunk is 754.35 kB, 189.22 kB gzip; Vite flags the 500 kB threshold. Initial loading can be heavier on mobile networks. | Split admin/report routes and measure loading performance before selecting further optimizations. |
| L03 — Low | `my-app/src/pages/admin/ManagePurchases.tsx` CSV export | CSV quoting escapes quotes but does not neutralize spreadsheet formulas in administrator-controlled supplier/invoice text. | Reuse the analytics export's safe cell handling or prefix formula-like text; test leading formula characters. |

## 5. Fixed issues verified in the current code

These were already fixed before this audit; **this audit did not implement fixes**.

- Public registration explicitly inserts role `user`, ignoring submitted privileged roles. Login uses bcrypt verification, with generic incorrect-credential errors. JWT signing and verification share environment configuration; missing secret fails rather than selecting a default.
- Auth middleware verifies the token and reloads the current user/role from MySQL. Admin APIs use server-side authorization. Profile updates bind to authenticated identity and allowlist supported fields. LocalStorage role edits cannot confer backend permissions.
- Product option mapping, explicit clearing, stale-variant removal and stock-label normalization pass current regression tests, including preserving SKU/price/stock relationships.
- Product, variant and order-item images use LONGTEXT. Shared upload checks impose 5 MiB input and 512 KiB stored image limits; browser optimization and order image persistence have coverage. This does not cover every legacy image route (M06).
- Backend quote calculation resolves actual product/variant prices and stock, applies configured discounts/shipping, and rounds in minor units. Submitted totals are checked against backend values; card amount/currency are verified. Current supported currency is PKR; no separate configurable tax model was established.
- Customer profile, supported store settings, contact messages, authenticated cart/wishlist and login merge have real database-backed implementations and authorization tests. Guest shopping remains local. Unsupported/demo settings must not be mistaken for persisted business rules.
- Reports/analytics use backend queries with authorization, filtering/export tests and explicit limits on legacy/unknown-currency data.
- Card payment recovery persists a checkout before payment, verifies provider status, and atomically links one order and receipt with stock changes. Duplicate callbacks, rollback and retry are covered. COD idempotency remains H04.

The active authentication/JWT source scan found no hardcoded password bypass or fallback signing secret. `.gitignore` excludes nested private environment files and permits examples. Repository-history secret removal could not be established because usable Git history was unavailable; ignoring a file does not prove it was never committed. No secret values are included in this report.

## 6. Remaining issues and recommended sequence

All H01–H08, M01–M13 and L01–L03 remain open. Each entry above provides location, impact, recommended correction and priority.

1. Resolve database/bootstrap correctness, refund verification, status concurrency and COD idempotency.
2. Close public abuse controls, SMTP TLS and account-history privacy gaps.
3. Prepare and verify production configuration and payment operations; remove misleading demo financial/customer data before launch.
4. Address validation, image-route gaps, financial reconciliation and error handling; update affected dependencies.
5. Run focused regressions for the new findings, then repeat the complete suite and staging acceptance checks. Schedule remaining performance/maintenance work with explicit ownership.

## 7. Security status

**Improved, but not approved for production.** Server-side role checks cover the inspected admin route families: products/variants/attributes, catalog/categories/collections/banners, orders, customers, purchases/suppliers, inventory/warehouses, returns/promotions/review moderation, settings, contact messages, analytics and payment recovery. Customer profile/shopping/order/return access is scoped by authenticated identity; guest payment recovery uses a secret capability and account binding where applicable.

No confirmed customer-to-admin escalation or backend cross-customer access was found in these paths. That positive result is limited by the remaining abuse, TLS, session, printable HTML, error-handling and dependency findings. No external penetration test, production TLS assessment or secret-history audit was performed.

## 8. Payment status

The current card flow is materially safer:

1. Validate checkout and persist the authoritative snapshot plus recovery identity in MySQL.
2. Create/reuse the Stripe PaymentIntent with a stable idempotency key; save its reference before returning the client secret.
3. Stripe confirms the payment. Browser reconciliation, signed webhook or worker retrieves and verifies its status, amount, currency and checkout relationship.
4. Save paid-pending recovery state. In a transaction, lock the checkout, create/link one order and unique receipt, deduct stock and consume the cart.
5. Commit once. Duplicate reconciliation returns the existing order; failure rolls back fulfillment and preserves recovery information for retry/admin review.

Stock shortages or permanently unavailable products can still require human fulfillment review; durable recovery is not a guarantee of immediate shipment or a refund. The worker depends on a running backend, and its finite batches require operational monitoring. A provider-create/database-save gap is addressed by stable idempotency and webhook metadata, with old uncertain attempts requiring review.

Automated tests use provider doubles and real isolated SQL transactions. **No real charge, live webhook delivery, refund or settlement reconciliation was performed during this audit.** Missing local webhook configuration, unverified refund completion and COD duplicate handling prevent payment readiness approval.

## 9. Database / data-consistency status

Read-only checks of the configured local database found:

- MariaDB 10.4.32; 30 inspected tables use InnoDB. Users, products, variants/attributes, categories/catalog, orders/items, payment checkouts/receipts, stock adjustments, purchases/items, suppliers, warehouses, reviews, returns, settings, contact messages and shopping persistence structures exist.
- Ten products: no negative current product price/stock rows; no current `stock`/`stock_quantity` mismatch and no active variant aggregate mismatch in the checked sample.
- Eighteen orders: all missing historical currency and subtotal. This is a reporting coverage problem, not permission to invent historical values.
- No duplicate nonempty order transaction reference groups were found. The sampled database contains no payment checkout rows and no completed refunds, so existing local records cannot demonstrate live recovery/refund behavior.
- Product image, variant image and order-item image columns are LONGTEXT. `max_allowed_packet` is 1 MiB; capacity and aggregate payload tests remain important for future image changes.
- New card receipts/checkouts provide durable uniqueness and order relationships; transactions cover order items, stock and cart consumption. Purchases and inventory updates also have transactional paths. H01/H03/H04/M05 remain independent consistency gaps.

Evidence contains only schema/configuration flags and aggregate counts, not customer rows or credentials: `TASK13_DATABASE.json`. Test databases were disposable; no existing orders/images were deleted or migrated.

## 10. Testing status

| Check | Result |
| --- | --- |
| `cd server; npm run test:all:isolated` | **PASS — 130 tests, 130 passed, 0 failed, 0 skipped; process exit 0.** |
| Historical option mapping failure | Resolved; selected-option/authoritative-label regression passes. |
| Historical option clearing failure | Resolved; explicit clearing, reload and stale variant removal regressions pass. |
| Historical stock normalization failure | Resolved; numeric/string/case/spacing and out-of-stock override regressions pass. |
| `npm --prefix my-app run lint` | **PASS — exit 0, existing warnings remain.** |
| Backend `npm audit --json` | Three moderate affected package entries; see M11 and saved JSON. |
| Frontend `npm audit --json` | Zero reported vulnerabilities. |

The isolated runner includes all `server/tests/*.test.js` plus frontend catalog tests and enables SQL integration coverage. No tests were edited, removed, skipped or weakened. The earlier 20-test baseline has expanded; the relevant historic failures now pass within 130 tests. There is no backend lint/build script in `server/package.json`; the backend is directly executed JavaScript.

Not covered by this passing run: real startup against a custom database name, live provider network behavior, full browser end-to-end acceptance, concurrent status/cancellation interleaving, COD retry idempotency, production load, backup restoration and the other newly reported defects. Earlier recorded Windows test teardown instability did not occur in this audit's successful full run.

Evidence: `TASK13_TESTS.txt`, `TASK13_LINT.txt`, `TASK13_SERVER_DEPENDENCIES.json`, `TASK13_FRONTEND_DEPENDENCIES.json`.

## 11. Build status

`cd my-app; npm run build` **passed with exit 0**. TypeScript build and Vite production asset generation succeeded. The main chunk size warning remains (L02); it is not a build failure. PowerShell records stderr warning decoration in the saved output, while the process completion was successful.

Evidence: `TASK13_BUILD.txt`. Building static assets does not establish that production reverse-proxy/API routing, HTTPS or backend startup will work.

## 12. Production-readiness assessment

**Do not launch the current application/configuration unchanged.** The main blockers are unsafe database bootstrap, unverified refund completion, order status/stock races, non-idempotent COD creation, weak public abuse controls, disabled SMTP certificate verification, shared/demo account order history and unverified production payment configuration.

The earlier authentication, pricing, image, persistence, analytics and card-recovery work is supported by passing regression tests. Production approval still requires the blockers to be fixed, targeted tests for them, and a staging run proving database initialization, real provider test-mode recovery, accurate customer/admin records, monitoring and restore procedures. No claim of production readiness or successful real refund is made.
