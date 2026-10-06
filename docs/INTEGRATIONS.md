# Integrations and configuration

> Hero/banner implementation updated: [Hero and campaign management](HERO_CAMPAIGNS.md) supersedes the older banner storage, field mapping, API and carousel notes below.

The following is based on local code, not live provider verification. Environment values are placeholders; never put private server keys into browser code or these documents.

## Environment variables read by the backend

| Variable | Consumer / behavior |
| --- | --- |
| `PORT` | `server.js`, default 5000 |
| `DB_HOST` | `config/db.js`, default localhost |
| `DB_USER` | Database creation and pool, default root |
| `DB_PASSWORD` | Database password, default empty string |
| `DB_NAME` | Connection configuration, default ecommerce_db; SQL itself hardcodes ecommerce_db |
| `JWT_SECRET` | Required private signing key; shared config/jwt.js validates it for startup, signing and verification; no fallback |
| `STRIPE_SECRET_KEY` | Stripe construction in mounted order router and unused payment router |
| `EMAIL_USER` | Gmail SMTP account, From and Reply-To |
| `EMAIL_PASS` | SMTP credential; whitespace removed before use |
| `FRONTEND_URL` | Email tracking link origin, default http://localhost:5173 |

`dotenv.config()` reads configuration in server modules. Start commands from `server` so its local `.env` is resolved. There is no frontend `import.meta.env` configuration in the current source; API URLs and the Stripe publishable placeholder are hardcoded. Setting a hypothetical `VITE_API_URL` alone will have no effect.

## Database

[mysql2 configuration](../server/config/db.js) creates the database and executes [schema.sql](../server/schema.sql) at startup with multiple statements enabled. The same credentials must support those DDL operations. Queries mostly bind values with placeholders; category update columns come from a fixed allowlist. There is no configured database port override or TLS configuration in the source. See [schema details](DATABASE_SCHEMA.md) for startup incompatibilities and migration guidance.

## Authentication

JWT configuration update: copy [server/.env.example](../server/.env.example) to a private `server/.env`, or inject `JWT_SECRET` through the deployment environment. Supply a unique cryptographically random key (at least 32 random bytes recommended). The example intentionally leaves it empty. Startup rejects missing, empty or whitespace-only values in **every environment**, before listening or database initialization. The original configured value is used unchanged for signing and verification; it is never logged.

Keep the same key across backend instances. Never put it in `my-app`, a `VITE_*` variable, source control or client responses. Environment files are ignored; example files contain no real keys. Ignore rules do not untrack files already committed: if a secret was previously committed or the old predictable fallback was used, rotate the deployment key and treat old tokens as compromised. Rotation invalidates existing sessions; this change does not rotate the local key automatically. JWT expiry remains 30 days.

Run `npm run test:auth` from `server` for signing/verification, rejected invalid/expired tokens and production startup failure checks. Optional database integration tests now require a configured key and have no fallback.

[Auth routes](../server/routes/authRoutes.js) hash passwords with bcrypt salt rounds 10 and sign JWTs containing `id` with a 30-day expiry. [Middleware](../server/middleware/authMiddleware.js) verifies the bearer token, loads the current database user, and checks `role === 'admin'` for admin handlers. `/api/auth/me` exists but the frontend does not call it to revalidate restored sessions.

The public registration handler accepts an admin role, admin login contains a password bypass, and frontend network fallbacks can invent an admin session. A demo token cannot authenticate with the real backend. See [known issues](KNOWN_ISSUES.md) for these distinct trust-boundary problems.

## Stripe

Mounted endpoint: `POST /api/orders/create-payment-intent`, in [orderRoutes.js](../server/routes/orderRoutes.js). It rounds amount times 100 and sets `currency: 'usd'`, `payment_method_types: ['card']`. Frontend: [Checkout](../my-app/src/pages/Checkout.jsx) loads the literal `YOUR_STRIPE_PUBLIC_KEY_HERE`, then [StripeCheckoutForm](../my-app/src/pages/StripeCheckoutForm.jsx) uses Elements and `confirmCardPayment`.

[paymentRoutes.js](../server/routes/paymentRoutes.js) is a duplicate implementation using PKR and unrounded multiplication. It is not imported or mounted by the server; there is no working `/api/payments` route in this project. The 1LINK badge is display content, not a separate integration. Stripe's server package is declared in both packages but frontend implementation uses the browser and React Stripe packages.

## Email

[sendEmail.js](../server/utils/sendEmail.js) uses `smtp.gmail.com:465`, secure transport, and currently disables certificate rejection with `tls.rejectUnauthorized: false`. Transport is disabled if email credentials are absent. Startup verifies the transport; order creation/status changes call `sendOrderStatusEmail` after saving data. No queue or retry worker exists.

Messages include escaped customer/item text, shipping details, order status, and a tracking link. Tracking number arguments exist but callers pass an empty number. The helper does not return true after sending, so the API's `emailSent` value is not a reliable delivery indicator and may be omitted from JSON. SMTP acceptance also would not prove inbox delivery.

## Images, assets, and browser services

[ImageUploadInput](../my-app/src/component/ImageUploadInput.jsx) accepts local image files up to 5 MiB, reads a data URL, resizes the longest edge to at most 400 pixels, and encodes JPEG at quality 0.65. It can also accept a URL. This is browser conversion; there is no multipart upload endpoint, object storage bucket, or Cloudinary integration. Data URLs can reach SQL TEXT columns and browser storage.

Product/category/banner imagery references Unsplash and local assets. Brand logos also reference WorldVectorLogo, Wikimedia, Engine, and Brandfetch hosts. Some broken-image placeholders use via.placeholder.com. These are third-party image requests, not evidence of a commercial partnership. Footer Facebook/Instagram links are ordinary outbound links and are not controlled by Settings.

Customer detail invoice printing opens a browser window, writes HTML, and invokes print. It is not PDF generation or an email invoice service. Review submission, contact submission, notification toggles, EasyPaisa/JazzCash/bank-transfer settings, and brand filters have no corresponding service integration in the supplied code. Axios is declared, but application HTTP calls use fetch.
