# Task 08 — backend customer profile persistence

## Previous behavior and supported fields

Account displayed editable name, email, phone, address and city, but AuthContext.updateUser only merged these values into browser state/localStorage. The users table had name and email but no contact/address columns. GET /api/auth/me returned only the basic authorization user, and login omitted contact fields.

The additive migration adds storage for fields already present in the account/checkout UI: phone VARCHAR(50), address TEXT, and city VARCHAR(100). It runs through existing startup/API schema readiness. The local migration check preserved the existing user count and aggregate checksum of IDs, names, emails, password hashes and roles.

## API and validation

`PATCH /api/auth/me` requires the existing Bearer JWT authentication middleware. The SQL WHERE clause always uses req.user.id from verified authentication and database lookup. There is no target-customer ID parameter.

Only these fields are accepted, individually or together:

| Field | Validation |
| --- | --- |
| name | Required when submitted; trimmed text, maximum 255 characters |
| email | Required when submitted; valid basic email syntax, trimmed/lowercased, maximum 255 characters; existing unique constraint enforced |
| phone | Optional/clearable; maximum 50 characters, 7–15 digits with common phone punctuation |
| address | Optional/clearable; maximum 1000 characters; multiline text allowed |
| city | Optional/clearable; maximum 100 characters |

Invalid types, control characters, empty payloads, protected fields and unknown fields are rejected before writing. Omitted fields stay unchanged. Role, permissions, IDs, passwords/hashes, status and timestamps cannot be changed here. A duplicate email returns 409 without partially updating the record. Validation uses 400, unauthorized requests use 401, and storage failures return a generic 500 response without database diagnostics.

GET /api/auth/me queries current profile data from MySQL. GET/PATCH responses and login expose only safe user fields, never a password/hash. Existing password verification and authorization logic remain intact.

## Frontend behavior

- Account awaits the backend save before showing success or leaving edit mode.
- Saving blocks duplicate submissions; failures preserve the form and display an error.
- Edit mode starts from the latest returned user data, avoiding stale initial form values.
- AuthContext reloads the saved profile from /me when a session starts or the page reloads. It offers retry on loading failure and clears the session on 401.
- Browser state/localStorage are updated from the server response, rather than blindly merging submitted fields.
- Aborted refreshes or responses for a logged-out/replaced session cannot replace another session's user state.
- Email remains editable because it was already an account field. It is validated and unique, but this task does not add an email verification or password-change flow.

Previously browser-only contact information is not silently imported into MySQL; customers must explicitly save it. Backend data is authoritative after reload.

## Files changed

- server/routes/authRoutes.js
- server/utils/profile.js (new validation, safe field list and additive migration)
- server/config/db.js
- server/utils/variantSchema.js
- server/schema.sql
- server/package.json
- my-app/src/utils/profile.js (new API client)
- my-app/src/context/AuthContext.jsx
- my-app/src/pages/Account.jsx
- server/tests/profile.test.js (new)
- server/tests/profile.integration.test.js (new)
- server/tests/auth.test.js (SQL mock supports the expanded safe /me projection)
- This report and TASK08_TESTS.txt / TASK08_LINT.txt.

## Tests and results

`npm run test:profile`: **3 passed** covering validation, frontend protected save/reload requests and error propagation.

The profile database suite: **8 passed**, using temporary users tables. Covers actual persistence, fresh GET and login retrieval, another customer's isolation, protected fields, invalid input, duplicate email atomicity, unauthorized/forged tokens, optional-field clearing and safe database errors.

`npm run test:all:isolated`: **82 passed, 0 failed, 0 skipped**, including all previous suites. Disposable test database removed afterward. Full output: TASK08_TESTS.txt.

Frontend lint: exit 0 with existing warnings; the new loading-effect warning was removed. Production TypeScript/Vite build passed with the existing bundle-size warning. No browser automation was run; API client behavior, real SQL persistence and compilation were tested.

Deploy the updated backend and run its additive migration before serving profile updates. No existing customer data was deleted and unrelated account/order functionality was not changed.
