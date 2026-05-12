# Project Context

AI-agent entry point for the Birdwatching AI UI. Read this file first, then follow links for deeper details.

## What This Is
This repository is a single React/Vite frontend for Costa Rica birdwatching assistance. It supports:
- responsive chat UI with user and assistant message roles
- styled reservation confirmation cards for confirmed booking responses
- typing/loading state while the backend generates a response
- local conversation ID persistence with `localStorage`
- cached conversation messages for fast reloads
- backend hydration through `GET /chat/:conversationId`
- backend chat requests through `POST /chat`
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
- `src/hooks/useChat.js` owns conversation state, local persistence, loading, and errors.
- `src/api/chatApi.js` owns backend HTTP calls and response shape validation.
- `src/index.css` owns global tokens, layout, responsive behavior, and dark mode.
- `server.js` serves `dist/` in production-style environments and exposes `/health`.
- `vite.config.js` owns dev proxying and preview host allowlists.

## Runtime Flows
Send chat message:
```text
ChatInput submit
  -> App.sendMessage from useChat
  -> optimistic user message append
  -> chatApi.sendChatMessage
  -> POST /chat on the backend
  -> validate normalized backend envelope
  -> persist returned conversationId
  -> append assistant response
  -> attach meta.reservation when meta.isReservationMessage is true
  -> render reservation confirmation card from metadata, with text parsing fallback for older messages
  -> ignore optional sources/tool metadata until a UI surface exists
  -> cache messages in localStorage
```

Conversation hydration:
```text
useChat initial state
  -> read birdwatchingAI.conversationId from localStorage
  -> read cached birdwatchingAI.messages.{conversationId}
  -> if no cache, call chatApi.loadConversationMessages
  -> GET /chat/:conversationId on the backend
  -> cache loaded messages and render transcript
```

Local development API routing:
```text
Browser fetch('/chat')
  -> Vite dev proxy
  -> VITE_API_PROXY_TARGET
  -> Birdwatching AI API
```

Production API routing:
```text
Browser fetch(`${VITE_API_URL}/chat`)
  -> public Birdwatching AI API
```

## Important Implementation Facts
- ESM is enabled through `"type": "module"` in `package.json`.
- The app has one screen and currently no React Router dependency.
- `VITE_API_URL` is trimmed of trailing slash before request URLs are built.
- Empty `VITE_API_URL` intentionally produces relative `/chat` URLs for local proxying.
- `VITE_API_PROXY_TARGET` should point to the local or remote backend during `npm run dev`.
- `useChat` creates a client conversation ID before the first backend response.
- The backend may return a different `conversationId`; the UI persists the returned ID.
- The backend may return RAG `sources`; the current UI accepts the field but does not render it.
- Tour listing, recommendation, selection, availability, pricing, discounts, and reservations happen inside the backend chat flow and are summarized in `data.response`.
- Successful backend reservations also return `meta.isReservationMessage: true` and `meta.reservation`; the UI stores that metadata on the assistant message for display.
- `ChatMessages` uses `src/utils/reservationConfirmation.js` to normalize reservation metadata or detect older confirmed reservation summaries and render `ReservationConfirmationCard` without adding backend tool logic to the browser.
- The UI does not currently call `POST /recommend`, even though the backend exposes it for structured recommendation use cases.
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

## When Extending
1. Add or update API adapter behavior in `src/api/`.
2. Keep async UI orchestration in hooks under `src/hooks/`.
3. Keep presentational chat pieces in `src/components/`.
4. Keep reusable visual decisions in tokens and shared CSS patterns.
5. Update [docs/api.md](./docs/api.md) when backend request or response usage changes.
6. Update [docs/memory.md](./docs/memory.md) when local conversation state changes.
7. Update [docs/prompting.md](./docs/prompting.md) when input handling, output rendering, or chat copy changes.
8. Add focused React Testing Library tests for user-visible behavior.
