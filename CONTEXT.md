# Project Context

AI-agent entry point for the Birdwatching AI UI. Read this file first, then follow links for deeper details.

## What This Is
This repository is a single React/Vite frontend for Costa Rica birdwatching assistance. It supports:
- responsive chat UI with user and assistant message roles
- upfront customer context collection for booking-ready name, email, and itinerary dates
- styled reservation confirmation cards for confirmed booking responses
- progressive assistant streaming with typing/loading state and stop-generation support
- email/password authentication with local JWT session persistence
- local chat state persistence with `localStorage`
- cached conversation messages and customer context for fast reloads
- authenticated latest-conversation hydration through `GET /chat/latest`
- backend hydration through `GET /chat/:conversationId`
- backend streaming chat requests through `POST /chat`
- bird profile media resolution through `GET /files/:folderName/:filename` when RAG metadata contains relative media paths
- backend-generated tour discovery, pricing, discounts, and reservation confirmations through assistant responses
- Railway-oriented static deployment with environment-driven API configuration

## Source Of Truth Map
- Human overview and setup: [README.md](./README.md)
- Agent rules and UI conventions: [AGENTS.md](./AGENTS.md)
- Architecture and render/data flow: [docs/architecture.md](./docs/architecture.md)
- Backend API integration: [docs/api.md](./docs/api.md)
- UI copy and prompt-adjacent guidance: [docs/prompting.md](./docs/prompting.md)
- Conversation state behavior: [docs/memory.md](./docs/memory.md)
- Deployment and environment: [docs/deployment.md](./docs/deployment.md)
- Frontend implementation rules: [docs/frontend-guidelines.md](./docs/frontend-guidelines.md)
- Historical AI prompts: [docs/development_prompts/README.md](./docs/development_prompts/README.md)

## Current Architecture
The app uses a shell-component-hook-API split:
- `src/main.jsx` mounts React in strict mode.
- `src/App.jsx` composes the page shell, error alert, messages, and input.
- `src/components/*` owns presentational chat UI.
- `src/hooks/useAuth.js` owns auth state, token persistence, login, signup, and logout.
- `src/hooks/useChat.js` owns conversation state, local persistence, loading, and errors.
- `src/api/authApi.js` owns auth HTTP calls and response shape validation.
- `src/api/chatApi.js` owns backend HTTP calls and response shape validation.
- `src/api/mediaApi.js` owns bird media URL resolution through the backend media endpoint.
- `src/index.css` owns global tokens, layout, responsive behavior, and dark mode.
- `server.js` serves `dist/` in production-style environments and exposes `/health`.
- `vite.config.js` owns dev proxying and preview host allowlists.

## Runtime Flows
Send chat message:
```text
ChatInput submit
  -> App.sendMessage from useChat
  -> optimistic user message append plus in-progress assistant message
  -> chatApi.streamChatMessage with bearer token
  -> POST /chat on the backend
  -> parse SSE start/chunk/replace/done/error events
  -> buffer chunks and reveal assistant text progressively
  -> persist returned conversationId
  -> finalize assistant response
  -> attach meta.reservation when present
  -> render reservation confirmation card from metadata, with text parsing fallback for older messages
  -> render per-turn RAG bird media cards from meta.birdMatches when present
  -> resolve relative bird media paths through GET /files/:folderName/:filename before using them in image or audio elements
  -> ignore optional sources/tool metadata until a UI surface exists
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
Browser fetch('/auth/*' or '/chat')
  -> Vite dev proxy
  -> VITE_API_PROXY_TARGET
  -> Birdwatching AI API
```

Bird media development routing:
```text
Browser fetch('/files/:folderName/:filename')
  -> Vite dev proxy
  -> VITE_API_PROXY_TARGET
  -> Birdwatching AI API media endpoint
  -> JSON envelope with data.url presigned media URL
```

Production API routing:
```text
Browser fetch(`${VITE_API_URL}/auth/*` or `${VITE_API_URL}/chat`)
  -> public Birdwatching AI API
```

## Important Implementation Facts
- ESM is enabled through `"type": "module"` in `package.json`.
- The app has one screen and currently no React Router dependency.
- Unauthenticated users see login/signup views unless they choose visitor mode; authenticated users see the existing customer-context and chat flow.
- `useAuth` stores only the access token, refresh token, expiry timestamps, and safe user profile, or a safe local visitor marker, under `birdwatchingAI.authState`.
- `useAuth.getValidToken` refreshes expiring access tokens before authenticated chat calls and clears local auth state when refresh fails.
- Authenticated chat state is stored under `birdwatchingAI.chatState.<userId>` so user switching cannot reuse another user's local transcript.
- `VITE_API_URL` is trimmed of trailing slash before request URLs are built.
- Empty `VITE_API_URL` intentionally produces relative `/auth` and `/chat` URLs for local proxying.
- `VITE_API_PROXY_TARGET` should point to the local or remote backend during `npm run dev`.
- `CustomerContextForm` collects `customerName`, `customerEmail`, `itineraryStartDate`, and `itineraryEndDate` before the authenticated chat transcript is shown. Visitor mode skips customer context and is limited by the backend to bird questions only.
- `useChat` creates a client conversation ID before the first backend response.
- The backend may return a different `conversationId`; the UI persists the returned ID.
- `streamChatMessage` sends `customerContext` and sanitized recent assistant metadata as `conversationContext.recentAssistantMetadata` so the backend can continue guided booking flows. Backend ownership and authenticated identity remain authoritative.
- The backend may return RAG `sources`; the current UI accepts the field but does not render it.
- The backend may return RAG bird profiles as `done.meta.birdMatches`; the UI stores those as assistant-message metadata and renders a compact carousel plus modal details.
- Bird media values in `meta.birdMatches[].media` may be absolute URLs or relative object keys such as `/photos/123_medium.jpg`, `songs/123.mp3`, or `sonograms/123_grey-small.png`. Relative values are resolved by `src/api/mediaApi.js` through `GET /files/:folderName/:filename`; components must not assume those paths are directly browser-accessible.
- Tour listing, recommendation, selection, availability, pricing, discounts, and reservations happen inside the backend chat flow and are summarized in the final streamed assistant response.
- Structured backend `uiAction` and `uiActions` metadata can render chat controls for choices, tour selection, date picking, participant count, transportation selection, and reservation confirmation.
- Successful backend reservations can return `meta.reservation`; the UI stores that metadata on the assistant message for display.
- `useChat` uses `AbortController` to stop active streams and keeps visible partial assistant text without showing an error fallback.
- Incoming stream chunks are buffered and revealed on a short timer so text appears at a readable pace.
- `ChatMessages` uses `src/utils/reservationConfirmation.js` to normalize reservation metadata or detect older confirmed reservation summaries and render `ReservationConfirmationCard` without adding backend tool logic to the browser.
- `BirdMediaCard` and bird carousel thumbnails use `useResolvedMediaUrl` so relative RAG media is exchanged for backend-provided presigned URLs before rendering.
- The UI does not currently call `POST /recommend`, even though the backend exposes it for structured recommendation use cases.
- Authenticated chat requests and conversation hydration include `Authorization: Bearer <token>`; visitor chat requests omit the token and send `role: "visitor"`.
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
