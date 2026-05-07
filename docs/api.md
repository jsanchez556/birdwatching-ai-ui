# API Integration

Back to [Project Context](../CONTEXT.md). See [Architecture](./architecture.md) for UI flow details.

The frontend integrates with the Birdwatching AI API through `src/api/chatApi.js`. Backend API implementation lives in the backend repository and is read-only from this project.

The active UI currently calls only:
- `POST /chat`
- `GET /chat/:conversationId`

The backend also exposes `GET /health` and `POST /recommend`, but this frontend does not call those backend endpoints yet.

All successful backend responses are expected to use:

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
Used by `sendChatMessage({ message, conversationId })`.

Request body:
```json
{
  "message": "Where can I see quetzals?",
  "conversationId": "optional-existing-id"
}
```

Expected success data:
```json
{
  "conversationId": "uuid-or-provided-id",
  "response": "AI response text",
  "sources": [
    {
      "name": "Resplendent Quetzal",
      "location": "Monteverde, San Gerardo de Dota",
      "similarityScore": 0.9123
    }
  ]
}
```

Frontend behavior:
- sends the active `conversationId` from `useChat`
- requires a successful envelope with `data`
- requires `data.response` to be a string
- persists `data.conversationId` when present
- accepts but currently ignores optional `sources` because no source UI exists yet

Backend behavior relevant to UI:
- creates a UUID conversation ID when none is provided
- loads recent conversation history from PostgreSQL
- may retrieve RAG sources from `src/db/data/birds.json`
- may use OpenAI tool calls for tour listing, recommendation, selection, availability checks, pricing, discounts, and reservations
- saves the exchange to PostgreSQL on a best-effort basis

Tour and reservation notes:
- Tool execution is backend-only; the public `/chat` response does not expose raw tool results.
- Available backend tools are `getAvailableTours`, `recommendTours`, `selectTour`, `checkTourAvailability`, `calculateTourPrice`, and `createReservation`.
- Reservation creation requires `tourId`, `participants`, and `customerName`; it may include `customerEmail` and `discountCode`.
- Pricing can apply recognized discount codes such as `EARLYBIRD`, `STUDENT`, and `LOCAL`, or group discounts.
- Successful reservation details are expected to be summarized in `data.response`, including confirmation code and total price when a reservation is created.
- If the UI later adds structured tour, source, discount, or reservation displays, confirm the backend response shape first instead of inferring it from assistant text.

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
- Malformed success envelopes throw `Unexpected chat response format` or `Unexpected conversation response format`.
- Missing or non-string chat response text throws `Unexpected chat response`.
- Missing conversation message arrays throw `Unexpected conversation response`.

## Integration Notes
- Do not invent backend fields in UI code. If the UI needs sources, discounts, reservation details, or tour metadata, first confirm the backend contract and update this file.
- Keep backend CORS allowlists aligned with deployed frontend origins.
- Do not expose backend secrets through `VITE_` variables.
