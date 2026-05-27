# Architecture

Back to [Project Context](../CONTEXT.md).

## Shape
This is a single-service React/Vite frontend.

```text
src/
  main.jsx              React entrypoint and StrictMode mount
  App.jsx               page shell and chat composition
  api/                  backend HTTP adapters and response validation
  components/           presentational chat UI components and tests
  hooks/                reusable stateful behavior and side effects
  index.css             global CSS tokens, layout, responsive behavior

server.js               optional static dist server with /health
vite.config.js          Vite dev server, React plugin, proxy, preview hosts
railway.json            Nixpacks build and Railway start command
```

## Layer Rules
- Components render UI and receive behavior through props.
- Hooks own state transitions, browser storage, async orchestration, and effects.
- API adapters own request URLs, `fetch`, response envelope parsing, and contract validation.
- App composition connects hooks to components and renders page-level alerts.
- CSS owns visual tokens, layout primitives, message bubble variants, loading animation, and responsive behavior.
- Deployment files should not contain product logic.

## Render And Request Lifecycle
```text
Browser loads index.html
  -> src/main.jsx mounts <App />
  -> useChat initializes conversation state
  -> App renders header and either CustomerContextForm or the chat surface
  -> CustomerContextForm captures name, email, and itinerary dates before chat starts
  -> ChatInput emits trimmed message
  -> useChat appends user message and an in-progress assistant message
  -> chatApi sends POST /chat
  -> backend may run RAG and tour/reservation tools
  -> chatApi parses SSE events
  -> useChat buffers chunks and reveals them into the active assistant message
  -> useChat finalizes assistant message or shows fallback error
  -> birdMatches metadata can render a carousel and resolve relative media through mediaApi
  -> ChatMessages scrolls to latest content
```

## Main Flows
Chat submission uses:
1. `ChatInput` for textarea state, autosizing, keyboard behavior, and submit button state
2. `useChat.sendMessage(...)` for optimistic user messages and loading state
3. `streamChatMessage(...)` from `src/api/chatApi.js` for backend communication
4. SSE `start`, `chunk`, optional `replace`, `done`, or `error` events
5. a buffered reveal timer in `useChat` so chunks appear at a readable pace
6. `useChat.stopGenerating(...)` with `AbortController` to cancel active streams
7. local persistence of the returned conversation ID and finalized rendered messages
8. `ChatMessages` for role-specific rendering, streaming cursor, stopped messages, and loading indicator display

Backend chat side effects are intentionally outside the UI layer. The backend may
retrieve bird knowledge sources, execute tour tools, calculate discounts, create
reservations, persist chat memory, and return a natural-language assistant
summary. The current UI treats that summary as text, renders guided controls from
documented `uiAction` metadata, renders bird profile media from
`done.meta.birdMatches`, and can additionally render a reservation confirmation
card from `done.meta.reservation` when present. It does not render raw tool,
tour, discount, reservation, or source payloads.

Conversation hydration uses:
1. `birdwatchingAI.chatState` from `localStorage`
2. the stored `conversationId`, `customerContext`, and optional cached transcript
3. `loadConversationMessages(...)` when a conversation ID exists but no local transcript is cached
4. backend response data containing `conversationId` and `messages`
5. replacement of local state with backend-loaded messages

Development proxying uses:
1. empty `VITE_API_URL` in local `.env`
2. relative calls from `src/api/authApi.js`, `src/api/chatApi.js`, and `src/api/mediaApi.js`
3. Vite proxy rules for `/auth`, `/chat`, and `/files`
4. `VITE_API_PROXY_TARGET` as the backend origin

Production API calls use:
1. `VITE_API_URL` baked into the Vite build
2. browser requests directly to the public backend origin
3. backend `CORS_ORIGINS` configuration that must allow the deployed frontend origin

## State Model
The UI state is intentionally small:
- `conversationId`: active backend/client conversation identifier
- `customerContext`: customer name, email, and itinerary dates collected before chat
- `messages`: rendered user and assistant transcript entries
- `isLoading`: whether a chat request or stream is in flight
- `isStreaming`: whether an assistant response can currently be stopped
- `error`: request or hydration error text for the alert

## Cross-Cutting Concerns
- Accessibility is handled at component boundaries through labels, semantic sections, and keyboard support.
- Error handling is split between user-friendly inline assistant fallback text and a page-level alert.
- Dark mode and responsive behavior use CSS custom properties and media queries.
- Network contract drift should be caught in `src/api/chatApi.js`, not in presentational components.
- Relative bird media paths from RAG metadata should be resolved in `src/api/mediaApi.js` and consumed through hooks, keeping media endpoint details out of presentational markup.
- Backend tool and reservation capabilities should be represented through documented API adapters before they are displayed as structured UI. The reservation confirmation card uses documented `/chat` metadata, with assistant-text parsing only as a fallback for older messages.
- Routing is not active. If routes are added, preserve SPA fallback support in production serving.
