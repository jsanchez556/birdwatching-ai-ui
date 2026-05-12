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
  "response": "I found 2 tours that match your preferences.",
  "sources": [
    {
      "name": "Resplendent Quetzal",
      "location": "Monteverde, San Gerardo de Dota",
      "similarityScore": 0.9123
    }
  ]
}
```

Expected tour success meta may include frontend-ready tool data:
```json
{
  "toolsCalled": ["recommendTours"],
  "tours": [
    {
      "tourId": 1,
      "name": "Monteverde Quetzal Tour",
      "location": "Monteverde",
      "pricePerPerson": 120,
      "availableSlots": 5,
      "durationHours": 4,
      "difficulty": "moderate"
    }
  ]
}
```

Expected reservation success meta:
```json
{
  "toolsCalled": ["selectTour", "createReservation"],
  "selectedTour": {
    "tourId": 1,
    "name": "Monteverde Quetzal Tour",
    "location": "Monteverde",
    "pricePerPerson": 120,
    "availableSlots": 3,
    "durationHours": 4,
    "difficulty": "moderate"
  },
  "selectedTourId": 1,
  "reservation": {
    "id": 42,
    "reservationId": 42,
    "confirmation_code": "BW-ABC123",
    "confirmationCode": "BW-ABC123",
    "customer_name": "Ana Rivera",
    "customerName": "Ana Rivera",
    "customerEmail": "ana@example.com",
    "conversationId": "conversation-123",
    "tour_id": 1,
    "tourId": 1,
    "tourName": "Monteverde Quetzal Tour",
    "participants": 2,
    "created_at": "2026-05-11T10:30:00.000Z",
    "createdAt": "2026-05-11T10:30:00.000Z",
    "total_price": 240,
    "totalPrice": 240,
    "currency": "USD",
    "remainingSlots": 3,
    "discountRate": 0,
    "discountReason": null
  }
}
```

Frontend behavior:
- sends the active `conversationId` from `useChat`
- requires a successful envelope with `data`
- requires `data.response` to be a string
- persists `data.conversationId` when present
- preserves `meta.reservation` on the assistant message when present
- accepts but currently ignores optional `sources` because no source UI exists yet
- accepts but currently ignores optional `meta.tours`, `meta.selectedTour`, and `meta.selectedTourId` because no tour-card UI exists yet

Backend behavior relevant to UI:
- creates a UUID conversation ID when none is provided
- loads recent conversation history from PostgreSQL
- may retrieve RAG sources from `src/db/data/birds.json`
- may use OpenAI tool calls for tour listing, recommendation, selection, availability checks, pricing, discounts, and reservations
- when tour listing or recommendation tools return tours, `data.response` should stay short, for example `I found 2 tours that match your preferences.`, while tour details are provided in `meta.tours`
- saves the exchange to PostgreSQL on a best-effort basis

Tour and reservation notes:
- Tool execution is backend-only; the public `/chat` response does not expose raw tool messages.
- Safe structured tool data may be returned in the top-level `meta` envelope for frontend rendering.
- Available backend tools are `getAvailableTours`, `recommendTours`, `selectTour`, `checkTourAvailability`, `calculateTourPrice`, and `createReservation`.
- Tour listing and recommendation details are returned in `meta.tours` when available.
- Tour selection can use a `tourId` or clear/partial `tourName`; the backend resolves matching names before validating availability.
- Reservation creation requires `tourId`, `participants`, and `customerName`; it may include `customerEmail` and `discountCode`.
- Pricing can apply recognized discount codes such as `EARLYBIRD`, `STUDENT`, and `LOCAL`, or group discounts.
- Successful reservation details are summarized in `data.response` and exposed in `meta.reservation` when a reservation is created.
- The current UI renders reservation cards from `meta.reservation` first and normalizes both camelCase and snake_case reservation fields. It only parses clear reservation-confirmation summaries from `data.response` as a fallback for older cached or hydrated messages.
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
- Malformed success envelopes throw `Unexpected chat response format` or `Unexpected conversation response format`.
- Missing or non-string chat response text throws `Unexpected chat response`.
- Missing conversation message arrays throw `Unexpected conversation response`.

## Integration Notes
- Do not invent backend fields in UI code. If the UI needs sources, discounts, additional reservation details, or tour metadata, first confirm the backend contract and update this file.
- Keep backend CORS allowlists aligned with deployed frontend origins.
- Do not expose backend secrets through `VITE_` variables.
