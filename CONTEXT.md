# Project Context

AI-agent entry point for the Birdwatching AI UI. Read this file first, then follow links for deeper details.

## What This Is
This repository is a single React/Vite frontend for Costa Rica birdwatching assistance. It supports:
- responsive chat UI with user and assistant message roles
- upfront customer context collection for booking-ready name, email, and itinerary dates
- styled reservation confirmation cards for confirmed booking responses
- progressive assistant streaming with typing/loading state and stop-generation support
- email/password authentication with local JWT session persistence
- authenticated display-name and profile-image updates from the account menu
- premium homepage entry point for tours, bird highlights, transportation add-ons, chat, login, and cookie consent
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
- backend-generated tour discovery, pricing, discounts, and reservation confirmations through assistant responses
- provider-agnostic billing upgrades and hosted billing management through authenticated backend billing endpoints, with Stripe currently used by the backend as the first provider adapter
- Railway-oriented static deployment with environment-driven API configuration

## Source Of Truth Map
- Human overview and setup: [README.md](./README.md)
- Agent rules and UI conventions: [AGENTS.md](./AGENTS.md)
- Architecture and render/data flow: [docs/architecture.md](./docs/architecture.md)
- Backend API integration: [docs/api.md](./docs/api.md)
- UI copy and prompt-adjacent guidance: [docs/prompting.md](./docs/prompting.md)
- Conversation state behavior: [docs/memory.md](./docs/memory.md)
- Deployment and environment: [docs/deployment.md](./docs/deployment.md)
- Product analytics and event ownership: [docs/analytics.md](./docs/analytics.md)
- Frontend implementation rules: [docs/frontend-guidelines.md](./docs/frontend-guidelines.md)
- Historical AI prompts: [docs/development_prompts/README.md](./docs/development_prompts/README.md)

## Current Architecture
The app uses a shell-component-hook-API split:
- `src/main.jsx` mounts React in strict mode.
- `src/App.jsx` composes the homepage, auth, and chat views.
- `src/pages/HomePage.jsx` composes the premium homepage entry point.
- `src/components/*` owns presentational chat UI.
- `src/components/home/*` owns presentational homepage sections.
- `src/hooks/useAuth.js` owns auth state, token persistence, login, signup, logout, and profile updates.
- `src/hooks/useChat.js` owns conversation state, local persistence, loading, and errors.
- `src/hooks/useHomeContent.js` owns homepage content loading state.
- `src/api/authApi.js` owns auth/profile HTTP calls and response shape validation.
- `src/api/billingApi.js` owns provider-neutral checkout/payment, billing management, and billing usage calls. It validates `paymentUrl` and `managementUrl` rather than provider-specific checkout or portal field names.
- `src/api/cartApi.js` owns authenticated cart reservation HTTP calls.
- `src/api/chatApi.js` owns backend HTTP calls and response shape validation.
- `src/api/voiceChatApi.js` owns raw audio upload calls to `POST /voice-chat` and resolves returned audio response URLs.
- `src/api/birdIdentificationApi.js` owns authenticated bird identification URL and raw image upload calls to `POST /birds/identify`, job polling through `GET /jobs/:id`, normalizes the `{ success, data, meta }` envelope, and should preserve optional bird-identification fields defensively.
- `src/api/homeApi.js` owns homepage HTTP calls and response shape validation.
- `src/api/mediaApi.js` owns bird media URL resolution through CloudFront when configured, with backend media endpoint fallback.
- `src/index.css` owns global tokens, layout, responsive behavior, and dark mode.
- `server.js` serves `dist/` in production-style environments and exposes `/health`.
- `vite.config.js` owns dev proxying and preview host allowlists.

## Runtime Flows
Send chat message:
```text
ChatInput submit
  -> App.sendMessage from useChat
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
  -> App.handleUpgrade or App.handleManageBilling
  -> billingApi.createCheckoutSession or createCustomerPortalSession with bearer token
  -> POST /billing/checkout or POST /billing/portal on the backend
  -> backend selects the requested provider or BILLING_DEFAULT_PROVIDER
  -> backend returns provider-neutral data.paymentUrl or data.managementUrl
  -> UI redirects to the hosted provider URL without storing provider customer IDs, subscription IDs, price IDs, or secrets
```

Send voice chat message:
```text
ChatInput microphone control
  -> useChat.startVoiceRecording asks for microphone access and starts MediaRecorder
  -> useChat.stopVoiceRecording stops tracks and converts the browser recording to audio/wav
  -> voiceChatApi.sendVoiceChat posts raw WAV bytes to POST /voice-chat
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
  -> VITE_API_URL, VITE_API_PROXY_TARGET, or http://localhost:3000
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
- The app has one screen and currently no React Router dependency.
- Users see the homepage first. Login CTAs open the existing auth form, and chat CTAs open the existing authenticated or visitor chat flow.
- Unauthenticated users who start chat enter visitor mode; authenticated users continue to the existing customer-context and chat flow.
- `useAuth` stores only the access token, refresh token, expiry timestamps, and safe user profile, or a safe local visitor marker, under `birdwatchingAI.authState`.
- `useAuth.getValidToken` refreshes expiring access tokens before authenticated chat calls and clears local auth state when refresh fails.
- Authenticated chat state is stored under `birdwatchingAI.chatState.<userId>` so user switching cannot reuse another user's local transcript.
- `VITE_API_URL` is trimmed of trailing slash before request URLs are built.
- Empty `VITE_API_URL` intentionally produces relative `/auth`, `/billing`, `/cart`, `/chat`, `/voice-chat`, `/homepage`, `/tours`, `/birds`, `/jobs`, `/addons`, and `/files` URLs for local proxying.
- The current dev proxy covers `/auth`, `/billing`, `/cart`, `/chat`, `/voice-chat`, `/homepage`, `/tours`, `/birds`, `/jobs`, `/addons`, and `/files`.
- `vite.config.js` chooses the proxy target from `VITE_API_URL`, then `VITE_API_PROXY_TARGET`, then `http://localhost:3000`.
- `CustomerContextForm` collects `customerName`, `customerEmail`, `itineraryStartDate`, and `itineraryEndDate` before the authenticated chat transcript is shown. Visitor mode skips customer context and is limited by the backend to bird questions only.
- The customer context is frontend intake only. The backend remains authoritative for authenticated identity, durable conversations, reservations, billing records, usage tracking, quotas, RAG, tours, jobs, and media delivery.
- `useChat` creates a client conversation ID before the first backend response.
- The backend may return a different `conversationId`; the UI persists the returned ID.
- `streamChatMessage` sends `customerContext` and sanitized recent assistant metadata as `conversationContext.recentAssistantMetadata` so the backend can continue guided booking flows. Backend ownership and authenticated identity remain authoritative.
- `sendVoiceChat` sends raw `audio/wav` bytes to `POST /voice-chat`. The UI records with `MediaRecorder` when available, converts the result to WAV with `AudioContext`, and sets `X-Response-Mode: field_assistant` so spoken answers stay short and actionable.
- Voice chat requests can include `X-Conversation-Id`, `X-Customer-Context`, `X-Conversation-Context`, and `X-Role`. The backend currently accepts only MP3/WAV raw audio content types, so the UI does not upload browser-native `audio/webm` directly.
- Voice chat responses include a transcript, assistant answer, and relative `audioResponseUrl`. The UI stores the transcript in the user message, stores the resolved playback URL on the assistant message as `audioUrl`, and keeps relative `/files/voice-chat/...` values out of component URL construction.
- The backend may return RAG `sources`; the current UI accepts the field but does not render it.
- The backend may return RAG bird profiles as `done.meta.birdMatches`; the UI stores those as assistant-message metadata and renders a compact carousel plus modal details.
- Bird media values in `meta.birdMatches[].media` may be absolute URLs or relative object keys such as `/photos/123_medium.jpg`, `songs/123.mp3`, or `sonograms/123_grey-small.png`. Relative values are resolved by `src/api/mediaApi.js` through `VITE_CLOUDFRONT_BASE_URL` when configured, or through `GET /files/:folderName/:filename`; components must not assume those paths are directly browser-accessible.
- Bird identification responses from `POST /birds/identify` may immediately include `{ jobId, status: "queued" }`. The hook stores the job ID in memory only, shows queued/processing state, polls `GET /jobs/:id`, renders completed `result`, and shows safe failed/not-found messages. Completed bird identification results include `status`, `bestMatch`, `candidates`, rich `imageAnalysis`, compatibility `imageObservations`, `summary`, and `notes` when available. UI code uses image-analysis confidence as visual evidence in the best-match comparison, overlays best-match reference media when available, falls back to `imageObservations.confidence`, and renders missing optional fields defensively.
- Bird identification `status` values have product meaning: `identified` can emphasize `bestMatch`, `uncertain` should preserve multiple plausible candidates, and `unknown` should explain that the image evidence is insufficient instead of implying failure. Candidate cards may include `commonName`, legacy `species`, `scientificName`, `confidence`, `reasoning`, `visualEvidence`, `ragSupport` rendered as supporting details, `contradictions`, `missingEvidence`, inline square media, and profile metadata.
- Bird identification debug details are not part of the normal UI contract. The backend can expose admin-only `meta.debug` with internal analysis/candidate/profile details when explicitly requested, but the frontend should not request or render it in the standard user flow.
- Tour listing, recommendation, selection, availability, pricing, discounts, and reservations happen inside the backend chat flow and are summarized in the final streamed assistant response. Tour metadata can include graph-backed `location`, `node`, `subnode`, and `zone` fields.
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
- Production serving can use `vite preview` through `npm run start`; `server.js` is available as a small static server but is not the current package start command.

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

## When Extending
1. Add or update API adapter behavior in `src/api/`.
2. Keep async UI orchestration in hooks under `src/hooks/`.
3. Keep presentational chat pieces in `src/components/`.
4. Keep reusable visual decisions in tokens and shared CSS patterns.
5. Update [docs/api.md](./docs/api.md) when backend request or response usage changes.
6. Update [docs/memory.md](./docs/memory.md) when local conversation state changes.
7. Update [docs/prompting.md](./docs/prompting.md) when input handling, output rendering, or chat copy changes.
8. Add focused React Testing Library tests for user-visible behavior.
