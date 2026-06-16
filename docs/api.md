# API Integration

Back to [Project Context](../CONTEXT.md). See [Architecture](./architecture.md) for UI flow details.

The frontend integrates with the Birdwatching AI API through `src/api/authApi.js`, `src/api/cartApi.js`, `src/api/chatApi.js`, `src/api/voiceChatApi.js`, `src/api/birdIdentificationApi.js`, `src/api/homeApi.js`, and `src/api/mediaApi.js`. Backend API implementation lives in the backend repository.

The active UI currently calls:
- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /cart`
- `POST /cart/items`
- `PATCH /cart/items/:itemId`
- `DELETE /cart/items/:itemId`
- `GET /cart/reservations`
- `POST /cart/reservations`
- `POST /chat`
- `POST /voice-chat`
- `POST /birds/identify`
- `GET /jobs/:id`
- `GET /chat/latest`
- `GET /chat/:conversationId`
- `GET /homepage/hero`
- `GET /tours`
- `GET /birds/highlights`
- `GET /birds/profile`
- `GET /addons/transportation`
- `GET /files/:folderName/:filename`

The backend also exposes `GET /health`, but this frontend does not call that backend endpoint in browser code.

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
The API adapters read:
```text
import.meta.env.VITE_API_URL
```

Behavior:
- trailing slashes are removed
- empty value means requests are relative to the current origin
- local relative `/auth`, `/cart`, `/chat`, `/voice-chat`, `/homepage`, `/tours`, `/birds`, `/jobs`, `/addons`, and `/files` calls are proxied by Vite to `VITE_API_PROXY_TARGET`
- production should set `VITE_API_URL` to the public backend URL

## Auth
`src/api/authApi.js` handles email/password authentication.

`POST /auth/signup` sends:
```json
{
  "email": "ana@example.com",
  "password": "secure-password",
  "name": "Ana Rivera"
}
```

`POST /auth/login` sends:
```json
{
  "email": "ana@example.com",
  "password": "secure-password"
}
```

Both endpoints are expected to return:
```json
{
  "success": true,
  "data": {
    "token": "jwt",
    "accessTokenExpiresAt": "2026-06-01T12:00:00.000Z",
    "refreshToken": "opaque-refresh-token",
    "refreshTokenExpiresAt": "2026-07-01T12:00:00.000Z",
    "user": {
      "id": "user-1",
      "email": "ana@example.com",
      "name": "Ana Rivera",
      "role": "customer"
    }
  },
  "meta": {}
}
```

Frontend behavior:
- validates the response shape at the adapter boundary
- stores only the access token, refresh token, expiry timestamps, and safe user profile in `birdwatchingAI.authState`
- never stores passwords
- sends the token as `Authorization: Bearer <token>` on authenticated chat requests
- refreshes expiring access tokens through `POST /auth/refresh`
- clears local auth state and returns to login when refresh fails
- stores a safe visitor marker when the user enters visitor mode without credentials
- clears auth storage on logout
- uses the safe auth user profile to prefill customer context

## `POST /birds/identify`
Used by `identifyBirdByUrl({ imageUrl, token })` and `identifyBirdByFile({ file, token })` in `src/api/birdIdentificationApi.js`.

Authenticated users can open the Identify Bird modal from the homepage header. Visitors and logged-out users do not see the action.

URL request:
```json
{
  "imageUrl": "https://example.com/bird.jpg"
}
```

Raw photo upload request:
```http
POST /birds/identify
Authorization: Bearer jwt
Content-Type: image/jpeg
X-Filename: bird.jpg

<raw image bytes>
```

The frontend accepts JPEG, PNG, WebP, and GIF uploads up to 10 MB for this endpoint. Unsupported iPhone HEIC/HEIF files, empty files, and oversized files are rejected in the bird identification hook before the raw upload request is sent. When Safari omits image MIME metadata, the upload adapter infers the backend `Content-Type` from supported file extensions.

Expected queued data:
```json
{
  "jobId": "abc123",
  "status": "queued"
}
```

The frontend treats queued bird identification responses as background jobs and polls:

```http
GET /jobs/:id
Authorization: Bearer jwt
```

Queued or active job data:
```json
{
  "jobId": "abc123",
  "status": "active"
}
```

Completed job data:
```json
{
  "jobId": "abc123",
  "status": "completed",
  "result": {
    "status": "uncertain",
    "bestMatch": {
      "commonName": "Resplendent Quetzal"
    }
  }
}
```

Failed job data:
```json
{
  "jobId": "abc123",
  "status": "failed",
  "error": {
    "message": "Bird identification failed. Please try again."
  }
}
```

Completed `result` data follows the existing bird identification shape:
```json
{
  "status": "uncertain",
  "bestMatch": {
    "commonName": "Resplendent Quetzal",
    "scientificName": "Pharomachrus mocinno",
    "confidence": 0.64,
    "reasoning": "Some diagnostic traits are visible, but the tail is cropped.",
    "visualEvidence": ["green upperparts", "red underparts"],
    "ragSupport": ["Field marks support green upperparts and red underparts."],
    "contradictions": ["Long tail coverts are not visible."],
    "missingEvidence": ["tail coverts"]
  },
  "summary": "The image evidence points most strongly to Resplendent Quetzal.",
  "imageAnalysis": {
    "dominantColors": ["green", "red"],
    "fieldMarks": ["red underparts"],
    "bill": {
      "color": "yellow",
      "shape": "short",
      "length": "short"
    },
    "imageQuality": "clear but cropped",
    "confidence": 0.82
  },
  "imageObservations": {
    "colors": ["green", "red"],
    "beak": "yellow",
    "confidence": 0.82
  },
  "candidates": [
    {
      "commonName": "Resplendent Quetzal",
      "scientificName": "Pharomachrus mocinno",
      "confidence": 0.91,
      "reasoning": "Green and red plumage fits a male quetzal.",
      "visualEvidence": ["green plumage", "red belly"],
      "ragSupport": ["Retrieved profile describes green plumage."],
      "contradictions": [],
      "missingEvidence": ["tail coverts not fully visible"],
      "media": {
        "photoUrl": "photos/quetzal.jpg"
      }
    }
  ],
  "notes": ["Identification remains uncertain because the tail is cropped."]
}
```

Frontend behavior:
- validates the normalized response envelope at the adapter boundary
- stores background job IDs only in modal hook state
- polls `GET /jobs/:id` for queued, active, or processing responses
- renders completed job results under the same bird identification result UI
- renders safe user-facing messages for failed or missing jobs
- preserves optional `status`, `bestMatch`, `imageAnalysis`, `imageObservations`, `candidates`, `notes`, and `meta` fields defensively
- sends bearer auth through `getValidToken`
- supports pasted HTTP(S) image URLs
- sends chosen upload or mobile camera photo as raw image bytes
- uses rich `imageAnalysis.confidence` for the submitted-image clarity overlay and falls back to compatibility `imageObservations.confidence`
- renders `identified`, `uncertain`, and `unknown` states with matching user-facing context
- renders the submitted image inside the best-match comparison without persisting image bytes or URLs beyond modal state
- overlays best-match reference media on the submitted image when a usable candidate image is available
- renders candidate visual evidence, supporting details, contradictions, and missing evidence when present
- renders optional candidate media defensively as inline square candidate images
- does not persist uploaded image data in browser storage

`POST /auth/refresh` sends:
```json
{
  "refreshToken": "opaque-refresh-token"
}
```

It returns the same shape as login/signup and rotates the refresh token.

`POST /auth/logout` sends the current refresh token when available so the backend can revoke it.

## Cart And My Tours
`src/api/cartApi.js` owns all browser calls for authenticated cart and reservation-history features. Every cart request sends `Authorization: Bearer <token>` and expects the normalized `{ success, data, meta }` envelope.

Cart endpoints:
- `GET /cart` returns `data.cart` with `items` and `count`. If legacy backend responses include `itineraryStartDate` or `itineraryEndDate`, the frontend ignores those values in favor of the cookie-backed itinerary.
- `POST /cart/items` sends `tourId`, optional `scheduledDate`, optional `participants`, optional `needsTransportation`, and optional frontend-safe `metadata`.
- `PATCH /cart/items/:itemId` updates `scheduledDate`, `participants`, or `needsTransportation`.
- `DELETE /cart/items/:itemId` removes one cart item.
- `POST /cart/reservations` creates reservations from all cart items, or from a single item when `itemIds` contains one id.
- `GET /cart/reservations` returns `data.reservations`, limited to the latest five user reservations for My Tours.

Cart itinerary dates are frontend-only preferences stored in the `birdwatchingAI.cartItinerary` browser cookie:
```json
{
  "itineraryStartDate": "2026-06-01",
  "itineraryEndDate": "2026-06-03"
}
```

The cookie must not contain customer name, customer email, tour selections, reservations, tokens, or other sensitive data. The backend should not persist cart itinerary preferences or depend on a `tour_cart_settings` table.

The backend allows cart items without scheduled dates so users can add tours before setting an itinerary. Reservation creation still requires each selected cart item to have a scheduled date. The backend enforces ownership and one tour per itinerary day. The frontend may pre-validate duplicate dates for a better user experience, but it must treat backend validation as authoritative.

## `POST /chat`
Used by `streamChatMessage({ message, conversationId, customerContext, conversationContext, role, token, signal, onStart, onChunk, onReplace })`.

Authenticated requests include:
```http
Authorization: Bearer <token>
```

Visitor requests omit `Authorization` and send `"role": "visitor"`. The backend limits visitors to bird-only questions and blocks booking/tour actions.

The request body matches `POST /chat`:
```json
{
  "message": "Where can I see quetzals?",
  "conversationId": "optional-existing-id",
  "customerContext": {
    "customerName": "Ana Rivera",
    "customerEmail": "ana@example.com",
    "itineraryStartDate": "2026-06-01",
    "itineraryEndDate": "2026-06-03"
  },
  "conversationContext": {
    "recentAssistantMetadata": {
      "selectedTourId": 1,
      "participants": 2,
      "uiAction": { "type": "reservation_confirmation" }
    }
  },
  "role": "customer"
}
```

Expected Server-Sent Events:
```text
event: start
data: {"conversationId":"conversation-123","sources":[],"meta":{"promptVersions":{"chat":"2.3.0"}}}

event: chunk
data: {"content":"Hello"}

event: replace
data: {"content":"I can help with Costa Rica birdwatching, tours, pricing, or reservations. Could you rephrase what you would like to do next?"}

event: done
data: {"conversationId":"conversation-123","response":"Hello from AI","sources":[],"meta":{"promptVersions":{"chat":"2.3.0"}}}

event: error
data: {"code":"STREAM_ERROR","message":"Unable to stream chat response right now."}
```

Frontend behavior:
- sends the active `conversationId` from `useChat`
- sends the collected `customerContext` so the backend can reuse name, email, and itinerary dates during booking
- when authenticated, sends `auth.user.email` as the customer email and does not let the user edit it in the customer context form
- sends sanitized `conversationContext.recentAssistantMetadata` from the most recent assistant message plus chat-level booking state so guided actions can continue across turns
- homepage `Reserve tour` and cart `Reserve cart` entry points send `conversationType: "reservation_entry"`, `conversationSource`/`entrySource`, and safe `reservationEntry` tour/cart summaries in `conversationContext.recentAssistantMetadata`
- passes an `AbortSignal` so stop-generation can cancel the active request
- appends an in-progress assistant message before the stream completes
- persists the `conversationId` from `start` or `done` when present
- appends each `chunk.content` to the active assistant message
- replaces the active assistant message on `replace`
- finalizes the assistant message from `done.response`
- stores chat-level `done.meta` fields such as `customerContext`, `reservation`, `selectedTour`, `selectedTourId`, `selectedTransportation`, and `participants` in `conversationMeta` instead of duplicating them on assistant messages
- reservation-entry drawer chats are ephemeral in the browser: they can receive backend conversation IDs, but they do not write or restore `localStorage` chat state and do not call `GET /chat/latest` on open
- preserves per-turn `done.meta.birdMatches` on the assistant message so bird photos, song recordings, sonograms, and licensing links can render beside the answer
- treats `AbortError` as user cancellation instead of a request failure
- throws a client error if the stream ends without a `done` event
- shows the backend/client error in the alert and a friendly assistant fallback in the transcript on failure

Backend behavior relevant to UI:
- creates a UUID conversation ID when none is provided
- associates authenticated conversations and reservations with the logged-in user and rejects cross-user conversation access
- treats authenticated identity as authoritative over frontend-provided customer email
- loads recent conversation history from PostgreSQL
- may retrieve RAG sources from PostgreSQL pgvector knowledge chunks ingested from backend `src/db/ingestion/data`
- may use OpenAI tool calls for tour search/recommendation, availability checks, transportation estimates, pricing, discounts, and reservations
- when tour listing or recommendation tools return tours, the assistant response should stay short, for example `I found 2 tours that match your preferences.`, while tour details are provided in `meta.tours`
- tour records in chat metadata may include `location`, `node`, `subnode`, and `zone`; `location` is a display label derived from the node graph, while `node`, `subnode`, and `zone` are the structured location fields
- when bird RAG returns media-rich bird profiles, details are provided in `meta.birdMatches`; media URLs are optional references and are not embedded in pgvector
- saves the exchange to PostgreSQL on a best-effort basis
- saves reservation-entry chat exchanges with backend `conversation_type = "reservation_entry"` so normal latest-chat hydration can skip them

## `POST /voice-chat`
Used by `sendVoiceChat({ audioBlob, conversationId, customerContext, conversationContext, role, token, signal })` in `src/api/voiceChatApi.js`.

The frontend records microphone audio with `MediaRecorder`, then `useChat` converts the browser recording to `audio/wav` before upload. Browser-native `audio/webm` is not sent directly because the backend raw audio middleware currently accepts only MP3/WAV content types.

Request:
```http
POST /voice-chat
Content-Type: audio/wav
X-Filename: voice-message.wav
X-Conversation-Id: conversation-123
X-Customer-Context: {"customerName":"Ana Rivera","customerEmail":"ana@example.com"}
X-Conversation-Context: {"recentAssistantMetadata":{"selectedTourId":1}}
X-Response-Mode: field_assistant
X-Role: customer
Authorization: Bearer <token>
```

Notes:
- `Authorization`, `X-Conversation-Id`, `X-Customer-Context`, `X-Conversation-Context`, and `X-Role` are included only when available.
- `X-Response-Mode: field_assistant` is sent for voice turns so the backend applies the concise field-guide prompt.
- `X-Customer-Context` and `X-Conversation-Context` are JSON-encoded headers, not request-body fields.
- The request body is raw audio bytes, not JSON or multipart form data.

Expected success envelope:
```json
{
  "success": true,
  "data": {
    "transcript": "Where can I see quetzals?",
    "answer": "Scan fruiting trees along the Monteverde cloud forest edges and listen for soft calls.",
    "audioResponseUrl": "/files/voice-chat/audio-id.mp3"
  },
  "meta": {
    "conversationId": "conversation-123"
  }
}
```

Frontend behavior:
- sets recording, processing, uploading, and loading states through `useChat`
- handles microphone permission, unsupported recording, empty recording, and backend/network errors with safe user-facing messages
- appends `data.transcript` as a user message with `transcript`
- appends `data.answer` as an assistant message
- resolves `data.audioResponseUrl` through `src/api/mediaApi.js` and stores the resolved `audioUrl` for playback
- stores the original relative `audioResponseUrl` with the assistant message for continuity/debuggability
- preserves the same local conversation ID, customer context, and recent assistant metadata behavior used by text chat

Backend behavior relevant to UI:
- standalone browser calls to transcribe or speak endpoints are not part of the public frontend contract
- speech-to-text, chat orchestration, retrieval, agent execution, text-to-speech, and S3 MP3 storage are backend-owned
- returned `/files/voice-chat/...` paths are relative media references; components must not hardcode backend origins

Bird media notes:
- `meta.birdMatches` is a per-turn assistant metadata field, not chat-level booking state.
- Each match may include `speciesCode`, `commonName`, `scientificName`, `family`, `description`, `locations`, `lastObservation`, and optional media fields copied from backend `birds.json`: `media.photoUrl`, `media.squarePhotoUrl`, `media.photoAttribution`, `media.wikiTitle`, `media.songUrl`, `media.sonogramUrl`, `media.songLength`, and `media.songAttributionHtml`.
- The UI renders only the media fields present for each bird and keeps the original assistant text visible.
- Bird carousel thumbnails prefer `media.squarePhotoUrl` and fall back to `media.photoUrl`; the bird detail modal uses `media.photoUrl` for the larger image.
- The bird detail modal uses `media.songLength` as the preferred duration for synchronizing the audio playhead with the sonogram, falling back to browser audio metadata when that field is absent.
- The bird detail modal displays `photoAttribution` near the photo and converts `songAttributionHtml` to plain text near the audio controls. It does not inject attribution HTML into the DOM.
- Media URL fields may be absolute URLs or relative object keys returned by ingestion, commonly `/photos/...`, `songs/...`, or `sonograms/...`.
- Relative media values must be resolved through `src/api/mediaApi.js` before rendering. Components should not place relative RAG media values directly into `src` attributes.
- When `VITE_CLOUDFRONT_BASE_URL` is configured, `src/api/mediaApi.js` builds public CDN URLs directly from normalized relative keys. When it is empty, the adapter falls back to `GET /files/:folderName/:filename`.

## `GET /files/:folderName/:filename`
Used by `resolveMediaUrl(value)` in `src/api/mediaApi.js` when bird RAG media contains a relative object key instead of an absolute URL and `VITE_CLOUDFRONT_BASE_URL` is not configured.

Expected success envelope:
```json
{
  "success": true,
  "data": {
    "url": "https://cdn.example.test/photos/123_medium.jpg"
  },
  "meta": {
    "delivery": "cloudfront"
  }
}
```

Frontend behavior:
- absolute `http`, `https`, protocol-relative, `data:`, and `blob:` media values are returned unchanged
- leading slashes and an optional `/files/` prefix are normalized before the backend request
- duplicate slashes are collapsed and unsafe traversal segments are rejected
- path segments are URL-encoded before requesting `/files/...` or building a CloudFront URL
- successful relative-path resolutions are cached in memory for the current page session
- failed media resolutions degrade to the existing photo/sonogram unavailable UI rather than failing the chat message

Tour and reservation notes:
- Tool execution is backend-only; the public `/chat` stream does not expose raw tool messages.
- Safe structured tool data may be returned in the `done.meta` object for frontend rendering.
- Available backend tools are `searchTours`, `calculateTransportation`, `checkAvailability`, `calculatePricing`, and `createReservation`.
- Tour listing and recommendation details are returned in `meta.tours` when available.
- Tour listing, selection, and reservation metadata can include `location`, `node`, `subnode`, and `zone`. The frontend treats these as display metadata and does not infer booking logic from them.
- Tour selection can use a `tourId` or clear/partial `tourName`; the backend resolves matching names before validating availability.
- The backend may return `meta.uiAction` or `meta.uiActions` for guided controls. Supported UI action types include `choice`, `tour_selection`, `date_picker`, `participant_count`, `transportation_selection`, and `reservation_confirmation`.
- The backend may return `meta.uiAction.type === "participant_count"` with `min`, `max`, and numeric `options`; the UI renders this as a select control and sends the selected number back as the next chat message.
- After participant count is selected, the backend may include `meta.participants`; the UI preserves it in chat-level `conversationMeta` so later backend turns can reuse it.
- The backend may return a choice action asking whether transportation is needed. The existing choice renderer sends `Show transportation` for `show_transportation` and `No, I have my own transportation` for `decline_transportation`; the backend owns the resulting booking logic.
- Transportation option buttons send a natural-language selection such as `I choose shared shuttle from San Jose to Monteverde`; the backend owns option persistence and pricing context.
- The final confirmation choice sends `Confirm reservation`, but users may also type `Yes`; the backend interprets that only when the prior metadata included the final confirmation action.
- Reservation creation requires participants and customer name in backend tool arguments; customer name, email, and itinerary dates should usually come from `customerContext` collected before chat.
- Homepage and cart reservation entry points provide selected tour details through chat metadata so users do not need to describe the tour again; the backend remains responsible for availability, pricing, missing itinerary details, and reservation creation.
- Pricing can apply recognized discount codes such as `EARLYBIRD`, `STUDENT`, and `LOCAL`, or group discounts.
- Successful reservation text should stay short and the confirmation details are exposed in `done.meta.reservation` when a reservation is created.
- Reservation metadata may include `tourLocation`/`tour_location`, `tourNode`/`tour_node`, `tourSubnode`/`tour_subnode`, and `tourZone`/`tour_zone`; the confirmation card displays those fields when present.
- The current UI renders reservation cards from chat-level reservation metadata for confirmation-style assistant messages, uses chat-level `selectedTransportation` for transportation display and grand-total calculation, falls back to message reservation metadata for older cached messages, and normalizes both camelCase and snake_case reservation fields. It only parses clear reservation-confirmation summaries from assistant text as a final fallback.
- If the UI later adds structured tour, source, discount, or reservation displays beyond the confirmation card, use the documented `meta` fields instead of inferring data from assistant text.

## `GET /chat/:conversationId`
Used by `loadConversationMessages(conversationId, { token })`.

Requires:
```http
Authorization: Bearer <token>
```

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

## `GET /chat/latest`
Used by `loadLatestConversation({ token })` during authenticated hydration when no user-scoped local chat cache exists.

Expected success data when a conversation exists:
```json
{
  "conversationId": "conversation-123",
  "messages": [
    { "role": "user", "content": "Hello", "createdAt": "..." },
    { "role": "assistant", "content": "Hi!", "createdAt": "..." }
  ]
}
```

Expected success data when no owned conversation exists:
```json
{
  "conversationId": null,
  "messages": []
}
```

Frontend behavior:
- sends `Authorization: Bearer <token>`
- calls this before generating a new conversation ID when authenticated local chat cache is missing
- persists returned data under `birdwatchingAI.chatState.<userId>`
- expects the backend to return only regular chat conversations; reservation-entry conversations are intentionally excluded from latest hydration
- generates and persists a new client conversation ID only when the backend returns no conversation

## `GET /health`
Provided by `server.js` for the frontend static server:
```json
{
  "status": "ok"
}
```

Backend `GET /health` returns a normalized envelope with service health and process uptime. The current UI does not call either health endpoint in browser code.

## Homepage Content
The homepage uses public, non-streaming endpoints for static or configured marketing content. Each response uses the standard `{ success, data, meta }` envelope.

`GET /homepage/hero` returns hero media content:
```json
{
  "success": true,
  "data": {
    "hero": {
      "heroVideo": "https://www.youtube-nocookie.com/embed/example"
    }
  },
  "meta": {}
}
```

`GET /tours` returns featured tour cards:
```json
{
  "success": true,
  "data": {
    "tours": [
      {
        "id": 1,
        "title": "Monteverde Quetzal Tour",
        "description": "A misty cloud forest walk...",
        "location": "Monteverde",
        "node": "Monteverde",
        "subnode": "Curi-Cancha Reserve",
        "zone": "Northern Mountains",
        "duration": "4 hours",
        "pricePerPerson": 120,
        "difficulty": "moderate",
        "imageUrl": "https://example.test/tour.jpg"
      }
    ]
  },
  "meta": {}
}
```

`GET /birds/highlights` returns curated species cards. The backend can source names from `HOMEPAGE_BIRD_HIGHLIGHTS`, falling back to built-in Costa Rica highlights.

`GET /birds/profile` returns a single bird profile for modal/details rendering. The UI sends either `speciesCode` or `name` as query parameters:
```http
GET /birds/profile?speciesCode=gretin1
```

The adapter requires `data.bird` to be an object and treats `404` as a normal missing-profile error.

`GET /addons/transportation` returns simple transportation add-on cards for the homepage. Booking-specific transportation selection remains owned by the chat flow.

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
