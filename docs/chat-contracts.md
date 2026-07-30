# Frontend Chat Contracts

Back to [Project Context](../CONTEXT.md). This document is the authoritative
frontend contract for rendered chat state. Backend wire envelopes remain
documented in [API Integration](./api.md).

## Naming and ownership

The application uses one name for each concept:

- `metadata` is optional, message-level display data owned by the backend
  response that produced that rendered message.
- `conversationContext` is conversation-level flow and booking context shared
  across turns.
- `customerContext` is frontend-collected customer and itinerary intake.
- `messageMetadata` is the normalized assistant-response field returned by an
  API adapter before `useChat` creates a rendered message.

`meta` is reserved for the backend envelope and is never passed into hooks,
pages, or components. `recentAssistantMetadata` is a backend request field
created only by chat API adapters. `conversationMeta` and stored top-level
`metadata` are legacy persistence aliases accepted only while hydrating old
cache entries.

## Rendered message

```json
{
  "role": "assistant",
  "content": "Your reservation is confirmed.",
  "metadata": {
    "reservation": {
      "confirmationCode": "BW-1042"
    },
    "uiActions": []
  },
  "audioUrl": "https://cdn.example.com/voice-chat/response.mp3",
  "audioResponseUrl": "/files/voice-chat/response.mp3"
}
```

`role` and string `content` are required. `role` is `user` or `assistant`.
`metadata`, `audioUrl`, `audioResponseUrl`, `transcript`, `createdAt`, and
transient rendering flags are optional. `metadata` may contain only data
actually returned for that turn, including optional reservation, tour, pricing,
discount, source, tool, UI-action, or bird-match information. Missing fields
are never fabricated. Voice playback uses the canonical top-level `audioUrl`;
API and storage boundaries lift the legacy `metadata.audioUrl` form during
normalization.

Recommendation turns may include `metadata.tourRecommendation`:

```json
{
  "summary": "I found one supported match.",
  "recommendations": [{
    "tourId": "1",
    "tourName": "Monteverde Quetzal Tour",
    "location": "Monteverde",
    "estimatedPrice": { "amount": 120, "currency": "USD" },
    "matchReasons": ["Matches Monteverde"],
    "availabilityStatus": "available",
    "confidence": 0.94
  }],
  "sources": [],
  "assumptions": [],
  "followUpQuestion": null
}
```

Availability is `available`, `limited`, `unavailable`, or `unknown`. Unknown
price uses `{ "amount": null, "currency": null }`; known currency values are
uppercase ISO 4217 codes. Confidence is in `0–1`, recommendations may be empty,
and `followUpQuestion` is null when no clarification is needed. The API adapter
validates the entire optional object and drops it if any field is invalid, so
components never render partial cards. Assistant `content` remains visible and
is never parsed to create recommendation fields.

## Conversation state

```json
{
  "conversationId": "conversation-123",
  "messages": [],
  "conversationContext": {
    "selectedTourId": 16,
    "participants": 2,
    "selectedTransportation": {
      "id": 3,
      "name": "Private transfer"
    }
  },
  "customerContext": {
    "customerName": "Ana Rivera",
    "customerEmail": "ana@example.com",
    "itineraryStartDate": "2026-06-01",
    "itineraryEndDate": "2026-06-03"
  }
}
```

`conversationId` is a string or `null`; `messages` is always an array;
`conversationContext` is always an object; and `customerContext` is an object
or `null`. `useChat` owns this state. Conversation context may contain
conversation source/type, reservation entry, confirmed reservation, selected
tour/transportation, and participant count. Customer context is kept separate
even when legacy storage embedded it in `meta`.

## Normalized assistant response

Chat and voice adapters return:

```json
{
  "conversationId": "conversation-123",
  "response": "I found two options.",
  "messageMetadata": {
    "uiActions": []
  },
  "conversationContext": {
    "selectedTourId": 16
  },
  "customerContext": null,
  "sources": []
}
```

`messageMetadata`, `conversationContext`, and `sources` use empty values when
the backend supplies no optional data. The adapters partition backend envelope
or stream `meta` before application code receives it. Hydration adapters also
normalize legacy message `meta` to `metadata`.

For requests, hooks provide canonical `conversationContext` plus the most
recent `assistantMetadata`. The API adapters serialize those into the current
backend-compatible `conversationContext.recentAssistantMetadata` wire shape.

## Persisted conversation

New writes use version 2:

```json
{
  "version": 2,
  "conversationId": "conversation-123",
  "customerContext": null,
  "conversationContext": {},
  "messages": [],
  "savedAt": "2026-07-29T18:00:00.000Z"
}
```

The persistence utility owns serialization and hydration. During hydration it
accepts the previous `meta`, top-level `metadata`, or `conversationMeta`
containers, embedded `customerContext`, and message-level `meta`. It returns
only the canonical shape and rewrites active legacy conversations as version 2.
Invalid JSON, invalid container types, invalid message roles/content, or
non-object metadata cause the whole cached conversation to be discarded and
the normal empty/API hydration path to continue.
