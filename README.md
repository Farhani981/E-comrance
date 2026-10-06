# ShopHub

ShopHub is a full-stack men's fashion and lifestyle e-commerce project with a customer storefront, an administration dashboard, an Express API, and a MySQL database.

## Features

- **Storefront:** category navigation, product catalog and details, variants and attributes, featured products, collections, and campaign banners.
- **Customer accounts:** registration, login, profile management, cart, wishlist, order history, and contact messages.
- **Checkout:** server-side pricing, coupons, shipping, Stripe payments, cash on delivery, and payment recovery.
- **Administration:** products, categories, brands, navigation, banners, collections, customers, reviews, staff, and store settings.
- **Operations and finance:** suppliers, purchases, inventory, returns, orders, transactions, courier settlements, COD reconciliation, analytics, and reports.
- **Notifications:** real-time admin notifications through Socket.IO and optional email delivery through Nodemailer.

Some frontend state uses browser storage for caches or fallback data. A rendered page alone does not verify its API or database connection.

## Technology

| Layer | Tools |
| --- | --- |
| Frontend | React 19, TypeScript and JavaScript, Vite 8, Tailwind CSS 4, React Router 7 |
| Backend | Node.js, Express 4, MySQL2 |
| Authentication | JSON Web Tokens, bcryptjs |
| Integrations | Stripe, Socket.IO, Nodemailer |
| Checks | Node.js test runner, TypeScript compiler, Oxlint |

## Project structure

```text
my-app/                 React storefront and admin dashboard
  src/                  Pages, components, layouts, contexts, and API helpers
  tests/                Catalog tests
server/                 Express API
  config/               Database and JWT configuration
  routes/               HTTP endpoints
  services/             Pricing, notifications, and Socket.IO
  utils/                Business logic and schema initialization
  tests/                Unit and database integration tests
  schema.sql            Base database tables
  operations-schema.sql Operations tables
  .env.example          Backend configuration template
shared/                 Shared application modules
scripts/                Development launcher and feature checks
 docs/                  Architecture, feature, and maintenance guides
```

## Local setup

Use **Node.js 22.12 or newer** (Node.js 24 is suitable), npm, and a running MySQL-compatible database. The database must support the schema files and startup migrations, including `ADD COLUMN IF NOT EXISTS`.

Run these commands from the repository root:

```powershell
npm --prefix server ci
npm --prefix my-app ci
```

For a fresh setup, copy the backend environment template. Preserve an existing `server/.env`:

```powershell
Copy-Item server/.env.example server/.env
```

Edit `server/.env` with your database credentials and a private JWT signing key:

```dotenv
JWT_SECRET=replace-with-a-private-random-signing-key
NODE_ENV=development
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your-database-password
DB_NAME=ecommerce_db
FRONTEND_URL=http://localhost:5173
```

Generate a random signing key with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

The backend requires `JWT_SECRET` before startup. It creates the configured database and initializes tables and additional schemas, so the database user needs the corresponding create and alter permissions. Check startup output for database errors.

Start both applications:

```powershell
npm --prefix my-app run dev
```

The launcher starts the backend on port **5000**, waits for its HTTP response, and then starts Vite. It reuses an existing ShopHub backend on that port. MySQL runs separately. Ctrl+C stops processes started by the launcher.

| Service | Default URL |
| --- | --- |
| Storefront | http://localhost:5173 |
| Administration | http://localhost:5173/admin |
| API status | http://localhost:5000/ |

Use the URL printed by Vite if port 5173 is occupied.

To run the applications separately, use two terminals:

```powershell
# Terminal 1: backend
npm --prefix server run dev
```

```powershell
# Terminal 2: frontend
npm --prefix my-app run dev:frontend
```

The frontend sends relative `/api` requests. Vite proxies these to `http://127.0.0.1:5000`. The combined launcher fixes the backend port at 5000; using another backend port also requires updating the proxy configuration.

Public registration creates customer accounts. Admin access requires an account with the `admin` database role; public signup cannot grant that role.

## Optional integrations

Add these values to `server/.env` for card payments:

```dotenv
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-signing-secret
VITE_STRIPE_PUBLIC_KEY=your-stripe-publishable-key
```

Vite reads environment files from `server/`, as configured in `my-app/vite.config.ts`. Only the publishable key belongs in a `VITE_` variable. Restart development processes after changing environment values. Configure Stripe's `payment_intent.succeeded` webhook to reach `/api/orders/stripe-webhook` on the backend.

For email, configure `EMAIL_USER` and `EMAIL_PASS`. Optional `EMAIL_HOST`, `EMAIL_PORT`, and `EMAIL_SECURE` settings customize the SMTP connection; defaults use Gmail SMTP on port 465. Set `FRONTEND_URL` to the customer-facing origin for email links.

## Build and checks

Run from the repository root:

```powershell
# TypeScript check and production frontend build
npm --prefix my-app run build

# Frontend lint
npm --prefix my-app run lint

# Backend tests (database suites are opt-in)
npm --prefix server test

# Frontend catalog tests
node --test my-app/tests/catalog.test.js
```

For database integration coverage:

```powershell
npm --prefix server run test:all:isolated
```

The isolated runner uses configured database credentials to create a disposable `shophub_test_*` database, runs the backend suites and frontend catalog tests with database coverage enabled, and removes that database afterward. It requires a running database and create/drop permissions.

Focused backend scripts include `test:auth`, `test:images`, `test:pricing`, `test:profile`, `test:settings`, `test:contact`, and `test:cod`.

Preview the frontend build with `npm --prefix my-app run preview`; the backend must run separately. Build output is written to `my-app/dist`. Production hosting must serve the frontend and route `/api` to an independently running Express service. Vite's proxy configuration is not included in static build output.

## Documentation

| Topic | Guide |
| --- | --- |
| Documentation index | [docs/README.md](docs/README.md) |
| Architecture and source navigation | [Architecture](docs/ARCHITECTURE.md), [Code map](docs/CODE_MAP.md) |
| Routes, database, and data flows | [Routes and API](docs/ROUTES_AND_API.md), [Database schema](docs/DATABASE_SCHEMA.md), [Data flows](docs/DATA_FLOWS.md) |
| Development and integrations | [Local startup](docs/LOCAL_STARTUP.md), [Development](docs/DEVELOPMENT.md), [Integrations](docs/INTEGRATIONS.md) |
| Catalog and campaigns | [Catalog navigation](docs/CATALOG_NAVIGATION.md), [Men's catalog](docs/MENS_CATALOG.md), [Hero campaigns](docs/HERO_CAMPAIGNS.md) |
| Inventory and operations | [Inventory](docs/INVENTORY.md), [Core operations](docs/CORE_OPERATIONS.md) |
| Pricing and images | [Checkout pricing](docs/CHECKOUT_PRICING.md), [Image storage](docs/IMAGE_STORAGE.md) |
| Review history | [Known issues](docs/KNOWN_ISSUES.md), [Production audit](docs/TASK13_PRODUCTION_AUDIT.md), [Changelog](CHANGELOG.md) |

This README reflects source inspected on **2026-10-06**. Individual guides and audit reports describe their own dated snapshots; check current source when using older findings. This documentation update does not establish live payment, email, database, or deployment readiness.
