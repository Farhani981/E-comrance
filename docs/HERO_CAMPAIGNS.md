# Hero and campaign management

Updated 2026-09-09. This guide supersedes older notes describing browser-only banners and the previous five-second carousel.

## Storefront

`App.tsx` retains its `Home -> Hero -> Categories -> FeaturedProducts` composition. `Hero.jsx` uses Tailwind utilities exclusively: full-width background photography, slate gradient overlays, white headings, orange highlights and CTAs, and an optional outlined secondary CTA. Height is 500px on mobile and 650px from the medium breakpoint. Icons are inline SVG; no external hero stylesheet or font service is required. Wrap headline words in `**double asterisks**` to highlight them in orange; otherwise the final word is highlighted. The admin preview renders the same component. Landscape 1920×1080 imagery is recommended.

The carousel rotates every 6.5 seconds with a smooth opacity crossfade. Hover and a hidden browser tab suspend rotation. Keyboard focus or manual navigation pauses it until Play is explicitly selected. Reduced-motion preference disables autoplay and transitions. Previous/next, direct slide selection and pause controls have accessible labels and visible focus. Inactive slides are inert and hidden from assistive technology. The active image loads eagerly with high fetch priority; other images are lazy-loaded. Broken images render a slate branded placeholder without removing the campaign message.

`HeroCarousel` is also exported for reuse. `src/component/heroSlides.js` exports an optional Unsplash sample array for `<HeroCarousel slides={sampleHeroSlides} />`. The storefront continues to use the admin's database content, without automatically publishing samples.

A successful empty banner response hides the carousel; disabled/deleted campaigns never resurrect demo slides. A loading placeholder reserves space during initial fetch. An unavailable API shows a catalog link and retry instead of an invented promotion. `Hero` accepts `showFeatures={false}` to omit the optional service bar. Category navigation uses the real `/#categories` anchor. The old duplicate service bar was removed from Categories.

## Admin workflow

Open `/admin/banners`. Hero carousel and Promotional cards share an editor and API. Add a slide/card, choose an image, fill the headline, supporting text and optional badge, configure CTA labels/destinations, choose an image focus, and inspect the shared live preview. New campaigns begin as drafts. Save draft keeps them private; checking the live checkbox and saving publishes them. Blank button labels hide individual CTAs. Arrows persist display order; visibility and deletion persist immediately after successful API confirmation. Only the first two active promotional cards display below the hero.

Destination fields accept storefront paths (for example `/shop?category=Footwear` or `/#categories`). Promotional badge text is display content; actual percentage discounts and coupon eligibility belong to Promotions. The editor explains this distinction. The image description supplies alternative text; leave blank for purely decorative campaign photography.

File inputs accept up to 5 MB and resize hero images to a maximum 1920-pixel edge at JPEG quality 0.82, with an output limit of 2 MB. Other existing upload consumers retain their 400px defaults. Use optimized hosted image URLs for smaller API payloads and browser/CDN caching. Invalid images/links and overlong content are rejected by the server.

## Data and API contract

The existing `banners` SQL table is authoritative. `useBannerCatalog` supplies banner state/mutations through the existing ProductContext. It loads public banners on storefront routes, all banners on admin routes, and refreshes on pathname changes and window focus. This is refresh-based synchronization, not a websocket feed. A save only updates context after API confirmation; stale fetch responses are ignored.

| Field | Storage / use |
| --- | --- |
| `id` | Existing integer primary key |
| `title` | Existing VARCHAR(255), required public headline |
| `description` | Existing TEXT, validated at 1500 characters |
| `buttonText` | Existing VARCHAR(100), primary CTA label |
| `image` | Upgraded from TEXT to MEDIUMTEXT; image URL or validated raster data URL |
| `isActive` | Existing boolean; API returns a JavaScript boolean |
| `position` | Existing integer, ascending display order then ID |
| `badge` | New VARCHAR(80), optional promotion text |
| `link` | New VARCHAR(500), default `/shop` |
| `secondaryButtonText` | New VARCHAR(100), default `Explore categories` |
| `secondaryLink` | New VARCHAR(500), default `/#categories` |
| `imageAlt` | New VARCHAR(255), default empty |
| `imagePosition` | New VARCHAR(20), center/left/right/top/bottom |
| `kind` | New VARCHAR(10), `hero` or `promo`; existing rows default to hero |

| Endpoint | Access / behavior |
| --- | --- |
| GET `/api/banners` | Public; active rows only, ordered |
| GET `/api/banners/admin` | Admin; all rows including drafts |
| POST `/api/banners` | Admin; validated creation, returns saved row |
| PUT `/api/banners/:id` | Admin; partial updates, returns saved row |
| DELETE `/api/banners/:id` | Admin; persisted deletion |
| PUT `/api/banners/reorder` | Admin; `{kind, ids}`; validates complete membership and updates order transactionally |

`ensureBannerSchema` runs after the base schema during backend initialization. Existing SQL campaigns and image/text values remain intact; new fields receive defaults. The migration was applied successfully to the local database. Repeated startup no longer re-inserts deleted sample campaigns. Fresh databases start with no published campaigns. Old `shophub_banners` / `shophub_twocolumn_banners` browser caches are no longer used or overwritten; browser-only historical content can be copied into new dashboard drafts if needed.

## Validation

- `node --test --test-isolation=none server/tests/banners.test.js`: field validation, partial updates and unsafe input rejection.
- From `server`, set `RUN_DB_TESTS=1` and run `node --test --test-isolation=none tests/banners.integration.test.js`: real database CRUD, field round-trip, public draft exclusion, authorization, visibility, order and deletion. Fixtures roll back; additive schema changes persist.
- `npm --prefix my-app run build`: TypeScript and Vite production build.
- `node scripts/check-hero.mjs`: Windows Chrome browser checks using the local Vite server on 5175. Screenshots go to `artifacts/hero`. Covers 1440/768/390/320 viewport widths, controls, reduced motion, single/empty states, image fallback and shared admin preview. Admin UI checks use an isolated browser-only auth fixture; real API authorization is verified in the database suite.

Production hosting must route `/api` to Express, as described in LOCAL_STARTUP.md. Third-party image availability and the wider site's existing production issues remain separate from this hero implementation.
