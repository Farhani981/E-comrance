# Development and verification

## Local setup

Two independent npm packages exist: [frontend](../my-app/package.json) and [backend](../server/package.json). Lockfiles are present. Node observed during this review: `v24.18.0`. Neither package declares a Node engines policy. Use an installed runtime compatible with the locked dependencies.

From a terminal at the project root:

```powershell
Set-Location server
npm ci
```

Configure a local `server/.env` with your own values. The following is an illustrative template, not existing credentials:

```dotenv
PORT=5000
DB_HOST=localhost
DB_USER=your_local_database_user
DB_PASSWORD=your_local_database_password
DB_NAME=ecommerce_db
# Required: set a private cryptographically random value before starting.
JWT_SECRET=
STRIPE_SECRET_KEY=your_stripe_test_secret_key
FRONTEND_URL=http://localhost:5173
# Optional order notifications:
# EMAIL_USER=your_sender_account
# EMAIL_PASS=your_smtp_credential
```

Start your MySQL-compatible database, then run `npm run dev` in `server`. Startup runs schema creation, seed inserts, and ALTER/UPDATE statements. Use a disposable development database first and review [schema caveats](DATABASE_SCHEMA.md). Stripe is constructed during route import, so a missing secret can prevent startup even for COD use. There is no automatic admin seed in SQL; the current public admin-registration behavior is a defect, not a recommended provisioning procedure.

In a second terminal at the project root:

```powershell
Set-Location my-app
npm ci
npm run dev
```

Open the Vite URL printed by that command. The app assumes the API is on localhost port 5000. There is no Vite proxy, configurable API client, or root start-all command. Changing backend PORT alone does not update the browser requests. On Windows, `npm.cmd` can be used when PowerShell script policy blocks `npm.ps1`.

## Available commands

| Directory | Command | Purpose |
| --- | --- | --- |
| my-app | `npm run dev` | Vite development server |
| my-app | `npm run build` | TypeScript project checks, then Vite build |
| my-app | `npm run lint` | Oxlint rules configured in .oxlintrc.json |
| my-app | `npm run preview` | Preview an already successful frontend build |
| server | `npm run dev` | Nodemon backend |
| server | `npm start` | Node backend |

Neither package provides a `test` script. [test_api.bat](../my-app/test_api.bat) performs public product reads, an unauthorized product write attempt, admin registration, and login. It has no assertions and mutates data. It was not run in this review.

## Verification performed on 2026-09-09

| Check | Result |
| --- | --- |
| `npm.cmd run build` in my-app | Passed outside the sandbox; TypeScript and Vite production build completed (79 modules) |
| `npm.cmd run lint` in my-app | Exit 0 with warnings, including unused values and React hook/effect issues |
| `node --check` on all first-party server .js files | Passed syntax checks |
| Markdown references, route coverage, schema coverage | Checked after documentation generation |
| Live SQL / SMTP / Stripe / browser interactions | Not exercised |

The earlier dashboard unused-declaration errors and customer-details response-type error were corrected while repairing admin order loading. The successful build emits one non-fatal warning that the main JavaScript chunk exceeds 500 kB after minification.

An existing `dist` directory or `build.log` is not evidence that the current source builds. `allowJs` enables JSX imports, but `checkJs` is not enabled, so the TypeScript build does not comprehensively type-check JSX business logic.

## Manual regression checklist for future fixes

Use test payment credentials, a disposable database, and an email recipient you control. These are future checks, not claimed results.

| Area | Cases to exercise |
| --- | --- |
| Auth | Valid/invalid login, duplicate email, user-vs-admin permissions, token expiry, offline behavior, actual logout |
| Catalog | Empty API data, offline fallback, create/edit/delete and reload, zero stock, SKU persistence, category aliases |
| Categories | Partial visibility update, image upload, name/link edits, delete/restart behavior |
| Cart | Same/different variants, quantity zero, stock limits, user switch, price and shipping consistency |
| Orders | Guest and authenticated COD, invalid items, insufficient stock, repeated submission, successful commit followed by email failure |
| Card | Test success/failure, currency and total validation, payment succeeds but order save fails, duplicate callback |
| Tracking | Owned order link, wrong user, guest order, unauthenticated visitor, each allowed status |
| Admin | Customers and credits, suppliers, purchase invoice totals and stock, invalid/duplicate invoice, rollback |
| Presentation | Narrow/mobile navigation, modals, empty/error/loading states, broken images, keyboard access |

## Troubleshooting

| Symptom | First source/code check |
| --- | --- |
| Admin orders are empty although SQL has rows | Sign in again if redirected; the admin layout now verifies auth/me and the order page shows the actual API error |
| Screens show sample data while backend is down | ProductContext/AuthContext fallbacks |
| Saving appears successful but reload loses it | Silent HTTP failures in context mutation helpers |
| Purchases product dropdown is empty | Wrong `/api/admin/products` URL |
| API root responds but queries fail | Startup DB log, schema execution, DB_NAME mismatch |
| stock_quantity unknown column | Earlier startup ALTER failed or only schema.sql was applied |
| Email warning despite SMTP acceptance | Missing boolean return in sendOrderStatusEmail |
| Customer details says restart server | Inspect actual response status/content; message is generic for non-JSON responses |
| Banner subtitle/button not shown | Hero field names differ from editor payload |
| Order missing from account tracking | `/my-orders` requires authenticated user_id ownership |

## Deployment work still needed

Resolve the recorded auth/payment/build issues, establish tested migrations and dependency readiness, configure API origins, and supply production secret management. [public/.htaccess](../my-app/public/.htaccess) already supplies an Apache mod_rewrite fallback to `/index.html` for paths that are not existing files/directories, with `RewriteBase /`. It assumes deployment at the web root and requires the host to honor rewrite rules. Other hosts need equivalent SPA fallback configuration. The backend does not serve the frontend build. No deployment manifest, Docker configuration, or CI workflow was found. Keep `server/.env` and dependency/generated directories out of future commits; the current frontend-only .gitignore does not protect the sibling server's secrets.

See [Local startup](LOCAL_STARTUP.md) for the combined frontend/backend launcher and API proxy setup.
