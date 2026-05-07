# Memory

Back to [Project Context](../CONTEXT.md). See [API Integration](./api.md) for conversation retrieval contracts.

## Current Memory Model
The frontend uses browser-local conversation continuity. It is not durable AI memory and is not a source of truth for backend conversation history.

The backend owns durable conversation memory in PostgreSQL. The frontend stores:
- the active conversation ID
- a cached copy of rendered messages for that conversation

The same backend `conversationId` can also be associated with tour reservations created during chat. The frontend treats it as the chat continuity key and does not manage reservation persistence.

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
2. `sendChatMessage(...)` posts to the backend with the active conversation ID.
3. `useChat` persists the returned conversation ID.
4. `useChat` appends the assistant response.
5. `useChat` stores the rendered transcript for that conversation ID.

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
- append an assistant message with a generic friendly fallback
- preserve the user's submitted message in the transcript

## Future Memory Extensions
If adding richer UI memory:
- keep backend persistence as the durable transcript source
- version local cache entries before changing stored shapes
- include a way to clear or switch conversations
- avoid storing sensitive personal data beyond what the user already sees in the chat transcript
- do not treat reservation data as browser-local memory; fetch or display it only through confirmed backend contracts
- update [API Integration](./api.md) if new backend memory endpoints are used
- add tests for reload, hydration, and storage-unavailable behavior
