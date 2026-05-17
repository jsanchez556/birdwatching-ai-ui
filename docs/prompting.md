# Prompting

Back to [Project Context](../CONTEXT.md). See [API Integration](./api.md) for backend chat contracts.

## Runtime Prompt Assets
This frontend does not contain OpenAI system prompts, tool schemas, RAG instructions, or model-selection logic. Runtime AI prompts live in the backend.

Frontend prompt-adjacent assets are UI text and user input affordances:
- app title and subtitle in `src/App.jsx`
- customer context form labels and helper text in `src/components/CustomerContextForm.jsx`
- textarea placeholder in `src/components/ChatInput.jsx`
- empty chat state copy in `src/components/ChatMessages.jsx`
- user-facing request fallback in `src/hooks/useChat.js`

## User Input Flow
`CustomerContextForm` first collects booking context: customer name, customer email, itinerary start date, and itinerary end date. `ChatInput` then collects natural-language birdwatching questions.

Submit behavior:
1. trim the input
2. ignore empty submissions
3. ignore submissions while loading
4. send on form submit or `Enter`
5. allow multiline text with `Shift+Enter`
6. clear and reset the textarea after successful handoff to `useChat`

The frontend should not rewrite, summarize, classify, or pre-prompt typed user messages before sending them to the backend unless a future product requirement explicitly adds that behavior. Guided action controls intentionally translate backend-provided option values into short natural-language follow-up messages, such as `Confirm reservation` or `I choose tour 1: Monteverde Quetzal Tour`.

## Assistant Output Flow
Assistant text streams from backend SSE `chunk` events, is revealed through a small frontend buffer so it reads like typing, and is finalized from the `done.response` field. The UI renders normal responses as plain text with `white-space: pre-wrap`.

Current behavior:
- no markdown rendering
- no linkification
- no source panel
- no raw tool result display
- no client-side prompt injection
- reservation confirmation summaries can render an additional styled card

The backend may use RAG and tour tools before streaming the final assistant response. Tour discovery, tour selection, availability checks, transportation estimates, pricing, discounts, participant-count interpretation, and reservation creation are backend responsibilities. The current UI displays the final assistant text, renders structured `uiAction` and `uiActions` controls, and renders `ReservationConfirmationCard` from reservation metadata when present.

Reservation normalization and fallback extraction live in `src/utils/reservationConfirmation.js`. Prefer backend metadata over text parsing. The parser should stay conservative for older cached or hydrated messages and should not imply that the browser executed or verified a reservation. The backend remains the source of truth.

If rich rendering is added, treat backend output as untrusted content and sanitize appropriately.

## Copy Rules
- Keep copy Costa Rica birdwatching-specific unless the product scope changes.
- Keep UI copy short and useful inside the chat surface.
- Avoid exposing backend internals such as model names, token usage, SQL state, tool call payloads, or provider errors to end users.
- Keep error fallbacks friendly while preserving detailed errors in developer-visible logs or tests when appropriate.

## Change Rules
- Do not place backend prompt text in this frontend repository.
- Do not add OpenAI API calls to the browser.
- Do not add backend tour, reservation, RAG, or database logic to the browser.
- Keep reservation card display logic presentational; do not use it as durable booking state.
- Update backend prompt docs in the backend repository when backend prompt behavior changes.
- Update this file when frontend input handling, output rendering, or chat copy changes.
- Add tests for keyboard behavior and accessible labels when changing `ChatInput`.

## Prompt History
`docs/development_prompts/` contains project-history notes for AI-assisted frontend documentation and implementation work. Treat those files as history, not runtime prompt assets.
