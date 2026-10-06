# Task 10 — real contact submission and admin inbox

## Implementation

The old Contact form immediately displayed success and cleared its fields without a network request. No messages table or admin inbox existed.

The flow is now Contact form → POST /api/contact → validated SQL insert → Admin Contact Messages. The additive startup/API-readiness migration creates `contact_messages` with id, name, email, subject, message, status, created_at and updated_at. Initial status is Unread. The local table was verified after migration; no customer messages or unrelated data were deleted.

The form awaits HTTP 201 with success=true before clearing fields and showing receipt confirmation. Failed submissions retain entered text. A synchronous in-flight guard plus disabled controls prevents repeated clicks while submitting. This confirms database storage, not email delivery; no contact email sending or simulated delivery was added.

## Endpoints and access

| Method/path | Access | Behavior |
| --- | --- | --- |
| POST /api/contact | Public | Validate and store message |
| GET /api/contact?page=1 | Admin only | List messages, 25 per page, newest first |
| GET /api/contact/:id | Admin only | Read full message details |
| PATCH /api/contact/:id | Admin only | Set status to Read or Unread |
| DELETE /api/contact/:id | Admin only | Delete a selected message |

Admin authorization uses the existing verified JWT and current database role. A customer's token cannot gain inbox access by adding an admin claim. Message bodies are rendered as React text, not executable HTML. List/detail responses use no-store caching. Public submission returns a generic receipt acknowledgment, not stored message details.

Admin navigation includes **Contact Messages** at `/admin/messages`, with pagination, refresh, details, read/unread controls, and confirmed deletion. Errors remain visible and actions are disabled while processing.

## Validation and basic abuse protection

- Required trimmed name: maximum 100 characters.
- Required valid email: maximum 255 characters, normalized lowercase.
- Required subject: maximum 200 characters.
- Required nonempty message: maximum 5000 characters; multiline text supported.
- Invalid types, unknown fields, client-supplied status/IDs and inappropriate control characters rejected.
- Contact JSON body limit: 40 KiB, mounted before the larger product-image parser. Invalid JSON returns 400, excessive bodies 413, unsupported body media types 415.
- Default rate limit: five submission attempts per IP per 15 minutes; 429 with Retry-After. Includes invalid submission attempts that reach validation. Forwarding headers are not blindly trusted.
- Limiter state expires and is capped at 10,000 entries. It is per process, resets on restart, and is not a distributed anti-spam service. Proxy deployments need an appropriate trusted-proxy policy; requests sharing an observed IP share the limit.
- Storage failures return a generic failure without exposing SQL or credentials.

## Files changed

- `server/utils/contactMessages.js` (new schema, validation and limiter)
- `server/routes/contactRoutes.js` (new public/admin APIs and body parser)
- `server/config/db.js`
- `server/utils/variantSchema.js`
- `server/server.js`
- `server/package.json`
- `server/tests/contact.test.js` (new)
- `server/tests/contact.integration.test.js` (new)
- `my-app/src/utils/contact.js` (new API client)
- `my-app/src/pages/Contact.jsx`
- `my-app/src/pages/admin/ContactMessages.tsx` (new)
- `my-app/src/layout/AdminLayout.tsx`
- `my-app/src/App.tsx`
- This report and `TASK10_TESTS.txt` / `TASK10_LINT.txt`.

## Verification

- Contact unit/API-client tests: **3 passed**, including field validation, rate-limit expiry/forwarding-header resistance and failure propagation.
- Contact database/API suite: **6 passed**, including valid storage, invalid email, empty/oversized messages, payload limit, safe database failure, customer/anonymous denial, admin viewing, persistent status changes and deletion. Uses connection-local temporary tables.
- Complete suite: `npm run test:all:isolated` → **98 passed, 0 failed, 0 skipped**. Disposable database removed afterward. Exact output: TASK10_TESTS.txt.
- Frontend lint: exit 0 with existing warnings, recorded in TASK10_LINT.txt.
- Production TypeScript/Vite build passed; existing bundle-size warning remains.

No browser automation or email delivery test was performed. Message storage and admin operations were exercised through real Express routes and MySQL. The in-flight UI guard prevents repeated clicks, but there is no cross-request idempotency guarantee if a client retries after losing a successful response.
