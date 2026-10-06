# Men’s mega-navigation and catalog

Updated 2026-09-09. This is the current contract, superseding the earlier six-department/static-navigation notes.

## Storefront

The header uses Tailwind utilities for a slate-900 announcement bar, custom SVG ShopHub branding, a wide gray search field, and account/wishlist/bag actions. The centered department row opens the database-driven mega-menu. On mobile, search remains visible beneath the branding and action row; the support link is available in the drawer. Menu styling follows the slate and orange storefront palette.

The four primary tabs are **Top Wear**, **Bottom Wear**, **Eastern Wear**, and **Accessories**. SQL is authoritative for their subcategories, product types, display order and optional mega-menu promotional copy/image. The initial catalog has 17 subcategories and 47 specific product types; footwear and grooming live under Accessories. `shared/mensCatalog.js` contains the one-time seed and legacy aliases, not the live navigation data source.

Desktop navigation supports pointer hover, click, keyboard activation, Arrow Down into the menu, Escape, focus departure and outside click. The multi-column menu links to whole departments, subcategories and individual product types. Below 900px, a native modal dialog supplies focus containment, background scroll locking, dismissal and focus return; department accordions expand to subcategory links and optional product-type accordions. Search, account, wishlist and cart stay connected to the existing contexts/routes. Reduced-motion preferences suppress menu animation.

Links use stable slugs, for example:

`/products?category=eastern-wear&subcategory=kurta-suits`

`/products?category=eastern-wear&subcategory=kurta-suits&type=kurta-pajama&fit=Slim+Fit&occasion=Formal`

`/products` and legacy `/shop` render Shop. Shop filters category, subcategory, product type, fit and occasion together. Legacy `sub` query parameters and recognized category aliases are still accepted. Price/color/size remain supported. The old nonfunctional gender selector was removed; fit and occasion controls now use saved product fields. Optional attributes left blank will not match a specific fit/occasion filter.

## Admin workflow

**Admin → Categories → Men’s navigation catalog** manages this tree. Expand a department to add/edit/reorder its subcategories; expand a subcategory to manage its specific product types. Edit a main department to configure its menu promotion image/headline. Position is an integer display order. The four root department names cannot be changed or deleted, and no additional roots or fourth level can be created. Child names can be changed while their slugs and IDs stay stable. Products' legacy text columns are also updated during a rename. Deleting an assigned node or a node with children is rejected.

Homepage category image cards remain a separate feature below this manager. Their images/visibility are independent of the navbar tree.

**Admin → Products → Add/Edit Product**, and **Purchases → Quick-add Product**, use the same `ProductCategoryFields` component:

1. Choose a required parent category.
2. Choose a required child subcategory loaded from the catalog API.
3. Optionally choose a specific product type under that subcategory.
4. Choose fit: Slim Fit, Regular Fit, Relaxed Fit, or unspecified/not applicable.
5. Choose occasion: Casual, Formal, Party Wear, Festive/Eid Special, or unspecified.

Changing parent clears subcategory/type; changing subcategory clears type. Server validation independently rejects invalid parent/child/type combinations and unsupported attributes. Blank optional attributes are useful for accessories where clothing fit does not apply.

## Database and migration

`catalog_nodes` has integer `id`, self-referencing nullable `parent_id`, `name`, stable `slug`, `position`, optional `image` and `promo_title`. A sibling slug is unique. Root → subcategory → type is the supported hierarchy.

Products gain `catalog_category_id`, `catalog_subcategory_id`, `catalog_type_id` (foreign keys with restricted deletion), `product_type`, `fit`, and `occasion`. Existing `category_name` and `subcategory` text fields remain for compatibility. The product API joins current labels and returns `category_slug`, `subcategory_slug`, `product_type_slug` alongside numeric assignments. Creation/update resolve the submitted names or slugs against the real database tree before saving IDs.

`ensureCatalogSchema` runs during backend startup after the existing product-subcategory migration. `app_migrations` records `mens-catalog-v1`; the seed and legacy assignment pass execute once in a transaction. Deleted catalog nodes are not re-seeded on restart. Recognized old categories (Topwear, Bottomwear, Footwear, Grooming & Tech, etc.) are mapped into the new hierarchy. Unknown classifications remain available for manual reassignment in Products. All four existing local products were recognized and assigned during this run; no test products remain.

## API

| Method / path | Access | Behavior |
| --- | --- | --- |
| GET `/api/catalog` | Public | Ordered three-level tree, fit and occasion options |
| POST `/api/catalog` | Admin | Add a subcategory or product type using `parent_id` |
| PUT `/api/catalog/:id` | Admin | Edit name/order/promotion; keep slug and parent stable |
| DELETE `/api/catalog/:id` | Admin | Reject root, assigned or non-leaf removal |
| POST/PUT `/api/products[/:id]` | Admin | Persist validated department/subcategory/type and attributes |
| GET `/api/products` | Public | Supports `category`, `subcategory`, `type`, `fit`, `occasion`, `search` |

`useMensCatalog` loads the API on navigation and window focus, supports retry and ignores aborted loads. The frontend does not silently substitute a static tree after an API error. Live menus update after a refresh/focus/navigation; there is no websocket subscription. Backend initialization must finish before the catalog API can respond.

## Verification

- Production TypeScript/Vite build passed. Existing large-bundle advisory remains.
- `node --test --test-isolation=none my-app/tests/catalog.test.js`: shared mapping and legacy links passed.
- From `server`, set `RUN_DB_TESTS=1` and run `node --test --test-isolation=none tests/catalog.integration.test.js`: real SQL seeding/idempotence, authorization, dependent assignments, attribute round-trip, filtered API reads, stable renames, protected deletion and dynamic node management passed. Fixture writes roll back; additive schema/initial category migration persist.
- `node scripts/check-navigation.mjs`: Chrome checks on local Vite port 5175 passed for four mega-menus, exact slug routing, 1024/768/390/320 widths, mobile accordions/Escape/focus return, dependent form selectors and combined fit/occasion/type filtering. Admin authentication and sample products in browser tests are browser-only fixtures; API authorization and persistence use the separate real SQL suite.
- Screenshots: `artifacts/navigation/desktop-mega.png`, `mobile-drawer.png`, `admin-categories.png`.

The local backend was restarted successfully with this schema and route set. Production deployment must include `shared/` alongside `server/`, and route storefront `/api` requests to Express. The frontend build includes the shared module; the development Vite server allows workspace shared-file imports.
