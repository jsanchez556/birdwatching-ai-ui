# Agent Guidance

Repository-specific instructions for Codex, Copilot, Cursor, Claude Code, ChatGPT, and other AI coding assistants.

Start with [CONTEXT.md](./CONTEXT.md), then use the focused docs under `docs/`.

## Purpose
This frontend delivers the chat experience, responsive UI, local conversation continuity, and reusable component patterns for the Birdwatching AI product.

## Stack
- React 18 with ESM
- Vite 5
- CSS custom properties and utility-minded class structure
- Jest, jsdom, and React Testing Library
- Railway/Nixpacks deployment

## Architecture Rules
- If two instructions conflict, follow the highest-priority rule in the current section.

Must:
- Keep `src/App.jsx` as composition glue for the current single-screen app.
- Keep presentational UI in `src/components/`.
- Keep reusable behavior and side effects in `src/hooks/`.
- Keep backend HTTP calls in `src/api/`; do not call `fetch` directly from components.

Should:
- Keep environment-dependent URL behavior behind the API layer or Vite config.
- Keep styling tokens and responsive behavior in `src/index.css` until a component styling system is introduced.

Do not:
- Do not put backend OpenAI, RAG, database, or reservation logic in this repository.

## Chat UI Patterns
- Display clear speaker roles: user vs assistant.
- Use stable message objects with at least `role` and `content`.
- Preserve loading and error states in the chat flow.
- Keep typing/loading indicators accessible with ARIA labels.
- Preserve scroll-to-latest behavior for ongoing conversation.
- Keep the customer context form as frontend-only intake for name, email, and itinerary dates; validate it before submission, require a non-empty name, a valid email format, and a valid itinerary date range; if validation fails, show field-level errors and do not send the request; send the result through the API layer rather than re-collecting it in chat UI components.
- Treat backend `sources`, tool details, tour data, discount details, or reservation metadata as optional display data; do not invent fields that the UI does not receive.
- The backend may summarize tour listing, selection, pricing, discount, and reservation tool results in assistant text without exposing raw tool data in the public `/chat` response.
- Reservation confirmation cards should prefer `meta.reservation`, fall back conservatively to assistant text for older messages, and keep the original assistant message visible.

## State And Persistence
- Use hooks for stateful orchestration.
- Keep `localStorage` access guarded with `try/catch`.
- Persist only non-sensitive UI state such as conversation IDs, customer context entered by the user, and rendered messages.
- Let the backend remain the source of truth for durable conversation memory, RAG, tours, reservations, and AI responses.
- Do not store API keys, database URLs, private tokens, or backend secrets in frontend code or `VITE_` variables.

## Responsive Design
- Design mobile-first and scale to desktop.
- Use safe spacing and accessible touch targets.
- Support dark mode with semantic color tokens.
- Ensure text wraps cleanly inside message bubbles and controls.
- Avoid layout shifts when loading or appending messages.

## Accessibility
- Use ARIA labels for icon-only buttons and status indicators.
- Keep keyboard interaction for message input and send actions.
- Preserve `Enter` to send and `Shift+Enter` for multiline input unless product requirements change.
- Keep color contrast high in light and dark modes.
- Use semantic landmarks where practical.

## API Integration
- Use the normalized backend response envelope: `{ success, data, meta }`.
- If the response is missing `success`, `data`, or `meta`, treat it as an error and render `Something went wrong. Please try again.` instead of assuming the shape.
- If `success` is false or `data`/`meta` is missing, treat the response as invalid, show a friendly error message, and do not render partial UI state.
- If the request fails because the network is unavailable, the request times out, or the server returns 5xx, show a retryable error message and do not crash the chat UI.
- If `success` is false, render `meta.message || 'Something went wrong. Please try again.'`; never display raw stack traces, tokens, database errors, or backend secrets.
- Validate response shapes at the API adapter boundary.
- Do not add any browser HTTP request beyond `POST /chat` and `GET /chat/:conversationId` unless the task explicitly names a new endpoint and the API adapter is updated in `src/api/`.
- Keep `VITE_API_URL` public and non-sensitive.
- In local development, prefer relative `/chat` requests through the Vite proxy.

## Testing Expectations
- Test user-visible behavior with React Testing Library.
- Prefer accessible queries such as `getByRole`, `getByLabelText`, and visible text.
- Mock network boundaries when adding hook or API integration tests.
- Run `npm test` before handing off behavior changes.

## Recommended Files For Changes
- App composition: `src/App.jsx`
- Components: `src/components/*`
- Hooks: `src/hooks/*`
- API adapters: `src/api/*`
- Styles and design tokens: `src/index.css`
- Vite/dev proxy config: `vite.config.js`
- Static serving/deployment support: `server.js`, `railway.json`
- Documentation: `CONTEXT.md`, `README.md`, `docs/*`, `.github/copilot-instructions.md`
