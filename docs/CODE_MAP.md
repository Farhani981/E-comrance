# Code map and file inventory

First-party source and configuration inspected on 2026-09-09. This map excludes dependency internals and generated build output. Paths preserve actual case: `component` is singular, `categories.jsx` and `login.jsx` are lowercase, and admin `manageorders.jsx` is lowercase. Preserve these when deploying on a case-sensitive filesystem.

## Application source and configuration

| File | Responsibility / maintenance note |
| --- | --- |
| [my-app/.gitignore](../my-app/.gitignore) | Frontend logs, build/dependency and editor exclusions; does not cover sibling server .env. |
| [my-app/.oxlintrc.json](../my-app/.oxlintrc.json) | React/TypeScript/Oxc lint plugins and project rules. |
| [my-app/README.md](../my-app/README.md) | Existing Vite template README retained; root README is the project-specific entry. |
| [my-app/build.log](../my-app/build.log) | Existing generated log; not reliable evidence about the present source. |
| [my-app/index.html](../my-app/index.html) | ShopHub title/favicon, root element and main.tsx module entry. |
| [my-app/package.json](../my-app/package.json) | Frontend dependencies and dev/build/lint/preview scripts. |
| [my-app/src/App.css](../my-app/src/App.css) | Unimported template CSS; not the active storefront stylesheet. |
| [my-app/src/App.tsx](../my-app/src/App.tsx) | All 27 frontend route entries; Home composition, storefront layout and scroll reset. |
| [my-app/src/component/DeleteConfirmModal.jsx](../my-app/src/component/DeleteConfirmModal.jsx) | Reusable destructive-action overlay; parent owns actual deletion. |
| [my-app/src/component/FeaturedProducts.jsx](../my-app/src/component/FeaturedProducts.jsx) | Renders all context products with direct cart addition; no featured backend flag. |
| [my-app/src/component/Footer.jsx](../my-app/src/component/Footer.jsx) | Static shop/support/policy/social links and copyright; not driven by settings. |
| [my-app/src/component/Hero.jsx](../my-app/src/component/Hero.jsx) | Five-second banner carousel plus two promotional cards; context data with built-in fallbacks. |
| [my-app/src/component/ImageUploadInput.jsx](../my-app/src/component/ImageUploadInput.jsx) | URL/file/drag-drop input; 5 MiB limit, canvas JPEG compression and preview/removal. |
| [my-app/src/component/LogoCarousel.jsx](../my-app/src/component/LogoCarousel.jsx) | Duplicated brand track for CSS scrolling; custom prop or dynamic_brands storage or defaults. |
| [my-app/src/component/Navbar.jsx](../my-app/src/component/Navbar.jsx) | Static category navigation, search URL navigation, mobile menu and context badges/session menu. |
| [my-app/src/component/categories.jsx](../my-app/src/component/categories.jsx) | Homepage feature strip and visible category cards; image fallbacks and default cards. |
| [my-app/src/context/AdminAlertContext.jsx](../my-app/src/context/AdminAlertContext.jsx) | Admin toast provider, auto-dismiss timers and window.adminAlert bridge; browser-alert fallback outside provider. |
| [my-app/src/context/AuthContext.jsx](../my-app/src/context/AuthContext.jsx) | JWT login/register calls, network demo sessions, browser profile/order persistence and logout. |
| [my-app/src/context/CartContext.jsx](../my-app/src/context/CartContext.jsx) | Variant-keyed browser cart, quantity changes, removal and count. |
| [my-app/src/context/ProductContext.jsx](../my-app/src/context/ProductContext.jsx) | Product/category API mapping, fallback normalization, mutation helpers, storage quota handling and local banner state. |
| [my-app/src/context/WishlistContext.jsx](../my-app/src/context/WishlistContext.jsx) | Browser wishlist membership, toggle and count. |
| [my-app/src/index.css](../my-app/src/index.css) | Imported Tailwind CSS entry plus fadeIn/scaleUp animations. |
| [my-app/src/layout/AdminLayout.tsx](../my-app/src/layout/AdminLayout.tsx) | Desktop/mobile admin navigation and shell; verifies token/admin role through auth/me and performs real logout. |
| [my-app/src/main.tsx](../my-app/src/main.tsx) | DOM entry; StrictMode, router and shared provider nesting. |
| [my-app/src/pages/About.jsx](../my-app/src/pages/About.jsx) | Static brand story, values, metrics and shop navigation. |
| [my-app/src/pages/Account.jsx](../my-app/src/pages/Account.jsx) | Login prompt, local profile editing, local order count and real AuthContext logout. |
| [my-app/src/pages/Cart.jsx](../my-app/src/pages/Cart.jsx) | Variant rows and quantity/remove actions; summary uses shipping rules different from checkout. |
| [my-app/src/pages/Checkout.jsx](../my-app/src/pages/Checkout.jsx) | Shipping/payment form, WELCOME10 discount, totals, order API writes, local receipt and navigation. |
| [my-app/src/pages/Contact.jsx](../my-app/src/pages/Contact.jsx) | Contact details and form with temporary local submitted state; sends nothing. |
| [my-app/src/pages/Faq.jsx](../my-app/src/pages/Faq.jsx) | Static questions, text search and accordion state. |
| [my-app/src/pages/NotFound.jsx](../my-app/src/pages/NotFound.jsx) | Storefront catch-all with home/catalog navigation. |
| [my-app/src/pages/OrderSuccess.jsx](../my-app/src/pages/OrderSuccess.jsx) | Router-state receipt and generic fallback; no order verification fetch. |
| [my-app/src/pages/Orders.jsx](../my-app/src/pages/Orders.jsx) | JWT my-orders fetch, filtering and order query selection for invoice/timeline display. |
| [my-app/src/pages/Policies.jsx](../my-app/src/pages/Policies.jsx) | Static policy tabs initialized from URL tab query. |
| [my-app/src/pages/ProductDetail.jsx](../my-app/src/pages/ProductDetail.jsx) | Context product lookup, gallery, variants, cart, wishlist, local reviews and related products. |
| [my-app/src/pages/Shop.jsx](../my-app/src/pages/Shop.jsx) | Client-side product filtering/sorting/grid layout; category/sub/search URL inputs and filter drawer. |
| [my-app/src/pages/StripeCheckoutForm.jsx](../my-app/src/pages/StripeCheckoutForm.jsx) | Embedded Elements card form, PaymentIntent creation and confirmation callback; not a standalone route. |
| [my-app/src/pages/Wishlist.jsx](../my-app/src/pages/Wishlist.jsx) | Saved product cards; move-to-cart adds then removes from wishlist. |
| [my-app/src/pages/admin/AdminDashboard.tsx](../my-app/src/pages/admin/AdminDashboard.tsx) | Orders fetch and context products; mixed live/sample KPIs and recent orders. |
| [my-app/src/pages/admin/CustomerDetails.tsx](../my-app/src/pages/admin/CustomerDetails.tsx) | Customer summary, typed API response, order/ledger tabs, manual payment and printable invoice. |
| [my-app/src/pages/admin/ManageBanners.jsx](../my-app/src/pages/admin/ManageBanners.jsx) | Browser-only slider CRUD/reorder/visibility and two-column promo editors. |
| [my-app/src/pages/admin/ManageCategories.jsx](../my-app/src/pages/admin/ManageCategories.jsx) | Category card editor, search/counts, visibility toggle, generated links, broken-image state and inline delete confirmation. |
| [my-app/src/pages/admin/ManageCollections.jsx](../my-app/src/pages/admin/ManageCollections.jsx) | Direct API collection CRUD and active toggle; edit payload omits active flag. |
| [my-app/src/pages/admin/ManageCustomers.tsx](../my-app/src/pages/admin/ManageCustomers.tsx) | Customer API list/metrics, name/email search, edit/delete and detail navigation; city selector is unimplemented. |
| [my-app/src/pages/admin/ManageProducts.jsx](../my-app/src/pages/admin/ManageProducts.jsx) | Search/filter inventory, create/edit dialog, category hierarchy and delete confirmation through context. |
| [my-app/src/pages/admin/ManagePurchases.tsx](../my-app/src/pages/admin/ManagePurchases.tsx) | Purchase dashboard, search/filter/pagination/export/print, invoice CRUD, payment updates and repeatable stock lines. |
| [my-app/src/pages/admin/ManageSuppliers.tsx](../my-app/src/pages/admin/ManageSuppliers.tsx) | Supplier CRUD, live financial summaries, search/export, guarded deletion and purchase drill-down. |
| [my-app/src/pages/admin/SystemSettings.tsx](../my-app/src/pages/admin/SystemSettings.tsx) | In-memory settings sections and coupons; Save only toggles feedback. |
| [my-app/src/pages/admin/Transactions.tsx](../my-app/src/pages/admin/Transactions.tsx) | Static transaction rows/totals with local search/status filtering. |
| [my-app/src/pages/admin/manageorders.jsx](../my-app/src/pages/admin/manageorders.jsx) | Admin orders list/search/status filter; visible API/session errors with retry; empty states; details overlay and status API. |
| [my-app/src/pages/login.jsx](../my-app/src/pages/login.jsx) | Login/register tabs, confirmation-password validation, role-based post-login navigation. |
| [my-app/src/productsData.jsx](../my-app/src/productsData.jsx) | Ten fallback products, nine category cards and ten brand logos; not SQL seed data. |
| [my-app/tailwind.config.ts](../my-app/tailwind.config.ts) | Standalone theme/animation configuration; not explicitly referenced by active CSS/Vite setup. |
| [my-app/test_api.bat](../my-app/test_api.bat) | Manual curl helper; registers an admin and logs in; no assertions and outdated auth comment. |
| [my-app/tsconfig.app.json](../my-app/tsconfig.app.json) | App compiler options; allowJs, noEmit, unused checks; checkJs is not enabled. |
| [my-app/tsconfig.json](../my-app/tsconfig.json) | References app and Node TypeScript projects. |
| [my-app/tsconfig.node.json](../my-app/tsconfig.node.json) | Type-checks Vite configuration with Node types. |
| [my-app/vite.config.ts](../my-app/vite.config.ts) | React and Tailwind Vite plugins; no backend proxy. |
| [server/config/db.js](../server/config/db.js) | Database creation, schema execution, runtime ALTER/backfill and mysql2 pool. |
| [server/middleware/authMiddleware.js](../server/middleware/authMiddleware.js) | Bearer JWT verification, SQL user lookup and admin role authorization. |
| [server/package.json](../server/package.json) | Backend dependencies and start/dev scripts. |
| [server/routes/adminRoutes.js](../server/routes/adminRoutes.js) | Stats, customer CRUD/detail/manual credits, supplier CRUD and purchase invoice/stock-in transactions. |
| [server/routes/authRoutes.js](../server/routes/authRoutes.js) | Registration/login/profile endpoints, hashing and JWT; admin role and password-bypass defects. |
| [server/routes/bannerRoutes.js](../server/routes/bannerRoutes.js) | Public list and admin SQL banner CRUD; current banner UI does not consume this router. |
| [server/routes/categoryRoutes.js](../server/routes/categoryRoutes.js) | Public list and admin category CRUD; partial allowlisted PUT updates. |
| [server/routes/collectionRoutes.js](../server/routes/collectionRoutes.js) | Public list and admin metadata CRUD; no membership endpoints. |
| [server/routes/orderRoutes.js](../server/routes/orderRoutes.js) | Mounted Stripe intent, order transaction/stock decrement, user/admin lists and status/email updates. |
| [server/routes/paymentRoutes.js](../server/routes/paymentRoutes.js) | Unmounted duplicate Stripe PaymentIntent router with different currency. |
| [server/routes/productRoutes.js](../server/routes/productRoutes.js) | Public product list/detail plus admin CRUD; SQL writes stock but not stock_quantity. |
| [server/schema.sql](../server/schema.sql) | Eleven base tables, FK rules, fixed category/banner seed inserts; hardcoded database name. |
| [server/server.js](../server/server.js) | Express bootstrap, middleware, seven router mounts, diagnostic route and dependency initialization. |
| [server/utils/sendEmail.js](../server/utils/sendEmail.js) | Gmail transport verification and HTML/text order-status email formatting/sending. |

## Assets and other files

| File | Role |
| --- | --- |
| [my-app/package-lock.json](../my-app/package-lock.json) | Locked dependency graph; generated dependency metadata |
| [my-app/public/.htaccess](../my-app/public/.htaccess) | Apache mod_rewrite SPA fallback to /index.html for non-file/non-directory paths; assumes web-root deployment |
| [my-app/public/icons.svg](../my-app/public/icons.svg) | Public static asset served by path; presence alone does not prove a current import/reference |
| [my-app/public/images/casual_streetwear_antigravity_1787833775355.jpg](../my-app/public/images/casual_streetwear_antigravity_1787833775355.jpg) | Public static asset served by path; presence alone does not prove a current import/reference |
| [my-app/public/images/fashion_accessories_antigravity_1787833812549.jpg](../my-app/public/images/fashion_accessories_antigravity_1787833812549.jpg) | Public static asset served by path; presence alone does not prove a current import/reference |
| [my-app/public/images/formal_smart_casual_antigravity_1787833790889.jpg](../my-app/public/images/formal_smart_casual_antigravity_1787833790889.jpg) | Public static asset served by path; presence alone does not prove a current import/reference |
| [my-app/src/assets/beautiful-women-shopping-together.jpg](../my-app/src/assets/beautiful-women-shopping-together.jpg) | Bundler asset; logo.png is referenced by navigation/footer/about and index favicon |
| [my-app/src/assets/download.png](../my-app/src/assets/download.png) | Bundler asset; logo.png is referenced by navigation/footer/about and index favicon |
| [my-app/src/assets/happy-couple-looking-big-shop-display.jpg](../my-app/src/assets/happy-couple-looking-big-shop-display.jpg) | Bundler asset; logo.png is referenced by navigation/footer/about and index favicon |
| [my-app/src/assets/heroleft1 (1).jpg](../my-app/src/assets/heroleft1%20%281%29.jpg) | Bundler image asset; included in the source asset inventory |
| [my-app/src/assets/heroleft1 (3).jpg](../my-app/src/assets/heroleft1%20%283%29.jpg) | Bundler image asset; included in the source asset inventory |
| [my-app/src/assets/heroleft3.jpg](../my-app/src/assets/heroleft3.jpg) | Bundler asset; logo.png is referenced by navigation/footer/about and index favicon |
| [my-app/src/assets/logo.png](../my-app/src/assets/logo.png) | Bundler asset; logo.png is referenced by navigation/footer/about and index favicon |
| [my-app/src/assets/portrait-man-shopping-buying-consumer-goods.jpg](../my-app/src/assets/portrait-man-shopping-buying-consumer-goods.jpg) | Bundler asset; logo.png is referenced by navigation/footer/about and index favicon |
| [my-app/src/assets/y8joawhwm2j2tkathcmt.webp](../my-app/src/assets/y8joawhwm2j2tkathcmt.webp) | Bundler asset; logo.png is referenced by navigation/footer/about and index favicon |
| `server/.env` | Private runtime configuration; values not inspected or documented |
| [server/package-lock.json](../server/package-lock.json) | Locked dependency graph; generated dependency metadata |

`my-app/node_modules`, `server/node_modules`, and `my-app/dist` were present but are generated/vendor directories. Images were inventoried and source references traced; pixel content and external image availability were not browser-verified. No AGENTS.md was found in the supplied workspace.

## Where to start a change

| Change | Follow this chain |
| --- | --- |
| Add a page | Page component -> App route -> Navbar/Footer or AdminLayout menu -> route/wireframe docs |
| Add an API | Router handler -> server mount if new router -> authentication -> SQL -> frontend caller -> API docs |
| Add product data | schema.sql + startup migrations -> product routes -> ProductContext mapping/write payloads -> admin form -> storefront |
| Change category behavior | Category maintenance guide -> context -> category router -> homepage cards and Shop predicate |
| Change checkout pricing | Cart + Checkout + server validation + Stripe intent + policy/settings copy |
| Change stock accounting | Product CRUD + order creation + purchase transaction + db.js backfill + context refresh |
| Change customer balance | adminRoutes details/credits + CustomerDetails + cancellation/payment lifecycle |
| Change emails | sendEmail transport/template + both order callers + emailSent response handling |

## Less obvious coupling

The frontend uses several product shapes: sample/context objects use title and originalPrice, SQL uses name and original_price, receipts use orderId/grandTotal, SQL orders use id/total_amount. Do not copy payloads between screens without tracing the mapping. Admin clients read tokens directly from localStorage as well as through context. localStorage is not partitioned per account. Schema changes can happen during every server boot. Startup imports an unused default db export to trigger module loading. Browser-only banners and SQL banners are separate data stores.
