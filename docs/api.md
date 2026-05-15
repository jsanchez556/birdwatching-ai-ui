# API Integration

Back to [Project Context](../CONTEXT.md). See [Architecture](./architecture.md) for UI flow details.

The frontend integrates with the Birdwatching AI API through `src/api/chatApi.js`. Backend API implementation lives in the backend repository and is read-only from this project.

The active UI currently calls only:
- `POST /chat`
- `GET /chat/:conversationId`

The backend also exposes `GET /health` and `POST /recommend`, but this frontend does not call those backend endpoints yet.

Non-streaming successful backend responses, such as conversation hydration, are expected to use:

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

Errors are expected to use:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid chat payload",
    "details": []
  }
}
```

## API Base URL
`src/api/chatApi.js` reads:
```text
import.meta.env.VITE_API_URL
```

Behavior:
- trailing slashes are removed
- empty value means requests are relative to the current origin
- local relative `/chat` calls are proxied by Vite to `VITE_API_PROXY_TARGET`
- production should set `VITE_API_URL` to the public backend URL

## `POST /chat`
Used by `streamChatMessage({ message, conversationId, signal, onStart, onChunk, onReplace })`.

The request body matches `POST /chat`:
```json
{
  "message": "Where can I see quetzals?",
  "conversationId": "optional-existing-id"
}
```

Expected Server-Sent Events:
```text
event: start
data: {"conversationId":"conversation-123","sources":[],"meta":{"promptVersions":{"chat":"2.1.0"}}}

event: chunk
data: {"content":"Hello"}

event: replace
data: {"content":"I can help with Costa Rica birdwatching, tours, pricing, or reservations. Could you rephrase what you would like to do next?"}

event: done
data: {"conversationId":"conversation-123","response":"Hello from AI","sources":[],"meta":{"promptVersions":{"chat":"2.1.0"}}}

event: error
data: {"code":"STREAM_ERROR","message":"Unable to stream chat response right now."}
```

Frontend behavior:
- sends the active `conversationId` from `useChat`
- passes an `AbortSignal` so stop-generation can cancel the active request
- appends an in-progress assistant message before the stream completes
- persists the `conversationId` from `start` or `done` when present
- appends each `chunk.content` to the active assistant message
- replaces the active assistant message on `replace`
- finalizes the assistant message from `done.response`
- preserves `done.meta.reservation` on the assistant message when present
- treats `AbortError` as user cancellation instead of a request failure
- throws a client error if the stream ends without a `done` event
- shows the backend/client error in the alert and a friendly assistant fallback in the transcript on failure

Backend behavior relevant to UI:
- creates a UUID conversation ID when none is provided
- loads recent conversation history from PostgreSQL
- may retrieve RAG sources from `src/db/data/birds.json`
- may use OpenAI tool calls for tour listing, recommendation, selection, availability checks, pricing, discounts, and reservations
- when tour listing or recommendation tools return tours, the assistant response should stay short, for example `I found 2 tours that match your preferences.`, while tour details are provided in `meta.tours`
- saves the exchange to PostgreSQL on a best-effort basis

Tour and reservation notes:
- Tool execution is backend-only; the public `/chat` stream does not expose raw tool messages.
- Safe structured tool data may be returned in the `done.meta` object for frontend rendering.
- Available backend tools are `getAvailableTours`, `recommendTours`, `selectTour`, `checkTourAvailability`, `calculateTourPrice`, and `createReservation`.
- Tour listing and recommendation details are returned in `meta.tours` when available.
- Tour selection can use a `tourId` or clear/partial `tourName`; the backend resolves matching names before validating availability.
- Reservation creation requires `tourId`, `participants`, and `customerName`; it may include `customerEmail` and `discountCode`.
- Pricing can apply recognized discount codes such as `EARLYBIRD`, `STUDENT`, and `LOCAL`, or group discounts.
- Successful reservation details are summarized in the final streamed response and exposed in `done.meta.reservation` when a reservation is created.
- The current UI renders reservation cards from message reservation metadata first and normalizes both camelCase and snake_case reservation fields. It only parses clear reservation-confirmation summaries from assistant text as a fallback for older cached or hydrated messages.
- If the UI later adds structured tour, source, discount, or reservation displays beyond the confirmation card, use the documented `meta` fields instead of inferring data from assistant text.

## `GET /chat/:conversationId`
Used by `loadConversationMessages(conversationId)`.

Expected success data:
```json
{
  "conversationId": "conversation-123",
  "messages": [
    { "role": "user", "content": "I am visiting Monteverde.", "createdAt": "..." },
    { "role": "assistant", "content": "Monteverde is excellent...", "createdAt": "..." }
  ]
}
```

Frontend behavior:
- URL-encodes the conversation ID
- requires a successful envelope with `data`
- requires `data.messages` to be an array
- stores returned messages in the local cache
- renders message `role` and `content`; `createdAt` is accepted but not displayed

## `GET /health`
Provided by `server.js` for the frontend static server:
```json
{
  "status": "ok"
}
```

Backend `GET /health` returns a normalized envelope with service health and process uptime. The current UI does not call either health endpoint in browser code.

## `POST /recommend`
Backend endpoint for structured birdwatching recommendations. The current UI does not call it.

Request body:
```json
{
  "location": "Monteverde",
  "budget": "moderate",
  "days": 3
}
```

Backend validation:
- `location` is required, trimmed, and non-empty
- `budget` must be `budget`, `moderate`, or `luxury`
- `days` must be an integer from 1 to 30

If a recommendation UI is added, keep the adapter separate from `chatApi.js` or rename the API module so chat and recommendation contracts stay clear.

## Common Client Errors
- Non-OK responses throw the backend `error.message` when available.
- Malformed stream events throw `Unexpected stream chunk`, `Unexpected stream replacement`, or `Unexpected stream completion`.
- Streams without a final `done` event throw `Stream ended before completion`.
- Malformed conversation hydration envelopes throw `Unexpected conversation response format`.
- Missing conversation message arrays throw `Unexpected conversation response`.

## Integration Notes
- Do not invent backend fields in UI code. If the UI needs sources, discounts, additional reservation details, or tour metadata, first confirm the backend contract and update this file.
- Keep backend CORS allowlists aligned with deployed frontend origins.
- Do not expose backend secrets through `VITE_` variables.
