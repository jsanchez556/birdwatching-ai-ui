# Project Context

AI-agent entry point for the Birdwatching AI UI. Read this file first, then follow links for deeper details.

## What This Is
This repository is a single React/Vite frontend for Costa Rica nature-tour and birdwatching assistance. It supports:
- responsive chat UI with user and assistant message roles
- upfront customer context collection for booking-ready name, email, and itinerary dates
- styled reservation confirmation cards for confirmed booking responses
- progressive assistant streaming with typing/loading state and stop-generation support
- email/password authentication with local JWT session persistence
- authenticated display-name and profile-image updates from the account menu
- premium homepage entry point for tours, bird highlights, transportation add-ons, login, WhatsApp contact, and cookie consent
- multi-category discovery for birdwatching, day walks, night walks, parks, and other nature experiences
- grouped administration with responsive Tours/Zones/Nodes/Birds data grids, modal editors, integrated node/bird assignment dialogs, node-owned coordinates, and protected place search
- role-aware My Tours management for guide-owned or administrator-wide inventory and confirmed administrator role editing
- local chat state persistence with `localStorage`
- cached conversation messages and customer context for fast reloads
- authenticated latest-conversation hydration through `GET /chat/latest`
- backend hydration through `GET /chat/:conversationId`
- backend streaming chat requests through `POST /chat`
- browser voice chat through `POST /voice-chat`, with recorded audio converted to WAV before upload
- authenticated bird identification through `POST /birds/identify`, supporting pasted image URLs, photo uploads, async job polling through `GET /jobs/:id`, and the backend's conservative `identified | uncertain | unknown` response states
- authenticated billing checkout through `POST /billing/checkout`, billing management through `POST /billing/portal`, and optional usage display data through `GET /billing/usage`
- homepage content through `GET /homepage/hero`, `GET /tours`, `GET /birds/highlights`, and `GET /addons/transportation`
- bird profile media resolution through CloudFront or `GET /files/:folderName/:filename` when RAG metadata contains relative media paths
- backend-generated tour discovery, pricing, discounts, and reservation confirmations through assistant responses, including validated structured recommendation cards
- provider-agnostic billing upgrades and hosted billing management through authenticated backend billing endpoints, with Stripe currently used by the backend as the first provider adapter
- Railway-oriented static deployment with environment-driven API configuration

## Source Of Truth Map
- Human overview and setup: [README.md](./README.md)
- Agent rules and UI conventions: [AGENTS.md](./AGENTS.md)
- Architecture and render/data flow: [docs/architecture.md](./docs/architecture.md)
- Backend API integration: [docs/api.md](./docs/api.md)
- UI copy and prompt-adjacent guidance: [docs/prompting.md](./docs/prompting.md)
- Conversation state behavior: [docs/memory.md](./docs/memory.md)
- Canonical frontend chat contracts: [docs/chat-contracts.md](./docs/chat-contracts.md)
- Deployment and environment: [docs/deployment.md](./docs/deployment.md)
- Frontend privacy and local retention: [docs/privacy-retention.md](./docs/privacy-retention.md)
- Product analytics and event ownership: [docs/analytics.md](./docs/analytics.md)
- Product feature flags and rollouts: [docs/feature-flags.md](./docs/feature-flags.md)
- Frontend implementation rules: [docs/frontend-guidelines.md](./docs/frontend-guidelines.md)
- Stylesheet ownership and import order: [docs/styles.md](./docs/styles.md)
- Historical AI prompts: [docs/development_prompts/README.md](./docs/development_prompts/README.md)

## Current Architecture
The app is a multi-surface product shell using a surface-controller-hook-API split:
- `src/main.jsx` mounts React in strict mode.
- `src/App.jsx` selects and composes the active home, chat, or admin surface.
- `src/hooks/useProductShell.js` owns lightweight surface selection plus cross-surface auth, drawer/modal, billing-return, cart, reservation-entry, analytics, and feature-access coordination.
- `src/pages/HomeSurface.jsx`, `src/pages/ChatSurface.jsx`, and `src/pages/AdminDashboard.jsx` compose product surfaces without owning backend URL construction.
- `src/pages/HomePage.jsx` composes the premium homepage content.
- `src/components/*` owns presentational chat UI.
- `src/components/home/*` owns presentational homepage sections.
- `src/hooks/useAuth.js` owns auth state, token persistence, login, signup, logout, and profile updates.
- `src/hooks/useChat.js` owns conversation orchestration, message/metadata state, hydration, persistence, streaming requests, cancellation, and voice-result integration.
- `src/hooks/useStreamingText.js` owns progressive stream reveal buffering.
- `src/utils/chatConversationState.js` owns chat metadata normalization and guarded local persistence.
- `src/hooks/useAudioRecorder.js` owns browser microphone and `MediaRecorder` lifecycle.
- `src/utils/audioEncoding.js` owns framework-independent audio conversion and WAV encoding.
- `src/hooks/useVoiceChatUpload.js` owns the cancellable voice-upload lifecycle and delegates HTTP to `src/api/voiceChatApi.js`.
- `src/utils/reservationEntry.js` normalizes tours/cart items and constructs persistent, structured reservation chat entries.
- The admin Operations Dashboard uses four locally selected sections:
  AI Operations, Context engineering, Commercial administration, and Emergency
  controls.
  AI Operations is the default and presents compact Users, MRR, AI Cost, and
  Errors KPIs followed by AI Usage, AI Quality, Queues, and Recent Failures.
  `useAdminDashboard` loads only the active section, keeps independent
  session-only caches and request states, and never persists admin responses.
  The responsive section menu remains local state and does not add routing.
- AI Operations also renders aggregated model-routing health from the existing
  `/admin/overview` payload: execution/user-visible success, latency
  percentiles, token/cost availability, retry/fallback/schema/degradation
  rates, and bounded task/tier/selected-model/final-model breakdowns. It never
  receives prompts, responses, customer data, or raw error values.
- Admin AI Quality is labeled as portfolio regression quality and renders
  metrics only when the API identifies validated real-pipeline evidence.
  Synthetic scorer self-tests and legacy artifacts are explicitly excluded;
  absent valid evidence renders an unavailable state with no quality score.
- AI Operations and Context engineering are range-dependent. Context
  engineering loads aggregate-only telemetry from
  `GET /admin/context-engineering`, shows explicit numerator/denominator and
  unavailable states, and labels actual-versus-estimated token and cost
  semantics. It never requests or renders raw traces, prompts, memories, RAG
  text, tool payloads, or provenance. A reporting-range change invalidates and
  reloads the active range-dependent section; Commercial administration and
  Emergency Controls remain cached. Refresh and retry clear and reload only affected sections, so
  a failure cannot clear another section’s successful data.
- Safe admin mutations stay in their relevant sections: retained failed BullMQ
  jobs in Recent Failures, eligible users in Commercial administration, and AI
  feature controls in Emergency controls. `adminApi.js` strictly validates every
  operation envelope and payload, `useAdminOperations` owns per-target pending,
  success, safe error, duplicate prevention, and targeted refresh behavior, and
  `AdminOperationDialog` owns confirmation, keyboard/focus, reason/duration,
  and audit-reference presentation.
- `src/hooks/useHomeContent.js` owns homepage content loading state.
- `src/api/authApi.js` owns auth/profile HTTP calls and response shape validation.
- `src/api/billingApi.js` owns provider-neutral checkout/payment, billing management, and billing usage calls. It validates `paymentUrl` and `managementUrl` rather than provider-specific checkout or portal field names.
- `src/api/cartApi.js` owns authenticated cart reservation HTTP calls.
- `src/api/chatApi.js` owns backend HTTP calls and response shape validation.
- `src/api/voiceChatApi.js` owns raw audio upload calls to `POST /voice-chat` and resolves returned audio response URLs.
- `src/api/birdIdentificationApi.js` owns authenticated bird identification URL and raw image upload calls to `POST /birds/identify`, job polling through `GET /jobs/:id`, normalizes the `{ success, data, meta }` envelope, and should preserve optional bird-identification fields defensively.
- `src/api/homeApi.js` owns homepage HTTP calls and response shape validation.
- `src/api/adminMaintenanceApi.js` owns maintenance CRUD, admin tour-image replacement through `PUT /admin/tours/:tourId/image`, and protected forward/reverse location lookup; presentational components never call storage or geocoding providers directly. Existing tour editors prefer a valid persisted numeric-ID or UUID `imagePath`, derive the read-only `tours/{tourId}.png` compatibility reference when it is empty, validate and preview one PNG up to 5 MB, then upload the replacement before refreshing. A successful image response contains the new immutable S3 key plus a stable versioned delivery URL; the editor retains that record, and `useProductShell` publishes it for only the matching homepage tour. Device coordinates remain only in the active node form until save and are sent at full browser-provided precision through this adapter solely to resolve a readable name. `src/config/geolocation.js` owns the high-accuracy/freshness policy: positions older than two minutes or with uncertainty above 1,000 m are rejected, readings above 100 m are identified as approximate, and accepted accuracy is shown beside a retry action. A reverse-provider label more than 25 km from the authoritative selection is discarded in favor of formatted coordinates. The Node dialog exposes geolocation only in secure contexts, observes Permissions API changes when supported, never requests device location before explicit activation, and versions coordinate/reverse requests so stale responses cannot replace newer map or search selections.
- Country maintenance records own each administrative map's nullable initial `latitude`, `longitude`, and `zoom`. `src/config/map.js` validates that triplet and supplies the documented fallback (`9.75`, `-84.2`, zoom `7`) when it is incomplete or invalid. Existing markers and successful place searches use a focused view. The node picker uses shared Web Mercator world-pixel transforms for its OSM tiles, marker, selection, panning, and zoom anchoring; it supports bounded wheel, pinch, button, and keyboard zoom plus pointer/touch and keyboard panning, while a tap places the marker only when the gesture did not become a drag.
- `src/api/mediaApi.js` owns bird media URL resolution through CloudFront when configured, with backend media endpoint fallback.
- `src/index.css` is the ordered global CSS entry point; `src/styles/*` owns
  foundation, admin, shared base, homepage, overlay, chat, and final responsive
  layers as documented in `docs/styles.md`.
- `server.js` serves `dist/` in production-style environments and exposes `/health`.
- `vite.config.js` owns dev proxying and preview host allowlists.

## Runtime Flows
Send chat message:
```text
ChatInput submit
  -> ChatSurface.sendMessage from useChat
  -> optimistic user message append plus in-progress assistant message
  -> chatApi.streamChatMessage with optional bearer token
  -> POST /chat on the backend
  -> parse SSE start/chunk/replace/done/error events
  -> buffer chunks and reveal assistant text progressively
  -> persist returned conversationId
  -> finalize assistant response
  -> attach meta.reservation when present
  -> render reservation confirmation card from metadata, with text parsing fallback for older messages
  -> render per-turn RAG bird media cards from meta.birdMatches when present
  -> resolve relative bird media paths through CloudFront or GET /files/:folderName/:filename before using them in image or audio elements
  -> ignore optional sources/tool metadata until a UI surface exists
  -> cache messages in localStorage
```

Billing checkout and management:
```text
Account menu upgrade/manage action
  -> useProductShell upgradePlan or manageBilling
  -> billingApi.createCheckoutSession or createCustomerPortalSession with bearer token
  -> POST /billing/checkout or POST /billing/portal on the backend
  -> backend selects the requested provider or BILLING_DEFAULT_PROVIDER
  -> backend returns provider-neutral data.paymentUrl or data.managementUrl
  -> UI redirects to the hosted provider URL without storing provider customer IDs, subscription IDs, price IDs, or secrets
```

Send voice chat message:
```text
ChatInput microphone control
  -> useAudioRecorder asks for microphone access and owns MediaRecorder/track cleanup
  -> audioEncoding converts decoded samples to audio/wav without React or MediaRecorder dependencies
  -> useVoiceChatUpload delegates raw WAV upload to voiceChatApi.sendVoiceChat
  -> request headers include X-Conversation-Id, X-Customer-Context, X-Conversation-Context, and X-Response-Mode: field_assistant when available
  -> backend transcribes speech, runs the existing chat orchestration, generates speech, stores MP3 in S3, and returns transcript, answer, and audioResponseUrl
  -> voiceChatApi resolves relative /files/voice-chat/... URLs through CloudFront or the backend files endpoint
  -> useChat appends the transcript as a user message and the answer as an assistant message with audioUrl
  -> ChatMessages renders assistant text plus playable response audio
  -> cache messages in localStorage
```

Conversation hydration:
```text
useAuth restores birdwatchingAI.authState
  -> useChat initial state
  -> read birdwatchingAI.chatState.<userId> from localStorage
  -> restore conversationId, customerContext, and cached messages when present
  -> if no scoped cache, call chatApi.loadLatestConversation
  -> otherwise, if messages are missing, call chatApi.loadConversationMessages
  -> GET /chat/latest or GET /chat/:conversationId on the backend with bearer token
  -> cache loaded messages and render transcript
```

Local development API routing:
```text
Browser fetch('/auth/*', '/billing/*', '/cart/*', '/chat', '/voice-chat', '/homepage/*', '/tours', '/birds/*', '/jobs/*', '/addons/*', or '/files/*')
  -> Vite dev proxy
  -> VITE_API_URL, VITE_API_PROXY_TARGET, or http://localhost:3001
  -> Birdwatching AI API
```

Production API routing:
```text
Browser fetch(`${VITE_API_URL}/auth/*`, `${VITE_API_URL}/billing/*`, `${VITE_API_URL}/cart/*`, `${VITE_API_URL}/chat`, `${VITE_API_URL}/voice-chat`, `${VITE_API_URL}/birds/*`, `${VITE_API_URL}/jobs/*`, `${VITE_API_URL}/files/*`, or homepage content endpoints)
  -> public Birdwatching AI API
```

Bird identification:
```text
Authenticated HomeHeader Identify Bird action
  -> BirdIdentificationModal
  -> useBirdIdentification
  -> birdIdentificationApi.identifyBirdByUrl or identifyBirdByFile
  -> POST /birds/identify with bearer token
  -> backend validates one image input, stores raw uploads when needed, and returns either a queued job or a completed normalized JSON result
  -> for queued jobs, useBirdIdentification polls GET /jobs/:id until completed, failed, or not_found
  -> completed jobs render the final rich visual evidence, candidates, bird-profile RAG verification/reranking, and normalized response
  -> modal renders status, a best-match comparison with submitted-image clarity overlay plus optional reference-image overlay, candidate confidence/reasoning/evidence, uncertainty notes, and optional candidate images inline
```

Bird media development routing:
```text
Browser fetch('/files/:folderName/:filename')
  -> Vite dev proxy
  -> VITE_API_PROXY_TARGET
  -> Birdwatching AI API media endpoint
  -> JSON envelope with data.url media URL
```

## Important Implementation Facts
- ESM is enabled through `"type": "module"` in `package.json`.
- The app has multiple internally selected product surfaces and currently no React Router dependency. These surfaces do not require independent URLs, so selection remains lightweight local state.
- Users see the homepage first. Login CTAs open the existing auth form. Continuing as a visitor opens general chat in the homepage drawer. Carousel `Book Tour` and cart reservation actions open reservation chat in that same drawer and transfer the selected tour or cart through structured state; there is no standalone homepage chat CTA. The reusable full-page chat surface remains available outside these homepage transitions.
- Unauthenticated users who start chat enter visitor mode; authenticated users continue to the existing customer-context and chat flow.
- `useAuth` stores only the access token, refresh token, expiry timestamps, and safe user profile, or a safe local visitor marker, under `birdwatchingAI.authState`.
- `useAuth.getValidToken` refreshes expiring access tokens before authenticated chat calls and clears local auth state when refresh fails.
- Authenticated chat state is stored under `birdwatchingAI.chatState.<userId>` so user switching cannot reuse another user's local transcript.
- `VITE_API_URL` is trimmed of trailing slash before request URLs are built.
- Empty `VITE_API_URL` intentionally produces relative `/auth`, `/billing`, `/cart`, `/chat`, `/voice-chat`, `/homepage`, `/tours`, `/birds`, `/jobs`, `/addons`, and `/files` URLs for local proxying.
- The current dev proxy covers `/auth`, `/admin`, `/my-tours`, `/billing`, `/cart`, `/chat`, `/voice-chat`, `/homepage`, `/tours`, `/birds`, `/jobs`, `/addons`, and `/files`.
- Admin navigation exposes collapsible Maintenance (Birds, Zones, Nodes, Tours) and Administration categories and automatically expands the active category. Countries and Birds by node remain supported API resources without separate navigation choices.
- Tours, Zones, Nodes, and Birds use one server-paginated responsive grid each. Their grid header contains text search only; Create sits beside the search form, row-level Edit opens the canonical form in a focus-contained dialog, and successful edits retain the current page/search whenever the record remains on that page.
- The first country returned by the maintenance reference API is the administrative default. An empty country dataset blocks geographic/tour saving with an actionable message.
- Tour forms submit only `nodeId`; selected-node coordinates are shown read-only. Tour editors offer inline node creation without resetting draft values. Flexible-date tours use `maxParticipants` and omit availability/start/end controls, while scheduled tours expose those occurrence-backed scheduling fields. Duration is edited and rendered as an explicit positive `durationValue` plus `hours` or `days`. Existing nodes, synchronized map/numeric coordinates, protected place search, and bird assignments are maintained through the standalone Nodes grid and its shared node dialog.
- Maintenance and node dialogs close from their backdrop only when no blocking operation is pending. Dirty forms require explicit Keep editing or Discard changes confirmation, and nested node dialogs dismiss only their active layer before returning focus to the opener. The map releases pointer capture on completion, cancellation, interruption, and unmount so a gesture cannot strand dialog controls or dismissal.
- `vite.config.js` chooses the proxy target from `VITE_API_URL`, then `VITE_API_PROXY_TARGET`, then `http://localhost:3001`.
- `CustomerContextForm` collects `customerName`, `customerEmail`, `itineraryStartDate`, and `itineraryEndDate` before the authenticated chat transcript is shown. Visitor mode skips customer context and is limited by the backend to bird questions only.
- The customer context is frontend intake only. The backend remains authoritative for authenticated identity, durable conversations, reservations, billing records, usage tracking, quotas, RAG, tours, jobs, and media delivery.
- `useChat` creates a client conversation ID before the first backend response.
- The backend may return a different `conversationId`; the UI persists the returned ID.
- `streamChatMessage` sends `customerContext` and sanitized recent assistant metadata as `conversationContext.recentAssistantMetadata` so the backend can continue guided booking flows. Backend ownership and authenticated identity remain authoritative.
- `sendVoiceChat` sends raw `audio/wav` bytes to `POST /voice-chat`. `useAudioRecorder` captures with `MediaRecorder`, `audioEncoding.js` converts decoded samples to WAV, and `useVoiceChatUpload` keeps upload/cancellation separate while setting `X-Response-Mode: field_assistant`.
- Voice chat requests can include `X-Conversation-Id`, `X-Customer-Context`, `X-Conversation-Context`, and `X-Role`. The backend currently accepts only MP3/WAV raw audio content types, so the UI does not upload browser-native `audio/webm` directly.
- Voice chat responses include a transcript, assistant answer, and relative `audioResponseUrl`. The UI stores the transcript in the user message, stores the resolved playback URL on the assistant message as `audioUrl`, and keeps relative `/files/voice-chat/...` values out of component URL construction.
- The backend may return RAG `sources`; the current UI accepts the field but does not render it.
- The backend may return RAG bird profiles as `done.meta.birdMatches`; the UI stores those as assistant-message metadata and renders a compact carousel plus modal details.
- Bird media values in `meta.birdMatches[].media` may be absolute URLs or relative object keys such as `/photos/123_medium.jpg`, `songs/123.mp3`, or `sonograms/123_grey-small.png`. Relative values are resolved by `src/api/mediaApi.js` through `VITE_CLOUDFRONT_BASE_URL` when configured, or through `GET /files/:folderName/:filename`; components must not assume those paths are directly browser-accessible.
- Bird identification responses from `POST /birds/identify` may immediately include `{ jobId, status: "queued" }`. The hook stores the job ID in memory only, shows queued/processing state, polls `GET /jobs/:id`, renders completed `result`, and shows safe failed/not-found messages. Completed bird identification results include `status`, `bestMatch`, `candidates`, rich `imageAnalysis`, compatibility `imageObservations`, `summary`, and `notes` when available. UI code uses image-analysis confidence as visual evidence in the best-match comparison, overlays best-match reference media when available, falls back to `imageObservations.confidence`, and renders missing optional fields defensively.
- Bird identification `status` values have product meaning: `identified` can emphasize `bestMatch`, `uncertain` should preserve multiple plausible candidates, and `unknown` should explain that the image evidence is insufficient instead of implying failure. Candidate cards may include `commonName`, legacy `species`, `scientificName`, `confidence`, `reasoning`, `visualEvidence`, `ragSupport` rendered as supporting details, `contradictions`, `missingEvidence`, inline square media, and profile metadata.
- Bird identification debug details are not part of the normal UI contract. The backend can expose admin-only `meta.debug` with internal analysis/candidate/profile details when explicitly requested, but the frontend should not request or render it in the standard user flow.
- Tour listing, recommendation, selection, availability, pricing, discounts, and reservations happen inside the backend chat flow and are summarized in the final streamed assistant response. Recommendation-mode results render from validated `meta.tourRecommendation` only, while the original assistant text remains visible; tour metadata can include graph-backed `location`, `node`, `subnode`, and `zone` fields.
- Featured tours support approximate, accent-insensitive search across tour names, locations, descriptions, birds, interests, and tour types. Only active, unexpired tours with usable capacity are rendered as bookable, with a clearable empty state.
- `Book Tour` opens the homepage reservation drawer with the exact selected tour in structured conversation state, preserves customer/itinerary context and conversation continuity, and bypasses recommendation search. Date actions accept only backend-provided scheduled dates or itinerary dates for flexible tours.
- Structured backend `uiAction` and `uiActions` metadata can render chat controls for choices, tour selection, date picking, participant count, transportation selection, and reservation confirmation.
- Successful backend reservations can return `meta.reservation`; the UI stores that metadata on the assistant message for display and shows tour `location`, `node`, `subnode`, and `zone` when present.
- `useChat` uses `AbortController` to stop active streams and keeps visible partial assistant text without showing an error fallback.
- Incoming stream chunks are buffered and revealed on a short timer so text appears at a readable pace.
- `ChatMessages` uses `src/utils/reservationConfirmation.js` to normalize reservation metadata or detect older confirmed reservation summaries and render `ReservationConfirmationCard` without adding backend tool logic to the browser.
- `BirdMediaCard` and bird carousel thumbnails use `useResolvedMediaUrl` so relative RAG media is exchanged for renderable media URLs before rendering.
- The UI does not currently call a standalone recommendations endpoint; tour recommendations are handled through the backend chat/tool flow.
- The homepage calls public, cache-friendly content endpoints for hero media, tours, bird highlights, and transportation instead of using the streaming chat endpoint for static homepage sections.
- Public browser routes used by this app are auth signup/login/refresh/logout, `POST /chat` for visitor chat, `POST /voice-chat` for visitor voice chat, homepage content endpoints, tour/add-on listing endpoints, bird highlights/profile media, and `GET /files/:folderName/:filename`.
- Authenticated browser routes include `PATCH /auth/profile`, `POST /auth/profile-image`, `POST /billing/checkout`, `POST /billing/portal`, `GET /billing/usage`, cart reservation endpoints, `GET /chat/latest`, `GET /chat/:conversationId`, `POST /birds/identify`, and `GET /jobs/:id`.
- Authenticated chat, voice chat, conversation hydration, cart, billing, profile, and bird identification requests include `Authorization: Bearer <token>`; visitor chat and voice chat requests omit the token and send `role` or `X-Role` as `visitor`.
- Authenticated profile and billing requests include `Authorization: Bearer <token>`; the account menu updates safe user profile state locally and redirects to provider-hosted `paymentUrl` or `managementUrl` values returned by the backend.
- Billing is provider-agnostic at the UI boundary. The frontend may pass an optional provider or plan when explicitly surfaced by product requirements, but it must not hard-code Stripe object names or accept provider customer/subscription identifiers from users.
- Profile image previews may use selected file data in memory only; persisted auth state stores only the backend-returned `imageUrl`.
- Message cache failures are swallowed so chat still works when storage is unavailable.
- Request failures append a user-friendly assistant error message and also expose the backend/client error in the alert.
- Chat scroll position is pushed to the newest message with `useLayoutEffect`.
- CSS supports light and dark color schemes through semantic custom properties.
- Production serving uses the bounded Node static server in `server.js`; Vite
  preview remains a local inspection command only.

## Testing
Tests live under component-level `__tests__/` folders and use Jest with React Testing Library.

Run:
```bash
npm test
```

Current coverage focuses on:
- `ChatInput` submit, disabled, and keyboard behavior
- `ChatMessages` empty, populated, and loading states
- auth form submission, auth restoration, logout, and unauthenticated app rendering
- authenticated customer context prefill and locked email behavior
- homepage entry flow and cookie consent persistence
- `useChat` persistence, streaming, metadata forwarding, and cancellation behavior
- admin-operation adapter paths/headers/bodies, strict payload validation, safe
  `401`/`403`/`404`/`409`/`422`/network/`5xx` handling, hook retry and
  duplicate prevention, accessible confirmations, audit references, and
  refresh-after-success behavior

## When Extending
1. Add or update API adapter behavior in `src/api/`.
2. Keep cross-surface orchestration in `useProductShell` or a focused controller, and surface-specific async behavior in hooks under `src/hooks/`.
3. Keep surface composition in `src/pages/` and presentational pieces in `src/components/`.
4. Keep reusable visual decisions in tokens and shared CSS patterns.
5. Update [docs/api.md](./docs/api.md) when backend request or response usage changes.
6. Update [docs/memory.md](./docs/memory.md) when local conversation state changes.
7. Update [docs/prompting.md](./docs/prompting.md) when input handling, output rendering, or chat copy changes.
8. Add focused React Testing Library tests for user-visible behavior.

## Authoritative safety-control UI

The Admin Dashboard loads AI feature state and safe suspension fields through
`adminApi`. Suspended users show their timestamp and a Reactivate action;
disabled features show localized expiration, remaining time, and an Enable
action. All reversals use accessible confirmations, validated non-optimistic
responses, refresh-after-success, and audit references.

Public voice, bird identification, and booking controls combine product flags
with `GET /features/availability`. Temporary shutdowns keep useful controls
visible but disabled with feature-specific text, and expiry triggers a refresh.
