# Task 12 — Reports & Analytics

## Delivered

Replaced the existing `/admin/reports` page, which calculated business totals in React and silently fell back to `shophub_orders` localStorage. The replacement uses authenticated backend analytics exclusively, with no demo fallback or production fixture data.

The existing admin navigation now says **Reports & Analytics**. Sections cover Overview, Sales, Orders, Products, Categories, Customers, Inventory, Payments, Discounts, and downloadable Reports. Existing inventory management is linked rather than duplicated.

Controls include Today, Yesterday, Last 7/30 Days, This/Last Month, This Year, custom inclusive dates, daily/weekly/monthly/yearly grouping, and period comparisons. Tables support server pagination, sorting, applicable search/status/performance filters, and exports. Loading, empty, error, retry and missing-data states are explicit. Responsive bars show actual database values, including true zero widths; trend periods with no records are omitted and this is labelled.

## APIs

All routes are `GET /api/admin/analytics/:report`, protected by existing `protect` and `adminOnly` middleware. Authorization reads the current database user role, not frontend state or role claims alone.

Supported reports:

| Report | Data |
| --- | --- |
| `overview` | Current/previous KPIs, growth, current inventory, revenue/order/unit trend and order statuses |
| `sales` | Aggregated sales components, revenue, units, orders and data-coverage counts by period |
| `orders` | Minimal order/customer/date/amount/currency/payment/status fields |
| `products` | Delivered product performance, current stock, archived status, category and gross item revenue |
| `categories` | Current product counts, delivered units/order counts, item revenue and actual sales percentages |
| `customers` | Buyer order count, spending, AOV and last order; no email/address/phone returned |
| `inventory` | Product/variant SKU stock, threshold, price, weighted purchase cost, value and warehouse |
| `payments` | Recorded order payment states, distinct transaction references, order amounts and refunds by method |
| `discounts` | Saved discount/coupon usage and associated order revenue; summary includes most-used coupon |

Parameters:

- `range=today|yesterday|last7|last30|month|lastMonth|year|custom`; custom uses `start` and `end` (`YYYY-MM-DD`). Dates are bounded to ten years and cannot end in the future.
- `bucket=daily|weekly|monthly|yearly` (weeks begin Monday).
- `compare=previous|month|year`. `previous` uses an immediately preceding equal number of calendar days. `month` explicitly compares this month to date with the previous full month; `year` compares this year to date with the previous full year. Effective dates are returned and displayed.
- `page`, `limit` (1–100), allowlisted `sort`, `direction=ASC|DESC`, `search` (100 characters maximum), applicable `status` and `payment_status`, and product `performance=zero|sold`.
- `format=csv|excel|print` exports all matching table rows, independently of the selected page. Above 10,000 matching rows, the API rejects with an instruction to narrow filters; it never silently truncates.

Table filters apply to tables and their exports. Summary cards and charts retain the global date range; the UI explains this scope. Inventory is explicitly a current snapshot.

## Calculation contract

| Measure | Source and rule |
| --- | --- |
| Booked value | Sum saved `orders.total_amount` for non-cancelled orders, matching the existing admin revenue inclusion rule |
| Revenue | Booked value minus completed recorded refunds on those same non-cancelled orders; this is not cash settlement revenue |
| Refunded Amount KPI | All completed `return_requests.refund_amount` belonging to orders created in the selected period, including cancelled orders |
| Sales refunds | Only refunds against non-cancelled orders, so the sales summary reconciles with booked revenue without double-subtracting cancelled sales |
| Gross/discount/shipping/tax | Saved order snapshot fields; historical missing components are counted and labelled partial |
| AOV | Non-cancelled booked order value / corresponding known-currency order count; zero when the count is zero |
| Products sold | Delivered/Completed item quantities whose return has not been restocked, reusing the existing inventory-report rule |
| Product/category revenue | Those delivered, non-restocked item quantities × saved item price, before order-wide discounts/refunds/shipping/tax |
| Category percentage | Category item revenue / total category item revenue × 100, in SQL; zero for a zero denominator |
| Completed orders | Original order status Delivered or Completed |
| Status chart/table | Completed normalizes to Delivered; completed refund state overrides to Refunded, otherwise received non-cancelled returns display Returned |
| Customers | Registered role=user accounts as of range end; new accounts created in range. Active/returning buyers include guest orders |
| Buyer identity | User ID for account orders; normalized email for guests. Internal identity is hashed for table IDs and email is not exposed |
| Returning buyer | A buyer active in the selected period with a prior non-cancelled order |
| Customer spending | Non-cancelled booked amount less recorded refunds; average spending uses buyers with known-currency orders |
| Inventory stock | Current non-archived simple products and active variants; no double-counting product and variant stock |
| Low-stock product KPI | Positive product stock at or below its override/default threshold. Out-of-stock counts are separate |
| Inventory cost/value | Quantity-weighted recorded purchase cost per product/variant SKU × current stock, preserving the existing weighted purchase-cost approach. Unknown cost is null and excluded from the known-cost total; uncosted SKUs are counted |
| Payments | Actual order payment methods/states and distinct saved transaction IDs; order amount is not represented as captured cash |
| Coupons | Order snapshot coupon codes and discount amounts, independent of later promotion edits |
| Growth | `(current - previous) / abs(previous) * 100`, rounded to two decimals; zero/zero = zero, positive value against zero baseline = unavailable percentage |

PKR is the only supported configured currency in the existing business model. Orders with null/other currency are excluded from monetary aggregates and explicitly counted, rather than assigning them an invented currency. Their order counts remain visible and their original total/currency remain in the order report. SQL DECIMAL arithmetic handles monetary aggregation; frontend work is formatting only.

Date boundaries use database session calendar dates and half-open comparisons (`created_at >= start AND created_at < day_after_end`). There is no invented UTC conversion for legacy timestamps. Each report request uses one read-only repeatable-read consistent database snapshot.

## Queries and performance

- Date-scoped order CTEs join a separately grouped order-item quantity CTE and the unique return request per order. This prevents multi-item orders from multiplying order totals.
- SQL `COUNT`, `SUM`, conditional sums, `COUNT(DISTINCT ...)`, `GROUP BY`, weighted-average arithmetic and category window totals perform the calculations.
- Product/category sales aggregate items in SQL. Purchases aggregate by product/variant before joining inventory. Customer prior-order membership is a grouped join, not a per-customer query.
- Tables run a count query and a bounded `LIMIT/OFFSET` query with a deterministic tie-breaker. React never receives the entire order/product/customer database.
- All sort identifiers and enum filters are allowlisted; user filter values are bound parameters.
- Added `orders(created_at)` and `users(role, created_at)` indexes for actual range/account queries. Existing foreign-key indexes cover item/order/product joins. The existing API schema gate adds indexes idempotently; there is no historical data rewrite.
- Queries are a fixed number per report, not N+1 queries. Trend output is bounded by the date limit; category/payment charts show the top 20 groups, with all groups available through the report table.

## Exports

- CSV is generated from backend-filtered query rows, with proper quoting and spreadsheet-formula neutralization.
- Excel export uses SpreadsheetML XML (`.xml`), not a falsely named `.xlsx` file. Values have explicit numeric/string types.
- Print / Save PDF opens a backend-generated HTML report containing all matching rows. The browser's Print command produces the PDF; there is no native server PDF renderer.
- HTML/XML values are escaped. Export responses are admin protected, private/no-store, and do not contain unnecessary customer contact details.

## Files changed

New backend files:

- `server/routes/analyticsRoutes.js`
- `server/utils/analytics.js`
- `server/utils/analyticsDates.js`
- `server/utils/analyticsExport.js`
- `server/utils/analyticsSchema.js`

Updated backend integration:

- `server/server.js` — mount analytics routes
- `server/utils/variantSchema.js` — existing schema-readiness hook adds indexes

Frontend:

- `my-app/src/pages/admin/AdminReports.jsx` — replaces local/demo report logic with the complete API-backed page, report tables, cards, bars, filters and exports
- `my-app/src/layout/AdminLayout.tsx` — navigation label

Tests/documentation:

- `server/tests/analytics.test.js`
- `docs/TASK12_ANALYTICS.md`
- `docs/TASK12_TESTS.txt`, `docs/TASK12_LINT.txt`, `docs/TASK12_BUILD.txt`, `docs/TASK12_TEST_RETRY.txt`

## Verification

The analytics tests use known records only in the runner's disposable `shophub_test_*` database. They cover presets/leap dates/date bounds, exact order and revenue sums, multi-item join safety, discounts/refunds, zero baselines, previous periods, delivered product/category sales and percentages, customers, SKU purchase-cost valuation, unknown historical currency, empty periods, pagination/sorting/filtering, all report routes, unauthorized/forged-role access, exports across pages, export size limits/escaping, archived sales and safe database failures.

The first complete run had one existing catalog failure caused by the new fixture category not being cleaned up. Fixture cleanup was corrected; the existing catalog assertion was not changed or weakened.

One subsequent run passed all 120 assertions but its existing product-attribute worker crashed afterward with a Windows Node `UV_HANDLE_CLOSING` assertion. That failed run is preserved in `TASK12_TEST_RETRY.txt`; the complete suite was rerun unchanged to check recurrence.

Final results and command output are recorded in the accompanying evidence files. Full suite: 120 passed, zero failed/skipped. Frontend lint: exit 0, existing unrelated warnings remain. Production build: exit 0, existing main-bundle size warning remains (approximately 748 kB).

## Data limitations — no fabricated substitutes

- Revenue is booked order value, not accounting-recognized revenue or reconciled cash receipts. Payment attempts, failures, settlement timestamps and a complete multi-payment transaction ledger do not exist.
- Refund completion timestamps do not exist. Refunds are therefore reported against original order dates, not as refund cash movements occurring during the selected dates.
- Legacy missing pricing breakdowns, coupon attribution and currency cannot be reconstructed. Coverage counts remain visible, including in sales export rows.
- Historical inventory snapshots and reliable per-unit cost layers/COGS do not exist. Inventory is current; weighted purchase cost is not a claim of FIFO valuation or profit.
- Category changes have no historical category snapshot. Reports use current assignments; missing product/category identities are explicitly unclassified. Archived products with sales remain in product reports. Permanently deleted product identities cannot be reconstructed as individual current products.
- Guest-to-account historical identity linking is not recorded, so a guest email identity and a later account ID can count separately.
- Browser visual/end-to-end automation was not available. Validation covers the actual Express/MySQL APIs, calculation/export helpers, frontend lint, and the production build.
