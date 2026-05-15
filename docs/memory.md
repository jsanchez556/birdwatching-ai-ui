# Memory

Back to [Project Context](../CONTEXT.md). See [API Integration](./api.md) for conversation retrieval contracts.

## Current Memory Model
The frontend uses browser-local conversation continuity. It is not durable AI memory and is not a source of truth for backend conversation history.

The backend owns durable conversation memory in PostgreSQL. The frontend stores:
- the active conversation ID
- a cached copy of rendered messages for that conversation

The same backend `conversationId` can also be associated with tour reservations created during chat. The frontend treats it as the chat continuity key and does not manage reservation persistence. A rendered reservation confirmation card is derived from backend response metadata or fallback assistant message parsing, and may be cached with the transcript as display state, not as authoritative booking state.

## Storage
Conversation ID key:
```text
birdwatchingAI.conversationId
```

Message cache key prefix:
```text
birdwatchingAI.messages.
```

Full message cache key:
```text
birdwatchingAI.messages.{conversationId}
```

Cached message shape:
```json
[
  { "role": "user", "content": "Where can I see toucans?" },
  { "role": "assistant", "content": "Try the Caribbean lowlands..." }
]
```

The UI may also receive `createdAt` from the backend during hydration, but it does not currently display timestamps.

## Write Behavior
When a user sends a message:
1. `useChat` appends the user message immediately.
2. `useChat` appends an in-progress assistant message for streamed content.
3. `streamChatMessage(...)` posts to the backend with the active conversation ID.
4. `useChat` persists the conversation ID returned by the stream.
5. `useChat` buffers chunks and reveals them into the assistant message at a readable pace.
6. `useChat` finalizes the assistant response from the `done` event.
7. `useChat` stores the finalized rendered transcript for that conversation ID.

If localStorage writes fail, the app continues without persistent local cache.

## Read Behavior
On initialization:
1. `useChat` reads the stored conversation ID.
2. If found, it tries to read cached messages for that ID.
3. If cached messages exist, it renders them immediately.
4. If no cache exists, it calls `GET /chat/:conversationId`.
5. Loaded backend messages replace local state and are cached.

If no stored conversation ID exists, the UI creates one with `crypto.randomUUID()` when available, falling back to a timestamp/random string.

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
