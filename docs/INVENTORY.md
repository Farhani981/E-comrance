# Inventory management

Open **Admin → Inventory** (`/admin/inventory`). The dashboard reads real products, purchase invoices, supplier records, orders, returns, warehouses and stock adjustments. It does not seed sample inventory.

## Daily workflow

1. Use **Record purchase** for incoming supplier stock. The purchase invoice records the supplier, date, quantity and unit cost and increases available stock.
2. Search by product, SKU or supplier. Filter by warehouse or stock status; sort by available quantity, delivered sales or estimated stock cost. Export the filtered stock report to CSV.
3. Open the eye icon or product name for supplier invoices, order history and recorded stock movements.
4. Use stock settings to edit SKU, warehouse and low-stock threshold. Add storage locations in the Warehouses tab.
5. Use stock adjustments for count corrections, damage or loss. A signed quantity and reason are required. The server rejects negative resulting stock and records the staff member.

## What the numbers mean

- **Available:** current `products.stock`. Open orders have already reduced this number; do not subtract them again.
- **Purchased:** quantity and cost on existing purchase invoices. Editing/deleting an invoice changes these totals.
- **Average unit cost:** total recorded purchase line cost divided by purchased units, weighted by quantity.
- **Estimated stock cost:** available units multiplied by that average. Products without purchase history have unknown cost and are excluded from the monetary total, with a visible count. This is an estimate, not FIFO or an accounting inventory valuation.
- **Sold:** delivered/completed order units, excluding cancelled orders and whole-order returns received back into stock.
- **Open:** pending, processing and shipped order units.
- **Returned:** received/restocked returns, excluding cancellation restocks.
- **Delivered item sales:** order-line prices multiplied by sold units before order discounts and shipping; this is not collected cash or profit.

Each product has one warehouse assignment; stock is not split across warehouses. Historical opening stock and direct product edits may lack cost/movement records. Purchase creation, quantity edits and deletion now append transactional stock movements. Older purchase records remain visible in supplier history; historical movements are not invented. The overview displays the latest 100 recorded movements, while product history retrieves all recorded movements for that product.

## API and verification

All inventory and warehouse routes require an authenticated admin. `GET /api/operations/inventory` supplies the report; `GET /api/operations/inventory/:id/history` supplies purchases, orders and movements. Existing stock-setting, adjustment and warehouse endpoints handle changes. No new database migration is required beyond the existing operations schema.

- `npm --prefix my-app run build`
- From `server`: `node --test --test-isolation=none tests/operations.test.js`
- From `server`, set `RUN_DB_TESTS=1`, then run `node --test --test-isolation=none tests/operations.integration.test.js`. Database fixtures are rolled back. Checks cover report aggregation, weighted costs, authorization, returns, cancellations and purchase create/edit/delete stock logging.
- Start the frontend on port 5175, then `node scripts/check-inventory.mjs`. Isolated Chrome fixtures exercise desktop/mobile layouts, filters, history, adjustment submission and warehouse views. Screenshots are written under `artifacts/inventory`. Browser fixtures do not change the database.

Restart a backend running without a file watcher after updating these routes.
