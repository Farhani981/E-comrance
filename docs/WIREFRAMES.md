# Source-derived wireframes

> Current men?s taxonomy and mega-navigation: [Men?s catalog](MENS_CATALOG.md) supersedes older static/six-department category notes below.

> Hero/banner implementation updated: [Hero and campaign management](HERO_CAMPAIGNS.md) supersedes the older banner storage, field mapping, API and carousel notes below.

These are structural sketches of the current JSX/TSX, not browser screenshots or pixel-accurate visual validation. Components generally use white/slate surfaces, dark buttons, rounded cards, and responsive Tailwind grids. See [route reference](ROUTES_AND_API.md) for page paths and [feature status](ARCHITECTURE.md) for persistence.

## Storefront shell and homepage

```text
+------------------------------------------------------------------+
| Announcement: free shipping / coupon                              |
| ShopHub logo | category menus | search | account | wishlist | cart |
+------------------------------------------------------------------+
| Hero image carousel                                              |
| Badge / heading / optional subtitle + CTA             < > / dots  |
+------------------------------------------------------------------+
| Promotional card A             | Promotional card B              |
+------------------------------------------------------------------+
| Shipping | returns | payment | support feature strip              |
| Category heading + View All                                      |
| [Category image/name/count] [Category] [Category] ...              |
| Featured products                                                |
| [Image/title/description/price/Add to Cart] ...                    |
| Scrolling brand logos                                            |
+------------------------------------------------------------------+
| Brand/social | shop links | customer care | legal/account links   |
| Copyright / payment labels                                       |
+------------------------------------------------------------------+
```

Source: [App](../my-app/src/App.tsx), [Hero](../my-app/src/component/Hero.jsx), [categories](../my-app/src/component/categories.jsx), [FeaturedProducts](../my-app/src/component/FeaturedProducts.jsx). Featured products maps the entire context list; there is no featured SQL flag. Hero rotates every five seconds. Desktop navbar has hover menus; mobile uses toggleable navigation and search.

## Shop and product details

```text
SHOP
  Heading / result count / grid controls
  +---------------------+-------------------------------------------+
  | Filter accordions   | Product grid                              |
  | Type / color / size | [Image + wishlist] [Image + wishlist]      |
  | Season / price      | [Title / swatches / price / cart]           |
  | Gender / fit / sort | ...                                       |
  | Reset filters       | Empty-results state when no matches       |
  +---------------------+-------------------------------------------+
  Small screens: filters open as a drawer.

PRODUCT DETAILS
  Breadcrumb / navigation
  +-----------------------------+-----------------------------------+
  | Main selected image         | Category / title / rating         |
  | Wishlist control            | Price / original price / stock    |
  | Image thumbnails            | Color / size / sizing-guide link  |
  |                             | Quantity [-] [n] [+]              |
  |                             | Add to Cart / Wishlist            |
  +-----------------------------+-----------------------------------+
  Features tab | Reviews tab -> local review modal
  Related product cards
```

Source: [Shop](../my-app/src/pages/Shop.jsx), [ProductDetail](../my-app/src/pages/ProductDetail.jsx). Only category/subcategory, color, size, price, search, and sorting are implemented in the Shop predicate. Product detail has a missing-product state and disables its main cart button when `inStock` is false. Other cart entry points do not necessarily use that guard.

## Cart, wishlist, and checkout

```text
CART
  [Product image/title/size/color/price] [- quantity +] [Remove]
  Repeated item rows                         | Summary + checkout link
  Empty state -> catalog

WISHLIST
  [Product card / price / Move to Cart / Remove] ...
  Empty state -> shop/home

CHECKOUT (desktop: shipping/payment span two of three columns)
  +---------------------------------------+-------------------------+
  | Shipping details                      | Order summary           |
  | Full name         Email               | Item thumbnails + qty   |
  | Phone             City                | Coupon input + Apply    |
  | Complete delivery address             | Subtotal / discount     |
  |                                       | Shipping / grand total  |
  | Payment method                        | COD submit action       |
  | ( ) Cash on Delivery                  |                         |
  | ( ) Credit / Debit Card               |                         |
  |     Stripe card element + Pay button   |                         |
  +---------------------------------------+-------------------------+
  Empty cart -> No Items to Checkout
```

The card form is currently nested inside the main checkout form, an implementation defect. Summary is sticky on larger screens. Source: [Cart](../my-app/src/pages/Cart.jsx), [Wishlist](../my-app/src/pages/Wishlist.jsx), [Checkout](../my-app/src/pages/Checkout.jsx).

## Login, account, orders, and receipt

| Screen | Structure / states |
| --- | --- |
| Login | Centered card; login/register tabs; name on registration; email/password; confirmation; visibility toggle; error; submit |
| Account | Anonymous access-restricted card, or profile header; order count; profile edit fields; local account information; logout |
| Orders | Heading; all/processing/delivered tabs; order-ID search; loading/empty states; order cards with item summaries |
| Tracked order | Order ID/status; date/items/payment/total strip; four-stage delivery timeline or cancelled notice; invoice lines; address panel |
| Order success | Confirmation badge; receipt ID/date; shipping/payment details; item/total summary; track/continue links; generic fallback without receipt state |

## Admin shell

```text
+---------------------+--------------------------------------------+
| ShopHub ADMIN       | Sidebar toggle / page title / shop/settings|
| Search menu items   +--------------------------------------------+
| Dashboard           | Page content                               |
| Products            |                                            |
| Banners             | Heading                         Primary CTA|
| Categories          | [Metric] [Metric] [Metric] ...             |
| Collections         | Search / filters                           |
| Orders              | Table or cards                             |
| Customers           |                                            |
| Transactions        | Overlay: editor / details / confirmation   |
| Settings            |                                            |
| Suppliers           | Toast alerts float at top right            |
| Purchases           |                                            |
| Shop / Logout       |                                            |
+---------------------+--------------------------------------------+
```

Desktop sidebar collapses to icons; mobile opens an overlay panel and backdrop. Sidebar badges are hardcoded. The layout shows a session-check screen before admin content, redirects invalid/non-admin sessions to login, and logout clears the session. Source: [AdminLayout](../my-app/src/layout/AdminLayout.tsx).

## Every admin page

| Route suffix | Main layout | Dialogs / actions |
| --- | --- | --- |
| index | Revenue/orders/products/customers metric cards; status summary; recent orders; sample top products | Dashboard data combines API and demo values |
| products | Add product; stock summary cards; search/category/status filters; product table | Add/edit product form; image input; delete confirmation |
| categories | Add category; total/visible/hidden cards; search; image cards | Name/count/image/link editor; visibility toggle; inline deletion confirmation |
| banners | Slider/two-column tabs; counts; search; banner list/cards | Add/edit image and text; active toggle; reorder; delete; two promo-card editors |
| collections | Add collection; summary cards; search; collection cards | Name/description/badge/image/productCount editor; active toggle; delete |
| orders | Status metric cards; search/status filter; order list; explicit API/session error and true-empty/filter-empty states | Retry action; status selector; order details with customer/address/items |
| customers | Customer metrics; name/email search; city select; customer table | Edit name/email; delete confirmation; navigate to customer detail; modal code also exists in row markup |
| customers/:id | Back link; customer identity; spend/paid/balance metrics; orders/ledger tabs | Manual payment amount/method/note form; print invoice |
| transactions | Fixed totals; search/status filter; sample transaction table | Display/download control without a connected transaction backend |
| settings | Section selector and form panel | Store, shipping, payment, social/SEO, notifications, coupons; local add/delete coupon; save indicator |
| suppliers | Live supplier/invoice/value/due cards; searchable financial table; CSV export; purchase drill-down | Add/edit contact/company/address form; explained delete dialog |
| purchases | Invoice/stock-value/paid/due cards; supplier/status/method/date/search filters; pagination and CSV export | Create/edit invoice with repeatable stock lines; quick-create a missing catalog product; record payment; view/print; guarded delete with stock reversal |

## Informational pages

| Route | Structure |
| --- | --- |
| /about | Brand introduction, values, static counters, shop CTA |
| /contact | Contact cards beside name/email/subject/message form; temporary success state |
| /faq | Heading, search, expandable question list, contact CTA |
| /policies | Shipping/returns/privacy/terms tabs and text content |
| unmatched route | 404 message with home/catalog links in storefront shell |

All pages stack major columns at smaller breakpoints. Actual visual dimensions, keyboard focus behavior, and accessibility still require browser testing.
