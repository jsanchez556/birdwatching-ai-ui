# Deployment

The admin coordinate picker uses the Google Maps JavaScript API, sharing the same
`VITE_GOOGLE_MAPS_BROWSER_API_KEY` browser key and loader (`src/config/googleMaps.js`)
as the transportation surface; see [transportation.md](transportation.md#google-maps-setup)
for key setup. Forward and reverse geocoding remain backend-proxied and require the API's
`GEOCODING_PROVIDER_URL` and deployment-specific `GEOCODING_USER_AGENT`
configuration.

Back to [Project Context](../CONTEXT.md).

## Runtime
Build command:
```bash
npm run build
```

Start command:
```bash
npm run start
```

The production `start` script runs:
```bash
node server.js
```

The Node server binds `0.0.0.0` to `PORT`, serves `dist/`, falls back to
`index.html` only for HTML navigation requests, and returns `404` for missing
asset paths. Hashed Vite assets receive one-year immutable caching; HTML
receives `no-cache`. Compressible responses larger than 1 KiB negotiate Brotli
or gzip. Request logs include only a low-cardinality route category, never
query strings or arbitrary navigation paths.

`GET /health` and `/health/live` are liveness probes. `/health/ready` returns
`503` after shutdown begins. SIGTERM/SIGINT handling is idempotent and bounded:
the server stops accepting traffic, drains active requests, destroys stalled
sockets after the grace period, and enforces a hard deadline.

`npm run preview` remains for local build inspection; it is not the production
runtime.

## Environment Variables
Required for production API integration:
- `VITE_API_URL`: public origin of the Birdwatching AI API, without a required trailing slash
- `VITE_CLOUDFRONT_BASE_URL`: optional public CloudFront/CDN origin for relative media keys, without a required trailing slash

Useful for local development:
- `VITE_API_PROXY_TARGET`: backend origin used by the Vite dev proxy, commonly `http://localhost:3001`
- `VITE_GOOGLE_MAPS_BROWSER_API_KEY`: public browser-restricted key for Maps JavaScript, Places, and Geometry; required by both the transportation map and the admin coordinate picker
- `VITE_TRANSPORT_COUNTRY_CODE`: ISO alpha-2 service country; defaults to `CR`

Useful for Railway preview host validation:
- `ALLOWED_HOSTS`: comma-separated extra hosts for Vite preview

Optional production server shutdown:
- `STATIC_SERVER_GRACE_MS`, defaults to `10000`
- `STATIC_SERVER_HARD_TIMEOUT_MS`, defaults to `15000` and must exceed the grace period

Optional product analytics:
- `VITE_POSTHOG_ENABLED`: set to `true` to allow consent-gated PostHog initialization
- `VITE_POSTHOG_KEY`: public PostHog project key
- `VITE_POSTHOG_HOST`: PostHog ingest host; defaults to `https://us.i.posthog.com`

Optional public company details used by the homepage footer:
- `VITE_COMPANY_NAME`: displayed company name; defaults to `RCN`
- `VITE_COMPANY_LOCATION`: displayed service location; defaults to `Costa Rica`
- `VITE_CONTACT_PHONE`: public telephone number
- `VITE_WHATSAPP_NUMBER`: international WhatsApp number; formatting is removed before building the `wa.me` URL
- `VITE_CONTACT_EMAIL`: public contact email address
- `VITE_BUSINESS_HOURS`: public service-hours text

Optional public social and review links:
- `VITE_FACEBOOK_URL`
- `VITE_INSTAGRAM_URL`
- `VITE_TRIPADVISOR_URL`
- `VITE_GOOGLE_REVIEWS_URL`
- `VITE_YOUTUBE_URL`

Social/review values must be complete HTTP or HTTPS URLs. Invalid or missing
optional contact and social values are omitted from the header, footer, and
floating actions rather than rendering incomplete links. See `.env.example`
for the complete safe configuration template.

Do not commit `.env` files. Frontend variables are public once built, so never place secrets in `VITE_` variables.

## Local Development Proxy
When `VITE_API_URL` is empty, the adapters under `src/api/` send relative requests:
```text
/auth/signup
/auth/login
/auth/refresh
/auth/logout
/auth/profile
/auth/profile-image
/billing/checkout
/billing/portal
/billing/usage
/cart
/cart/items
/cart/reservations
/chat
/voice-chat
/chat/:conversationId
/chat/latest
/homepage/hero
/tours
/birds/identify
/birds/highlights
/birds/profile
/jobs/:id
/addons/transfers
/files/:folderName/:filename
```

`vite.config.js` proxies `/auth`, `/billing`, `/cart`, `/chat`, `/voice-chat`, `/transport`, `/homepage`, `/tours`, `/birds`, `/jobs`, and `/files` to `VITE_API_URL`, then `VITE_API_PROXY_TARGET`, then `http://localhost:3001`. This avoids local CORS issues and lets the backend keep production CORS rules strict. `/files` is used to exchange relative RAG bird media keys and voice response audio paths for backend-issued media URLs when `VITE_CLOUDFRONT_BASE_URL` is empty; the frontend still does not store bucket credentials.

## Railway
`railway.json` uses Nixpacks and runs from the repository root:
```bash
npm run build
npm run start
```

Set `VITE_API_URL` in Railway before deploying a production frontend. The backend must allow the Railway frontend origin in its `CORS_ORIGINS` configuration.

Set `VITE_CLOUDFRONT_BASE_URL` when the frontend should construct public CDN media URLs directly. Leave it unset to keep the backend `/files` compatibility endpoint in the resolution path.

Backend deployment expectations:
- backend `OPENAI_API_KEY`, `DATABASE_URL`, and `JWT_SECRET` must be configured in the backend service, not the frontend service
- backend database migrations must be applied before chat memory, tour tools, or reservations are reliable
- backend `CORS_ORIGINS` should include the Railway frontend domain or custom frontend domain
- backend billing provider variables, webhook secrets, storage credentials, Redis, and worker configuration belong only in the backend service

## Static Server
`server.js` is the intended production server. Railway's existing
`npm run build` and `npm run start` commands remain compatible without another
runtime dependency or container layer.

## Routing
The current app has no React Router routes. The production server applies SPA
fallback only to extensionless requests that accept HTML, preventing missing
JavaScript or CSS assets from silently returning the application shell.

## Pre-Deploy Checks
```bash
npm test
npm run build
```

Smoke-test the built server:
```bash
PORT=4173 npm run start
curl --fail http://127.0.0.1:4173/health/ready
curl --fail -H 'Accept: text/html' http://127.0.0.1:4173/account
curl --fail --compressed http://127.0.0.1:4173/assets/<built-js-file>
```

Also verify:
- `VITE_API_URL` points to the intended backend
- the backend allows the frontend origin through `CORS_ORIGINS`
- the backend has run chat and tour reservation migrations before reservation testing
- the backend API and worker services are deployed when testing bird identification job polling
- `ALLOWED_HOSTS` includes any custom preview host if needed
- no frontend build output contains backend secrets
