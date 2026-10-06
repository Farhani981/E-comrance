# Routes and API reference

> Current men?s taxonomy and mega-navigation: [Men?s catalog](MENS_CATALOG.md) supersedes older static/six-department category notes below.

> Hero/banner implementation updated: [Hero and campaign management](HERO_CAMPAIGNS.md) supersedes the older banner storage, field mapping, API and carousel notes below.

Source baseline: 2026-09-09. UI routes are declared in [my-app/src/App.tsx](../my-app/src/App.tsx); API prefixes are mounted in [server/server.js](../server/server.js). Routes listed below describe current code, not live service verification.

## Frontend routes

| Path | Component | Access / behavior |
| --- | --- | --- |
| `/` | [Home](../my-app/src/App.tsx) | Public homepage |
| `/login` | [Login](../my-app/src/pages/login.jsx) | Login and registration tabs |
| `/account` | [Account](../my-app/src/pages/Account.jsx) | Component shows login prompt when no local user |
| `/orders` | [Orders](../my-app/src/pages/Orders.jsx) | Page is public; its data request requires JWT |
| `/shop` | [Shop](../my-app/src/pages/Shop.jsx) | Query: category, sub, search |
| `/product/:id` | [ProductDetail](../my-app/src/pages/ProductDetail.jsx) | Public storefront page |
| `/cart` | [Cart](../my-app/src/pages/Cart.jsx) | Public storefront page |
| `/wishlist` | [Wishlist](../my-app/src/pages/Wishlist.jsx) | Public storefront page |
| `/checkout` | [Checkout](../my-app/src/pages/Checkout.jsx) | Guest checkout allowed; empty-cart state |
| `/order-success` | [OrderSuccess](../my-app/src/pages/OrderSuccess.jsx) | Reads receipt from router state |
| `/about` | [About](../my-app/src/pages/About.jsx) | Public storefront page |
| `/contact` | [Contact](../my-app/src/pages/Contact.jsx) | Public storefront page |
| `/faq` | [Faq](../my-app/src/pages/Faq.jsx) | Public storefront page |
| `/policies` | [Policies](../my-app/src/pages/Policies.jsx) | Initial tab query: shipping, returns, privacy, terms |
| `*` | [NotFound](../my-app/src/pages/NotFound.jsx) | Catch-all storefront page |
| `/admin` | [AdminDashboard](../my-app/src/pages/admin/AdminDashboard.tsx) | Verified JWT + server-confirmed admin role |
| `/admin/products` | [ManageProducts](../my-app/src/pages/admin/ManageProducts.jsx) | Verified JWT + server-confirmed admin role |
| `/admin/banners` | [ManageBanners](../my-app/src/pages/admin/ManageBanners.jsx) | Verified JWT + server-confirmed admin role |
| `/admin/categories` | [ManageCategories](../my-app/src/pages/admin/ManageCategories.jsx) | Verified JWT + server-confirmed admin role |
| `/admin/collections` | [ManageCollections](../my-app/src/pages/admin/ManageCollections.jsx) | Verified JWT + server-confirmed admin role |
| `/admin/orders` | [ManageOrders](../my-app/src/pages/admin/manageorders.jsx) | Verified JWT + server-confirmed admin role; load errors are shown with retry |
| `/admin/customers` | [ManageCustomers](../my-app/src/pages/admin/ManageCustomers.tsx) | Verified JWT + server-confirmed admin role |
| `/admin/customers/:id` | [CustomerDetails](../my-app/src/pages/admin/CustomerDetails.tsx) | Verified JWT + server-confirmed admin role |
| `/admin/transactions` | [Transactions](../my-app/src/pages/admin/Transactions.tsx) | Verified JWT + server-confirmed admin role |
| `/admin/settings` | [SystemSettings](../my-app/src/pages/admin/SystemSettings.tsx) | Verified JWT + server-confirmed admin role |
| `/admin/suppliers` | [ManageSuppliers](../my-app/src/pages/admin/ManageSuppliers.tsx) | Verified JWT + server-confirmed admin role |
| `/admin/purchases` | [ManagePurchases](../my-app/src/pages/admin/ManagePurchases.tsx) | Verified JWT + server-confirmed admin role |

`/admin` is the parent layout and index page. Storefront routes have Navbar/Footer. There is no separate register route, guest tracking API route, collection detail route, supplier detail route, or frontend payment route. `StripeCheckoutForm` is embedded in Checkout. Shop ignores `brand` query parameters even though brand links supply them. Policies reads its tab query for initial state only.

## Mounted HTTP endpoints

All paths below use JSON bodies/responses unless an unmatched path falls through Express's default response. Protected endpoints require `Authorization: Bearer <token>`. `protect` resolves the current SQL user; `adminOnly` requires its admin role. Most failures return `{ success: false, message }`. No explicit JSON API 404 handler exists.

| Method | Full path | Access | Handler |
| --- | --- | --- | --- |
| GET | `/` | Public | server.js diagnostic, not dependency readiness |
| POST | `/api/auth/register` | Public | [server/routes/authRoutes.js](../server/routes/authRoutes.js) |
| POST | `/api/auth/login` | Public | [server/routes/authRoutes.js](../server/routes/authRoutes.js) |
| GET | `/api/auth/me` | JWT | [server/routes/authRoutes.js](../server/routes/authRoutes.js) |
| GET | `/api/products` | Public | [server/routes/productRoutes.js](../server/routes/productRoutes.js) |
| GET | `/api/products/:id` | Public | [server/routes/productRoutes.js](../server/routes/productRoutes.js) |
| POST | `/api/products` | JWT + admin | [server/routes/productRoutes.js](../server/routes/productRoutes.js) |
| PUT | `/api/products/:id` | JWT + admin | [server/routes/productRoutes.js](../server/routes/productRoutes.js) |
| DELETE | `/api/products/:id` | JWT + admin | [server/routes/productRoutes.js](../server/routes/productRoutes.js) |
| GET | `/api/categories` | Public | [server/routes/categoryRoutes.js](../server/routes/categoryRoutes.js) |
| POST | `/api/categories` | JWT + admin | [server/routes/categoryRoutes.js](../server/routes/categoryRoutes.js) |
| PUT | `/api/categories/:id` | JWT + admin | [server/routes/categoryRoutes.js](../server/routes/categoryRoutes.js) |
| DELETE | `/api/categories/:id` | JWT + admin | [server/routes/categoryRoutes.js](../server/routes/categoryRoutes.js) |
| GET | `/api/banners` | Public | [server/routes/bannerRoutes.js](../server/routes/bannerRoutes.js) |
| POST | `/api/banners` | JWT + admin | [server/routes/bannerRoutes.js](../server/routes/bannerRoutes.js) |
| PUT | `/api/banners/:id` | JWT + admin | [server/routes/bannerRoutes.js](../server/routes/bannerRoutes.js) |
| DELETE | `/api/banners/:id` | JWT + admin | [server/routes/bannerRoutes.js](../server/routes/bannerRoutes.js) |
| GET | `/api/collections` | Public | [server/routes/collectionRoutes.js](../server/routes/collectionRoutes.js) |
| POST | `/api/collections` | JWT + admin | [server/routes/collectionRoutes.js](../server/routes/collectionRoutes.js) |
| PUT | `/api/collections/:id` | JWT + admin | [server/routes/collectionRoutes.js](../server/routes/collectionRoutes.js) |
| DELETE | `/api/collections/:id` | JWT + admin | [server/routes/collectionRoutes.js](../server/routes/collectionRoutes.js) |
| POST | `/api/orders/create-payment-intent` | Public | [server/routes/orderRoutes.js](../server/routes/orderRoutes.js) |
| POST | `/api/orders` | Public | [server/routes/orderRoutes.js](../server/routes/orderRoutes.js) |
| GET | `/api/orders/my-orders` | JWT | [server/routes/orderRoutes.js](../server/routes/orderRoutes.js) |
| GET | `/api/orders` | JWT + admin | [server/routes/orderRoutes.js](../server/routes/orderRoutes.js) |
| PUT | `/api/orders/:id/status` | JWT + admin | [server/routes/orderRoutes.js](../server/routes/orderRoutes.js) |
| GET | `/api/admin/stats` | JWT + admin | [server/routes/adminRoutes.js](../server/routes/adminRoutes.js) |
| GET | `/api/admin/customers` | JWT + admin | [server/routes/adminRoutes.js](../server/routes/adminRoutes.js) |
| PUT | `/api/admin/customers/:id` | JWT + admin | [server/routes/adminRoutes.js](../server/routes/adminRoutes.js) |
| DELETE | `/api/admin/customers/:id` | JWT + admin | [server/routes/adminRoutes.js](../server/routes/adminRoutes.js) |
| GET | `/api/admin/customers/:id/details` | JWT + admin | [server/routes/adminRoutes.js](../server/routes/adminRoutes.js) |
| POST | `/api/admin/customers/:id/payments` | JWT + admin | [server/routes/adminRoutes.js](../server/routes/adminRoutes.js) |
| GET | `/api/admin/suppliers` | JWT + admin | [server/routes/adminRoutes.js](../server/routes/adminRoutes.js) |
| POST | `/api/admin/suppliers` | JWT + admin | [server/routes/adminRoutes.js](../server/routes/adminRoutes.js) |
| PUT | `/api/admin/suppliers/:id` | JWT + admin | [server/routes/adminRoutes.js](../server/routes/adminRoutes.js) |
| DELETE | `/api/admin/suppliers/:id` | JWT + admin | [server/routes/adminRoutes.js](../server/routes/adminRoutes.js) |
| GET | `/api/admin/purchases` | JWT + admin | [server/routes/adminRoutes.js](../server/routes/adminRoutes.js) |
| POST | `/api/admin/purchases` | JWT + admin | [server/routes/adminRoutes.js](../server/routes/adminRoutes.js) |
| PUT | `/api/admin/purchases/:id` | JWT + admin | [server/routes/adminRoutes.js](../server/routes/adminRoutes.js) |
| PATCH | `/api/admin/purchases/:id/payment` | JWT + admin | [server/routes/adminRoutes.js](../server/routes/adminRoutes.js) |
| DELETE | `/api/admin/purchases/:id` | JWT + admin | [server/routes/adminRoutes.js](../server/routes/adminRoutes.js) |

## Payloads and response fields

| Endpoint / operation | Request fields | Main success response |
| --- | --- | --- |
| Auth register | name, email, password; backend also accepts role (security defect) | 201: user {id,name,email,role}, token, message |
| Auth login | email, password | user, token, message |
| Auth me | Bearer token | user {id,name,email,role} |
| Products list | Optional query category, search | count, products array sorted by id descending |
| Product detail | Path id | product |
| Product create/update | name, sku, category_id, category_name, price, original_price, stock, image, description, status | Create: 201 + productId; update: message |
| Categories list | None | count, categories sorted by id ascending, including hidden |
| Category create/update | name, count, img, link, isVisible; update accepts defined allowlisted subset | Create: 201 + category; update: message |
| Banners list | None | count, banners sorted by position then id, including inactive |
| Banner create/update | title, description, buttonText, image, isActive, position | Create: 201 + banner; update: message |
| Collections list | None | count, collections sorted by id descending, including inactive |
| Collection create/update | name, description, badge, image, productCount, isActive | Create: 201 + collection; update: message |
| Catalog/category/banner/collection delete | Path id | message; 404 when no affected row |
| Orders create-payment-intent | amount in major units (browser supplied) | clientSecret, success |
| Orders create | customer, items, totalAmount, paymentMethod, paymentStatus, transactionId, userId | 201: orderId, message, success; emailSent unreliable |
| Orders list/my-orders | JWT; my-orders restricts SQL user_id | orders with nested items; admin list also count |
| Order status | order_status | message, success; emailSent unreliable |
| Admin stats | JWT + admin | stats {totalRevenue,totalOrders,totalProducts,totalCustomers,recentOrders,orderStatus} |
| Customers list | JWT + admin | customers {id,name,email,joined,orders,spent,phone,city} |
| Customer update | name, email | message; duplicate email gives 409 |
| Customer delete | Path id; only user role deleted | message; orders retained with null user_id |
| Customer details | Path id | customer, orders with items_summary, ledger, summary |
| Customer payments | amount > 0, optional description, payment_method | 201: message; creates manual credit |
| Suppliers list | JWT + admin | suppliers with invoice count, purchase/paid/due totals, `total_unpaid` alias and last purchase date |
| Supplier create/update | name required, company_name, phone, email, address | supplier; create is 201 |
| Supplier delete | Path id | message |
| Purchases list | JWT + admin | purchases with supplier labels, item count, nested items and calculated subtotals |
| Purchase create | supplier_id, invoice_no, purchase_date, payment_method, paid_amount, items [{product_id,quantity,cost_price}] | 201: purchaseId, invoice_no, total_amount, paid_amount, due_amount, payment_status |
| Purchase update | Same fields as create | Replaces invoice lines and applies only the net stock difference in a transaction |
| Purchase payment | paid_amount, payment_method | Recalculates due amount and Paid/Partial/Unpaid state |
| Purchase delete | Path id | Reverses received stock and deletes the invoice in a transaction; rejected if reversal would make stock negative |

All mounted success responses include `success: true`. Create handlers apply defaults to absent optional values; product/banner/collection PUT handlers generally replace all listed fields and should not be treated as PATCH. Validation is incomplete; consult handlers for exact behavior. Duplicate purchase invoice numbers produce 409. Most SQL/provider errors are returned as 500 with their message.

### Order request shape

```json
{
  "customer": {"firstName":"Example","lastName":"Customer","email":"customer@example.com","phone":"example","address":"Example address","city":"Lahore"},
  "items": [{"id":1,"title":"Example product","price":1000,"quantity":1,"image":""}],
  "totalAmount":1200,
  "paymentMethod":"Cash on Delivery",
  "paymentStatus":"Unpaid",
  "transactionId":null,
  "userId":null
}
```

This documents the accepted shape, not secure validation. Customer also supports `name`; item name accepts `name` or `title`. Totals and payment fields currently remain caller-controlled.

### Status and filter semantics

- Orders: Pending, Processing, Shipped, Delivered, Completed, Cancelled; no enforced transition sequence.
- Product status: Active, Low Stock, Out of Stock.
- Purchase payment status: Paid, Unpaid, Partial; purchase method: Cash or Bank Transfer.
- Product API category filtering matches exact category_name or category_id; only literal `All` disables its category predicate. API search covers name, SKU, description using LIKE. Storefront Shop filters its already-loaded context separately.
- List APIs have no pagination parameters.

## Unmounted and missing routes

[server/routes/paymentRoutes.js](../server/routes/paymentRoutes.js) defines POST `/create-payment-intent` in its own router using PKR, but has no mount and therefore no reachable full URL. Do not call `/api/payments/create-payment-intent` based on this file.

The purchase UI uses the public catalog list at `/api/products` for its admin product selector. No endpoints exist for profile updates, carts, wishlists, reviews, contact messages, settings, coupons, transactions, refunds, guest tracking, or collection membership. Banner endpoints, `/api/admin/stats`, and product-detail GET exist but are not consumed by their corresponding current frontend views.
