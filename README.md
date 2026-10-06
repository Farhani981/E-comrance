# ShopHub project guide

ShopHub is a men's fashion and lifestyle storefront with an administration panel, an Express API, and a MySQL-compatible database. The frontend also uses browser-local demo data and caches, so a working screen does not always mean a database integration is complete.

This documentation describes the source inspected on **2026-09-09**. Start with [the documentation index](docs/README.md).

| Need | Guide |
| --- | --- |
| Understand the structure and data ownership | [Architecture](docs/ARCHITECTURE.md) |
| Find a source file | [Code map](docs/CODE_MAP.md) |
| Find every frontend and backend route | [Routes and API](docs/ROUTES_AND_API.md) |
| Understand tables, columns, relationships, and startup changes | [Database schema](docs/DATABASE_SCHEMA.md) |
| Follow shopping, payment, stock, and ledger flows | [Data flows](docs/DATA_FLOWS.md) |
| Configure database, authentication, Stripe, and email | [Integrations](docs/INTEGRATIONS.md) |
| Understand page layouts | [Wireframes](docs/WIREFRAMES.md) |
| Work on the active categories screen | [Category maintenance](docs/CATEGORY_MAINTENANCE.md) |
| Find bugs, placeholders, and disconnected behavior | [Known issues](docs/KNOWN_ISSUES.md) |
| Run and validate the project | [Development and testing](docs/DEVELOPMENT.md) |
| Track documented changes | [Changelog](CHANGELOG.md) |

The two applications have separate dependency installations and no root npm scripts. From `server`, use `npm ci` and `npm run dev`; from `my-app`, use `npm ci` and `npm run dev`. Configure the server first using the development guide. The frontend uses `/api` through the Vite proxy.

The production build passes as of 2026-09-09. Authentication and payment integrity still have significant source-confirmed issues; see the known-issues guide before treating the application as ready for real customer transactions.

See [Local startup](docs/LOCAL_STARTUP.md) for the combined frontend/backend launcher and API proxy setup.
