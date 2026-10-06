# Local startup and authentication connection

From my-app, run npm run dev (or npm --prefix my-app run dev from the repository root). This starts the Express backend on port 5000, waits for its HTTP response, then starts Vite. An existing ShopHub backend is reused. Ctrl+C stops processes owned by the launcher; a reused backend is left running. Node and both dependency installations are required. MySQL must be running separately.

The frontend uses relative /api URLs for authentication, admin and shopping requests. Vite development and preview proxy /api to http://127.0.0.1:5000. Restart an existing Vite process after this configuration change. This also lets browsers on other devices reach the backend through Vite rather than their own localhost.

npm run dev:frontend starts only Vite for cases where the backend is managed separately. Production hosting must route /api to the deployed Express server on the same origin; Vite's development proxy is not included in static build output. A deployed API must run as a managed service independently of the browser.

The reported authentication error was caused by an unreachable backend. Starting the backend successfully initialized MySQL and verified SMTP. No login credentials were changed and no authentication bypass was added. Startup probes HTTP availability, not database readiness; database connection failures remain visible in server output.
