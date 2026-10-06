# Catalog navigation update (2026-09-09)

> Current men?s taxonomy and mega-navigation: [Men?s catalog](MENS_CATALOG.md) supersedes older static/six-department category notes below.

Navbar desktop/mobile menus use the fixed shared hierarchy: Topwear, Bottomwear, Eastern Wear, Footwear, Accessories and Grooming & Tech. These departments and their standard dropdown items remain visible even when empty. Existing custom subcategories within those departments are also included. Homepage category-card visibility does not hide navbar departments. Admin Products, API product mapping, and Shop share utils/catalog.js for hierarchy, legacy slug aliases, and matching. Custom product categories and subcategories appear automatically. Categories remain homepage cards; collections remain separate promotional records without product membership.

The Shop product-type drawer previously called toLowerCase on numeric database category IDs, causing a render crash when opened. It now uses product category names. Category/subcategory navigation clears old search, color, size and price restrictions. The default price filter has no ceiling; the slider adapts to catalog prices. Duplicate heading and breadcrumb content was removed.

Product API create/update now persists products.subcategory (VARCHAR(255), default empty). Restart the backend: config/db.js adds the column only when missing. Existing rows use legacy category/title normalization until their subcategory is explicitly saved in Admin Products. SKU and zero stock survive API loading. Product/category writes must succeed on the API before local state changes; errors reach admin forms.

ProductContext reloads catalog on pathname changes, so returning from purchases, inventory, returns or reviews retrieves current product data. This is navigation refresh, not live cross-tab synchronization. In-flight results from previous routes are ignored.

Validation: node --test --test-isolation=none my-app/tests/catalog.test.js checks every standard hierarchy link, legacy slugs, mismatched subcategories, custom values and ampersands. Backend source syntax checks pass. Live database migration and browser interaction have not been exercised.

## Explicit product placement

Manage Products and the purchase quick-create form share ProductCategoryFields. New products start with unselected department/subcategory fields; both selections are required. Changing department resets subcategory. Formal/casual shirts belong to Topwear; jeans/trousers to Bottomwear; Shalwar Kameez/Kurta to Eastern Wear. Existing products with nonstandard classification must be assigned a standard pair when edited. These fields are sent as category_name/subcategory and persist through the existing product API.

Desktop navigation has its own full-width row and dropdown toggles; mobile uses the same hierarchy. Check with node scripts/check-navigation.mjs and the catalog test suite.
