# Memory

Back to [Project Context](../CONTEXT.md). See [API Integration](./api.md) for conversation retrieval contracts.

## Current Memory Model
The frontend uses browser-local conversation continuity. It is not durable AI memory and is not a source of truth for backend conversation history.

The backend owns durable conversation memory in PostgreSQL. The frontend stores:
- the current auth token and safe user profile
- the active conversation ID
- customer context entered by the user for the booking flow
- a cached copy of rendered messages for that conversation

The same backend `conversationId` can also be associated with tour reservations created during chat. The frontend treats it as the chat continuity key and does not manage reservation persistence. A rendered reservation confirmation card is derived from backend response metadata or fallback assistant message parsing, and may be cached with the transcript as display state, not as authoritative booking state.

The backend enforces authenticated ownership for conversations and reservations. Browser-local conversation IDs are continuity hints only; they are not an authorization mechanism.

## Storage
Unauthenticated chat state key:
```text
birdwatchingAI.chatState
```

Authenticated chat state key:
```text
birdwatchingAI.chatState.<userId>
```

Auth state key:
```text
birdwatchingAI.authState
```

Auth state shape:
```json
{
  "token": "jwt",
  "user": {
    "id": "user-1",
    "email": "ana@example.com",
    "name": "Ana Rivera"
  }
}
```

The auth state stores only the JWT returned by the backend and safe profile fields. It never stores plaintext passwords, password hashes, API keys, database URLs, or backend secrets.

When the user is authenticated, `CustomerContextForm` pre-fills the user name when available and locks `customerEmail` to `auth.user.email`. Itinerary dates still come from the user-entered customer context.

Cached state shape:
```json
{
  "conversationId": "conversation-123",
  "messages": [
    { "role": "user", "content": "Where can I see toucans?" },
    { "role": "assistant", "content": "Try the Caribbean lowlands..." }
  ],
  "meta": {
    "customerContext": {
      "customerName": "Ana Rivera",
      "customerEmail": "ana@example.com",
      "itineraryStartDate": "2026-06-01",
      "itineraryEndDate": "2026-06-03"
    },
    "selectedTourId": 1,
    "participants": 2,
    "savedAt": "2026-05-17T00:00:00.000Z"
  }
}
```

`meta.customerContext`, `meta.reservation`, `meta.selectedTour`,
`meta.selectedTourId`, `meta.selectedTransportation`, and `meta.participants`
are chat-level state.
They are cached once per conversation instead of repeated on assistant message
metadata. Assistant messages still keep turn-specific display metadata such as
`uiAction`, `tours`, and `pricing`.

The UI may also receive `createdAt` from the backend during hydration, but it does not currently display timestamps.

## Write Behavior
When a user sends a message:
1. `useChat` appends the user message immediately.
2. `useChat` appends an in-progress assistant message for streamed content.
3. `streamChatMessage(...)` posts to the backend with the bearer token, active conversation ID, stored customer context, and recent assistant metadata merged with chat-level booking state.
4. `useChat` persists the conversation ID returned by the stream.
5. `useChat` buffers chunks and reveals them into the assistant message at a readable pace.
6. `useChat` finalizes the assistant response from the `done` event.
7. `useChat` stores the finalized rendered transcript for that conversation ID.

If localStorage writes fail, the app continues without persistent local cache.

## Read Behavior
On initialization:
1. `useAuth` reads `birdwatchingAI.authState`.
2. If auth state exists, the app shows the authenticated chat shell.
3. `useChat` reads `birdwatchingAI.chatState.<userId>` for authenticated users, or `birdwatchingAI.chatState` for unauthenticated use.
4. If a scoped conversation ID is found, it restores `meta.customerContext`, chat-level metadata, and cached messages.
5. If cached messages are missing, it calls `GET /chat/:conversationId` with the bearer token.
6. If no scoped authenticated chat state exists, it calls `GET /chat/latest` before creating a client conversation ID.
7. If the backend returns a latest conversation, it renders and caches that conversation under the scoped key.
8. If the backend returns no conversation, it creates and caches a new client conversation ID.

If no stored conversation ID exists for an unauthenticated user, the UI creates one with `crypto.randomUUID()` when available, falling back to a timestamp/random string.

## Error Behavior
Conversation hydration failures set the page-level `error` alert.

Chat send failures:
- set the page-level `error` alert
- replace the in-progress assistant message with a generic friendly fallback
- preserve the user's submitted message in the transcript

User-stopped streams:
- abort the active `POST /chat` request with `AbortController`
- keep the visible partial assistant response in the transcript
- mark the assistant message as stopped and remove the streaming state
- do not show the generic error fallback
- do not save the stopped partial response as a completed local cache entry until a later completed exchange persists the visible transcript

## Future Memory Extensions
If adding richer UI memory:
- keep backend persistence as the durable transcript source
- version local cache entries before changing stored shapes
- include a way to clear or switch conversations
- avoid storing sensitive personal data beyond what the user already sees in the chat transcript
- do not treat reservation card data as browser-local source of truth; fetch or display additional reservation state only through confirmed backend contracts
- update [API Integration](./api.md) if new backend memory endpoints are used
- add tests for reload, hydration, and storage-unavailable behavior
