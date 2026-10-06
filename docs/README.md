# Documentation index

- [Inventory management](INVENTORY.md): stock sources, purchasing costs, delivered sales, warehouses, adjustments and report verification.

This is a source-based baseline, dated **2026-09-09**. It covers the first-party application source, configuration, SQL, dependency manifests, assets inventory, and existing API helper. Dependency internals and generated `dist` contents are not treated as application source. The private `server/.env` values were not copied or inspected. No live database, Stripe account, SMTP delivery, or browser journey was verified.

## Reading order

1. [Architecture](ARCHITECTURE.md): runtime structure, feature status, and ownership.
2. [Code map](CODE_MAP.md): file-by-file responsibilities and source navigation.
3. [Routes and API](ROUTES_AND_API.md): all declared UI paths and mounted HTTP endpoints.
4. [Database schema](DATABASE_SCHEMA.md): exact DDL, relationships, defaults, and drift.
5. [Data flows](DATA_FLOWS.md): state changes and transaction boundaries.
6. [Integrations](INTEGRATIONS.md): configuration, external calls, and disconnected features.
7. [Wireframes](WIREFRAMES.md): source-derived page structures and responsive behavior.
8. [Category maintenance](CATEGORY_MAINTENANCE.md): detailed guide to the active IDE file.
9. [Known issues](KNOWN_ISSUES.md): observed defects and suggested next work.
10. [Development and testing](DEVELOPMENT.md): setup, verification results, and manual checks.
11. [Changelog](../CHANGELOG.md): documented changes without invented release history.

## Maintenance rules

Keep routes synchronized with `App.tsx`, `server.js`, and each router. Update the schema guide whenever SQL or startup DDL changes. Update feature status when a local/demo feature gains a backend. Record completed changes separately from planned fixes. A source observation is not a live integration test; preserve that distinction in future edits.

Mermaid diagrams render in compatible Markdown viewers; fenced text wireframes work in any viewer. Source links are relative so the guides remain usable when the project directory moves.

- [Catalog navigation update](CATALOG_NAVIGATION.md): navbar, product categories, persistence and regression checks.

- [Hero and campaign management](HERO_CAMPAIGNS.md): responsive design, dashboard publishing, banner API and schema.

- [Men?s mega-navigation and catalog](MENS_CATALOG.md): database hierarchy, product assignment, attributes, navigation and tests.
