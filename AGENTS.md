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
- Keep `src/App.jsx` as composition glue for the current single-screen app.
- Keep presentational UI in `src/components/`.
- Keep reusable behavior and side effects in `src/hooks/`.
- Keep backend HTTP calls in `src/api/`; do not call `fetch` directly from components.
- Keep environment-dependent URL behavior behind the API layer or Vite config.
- Keep styling tokens and responsive behavior in `src/index.css` until a component styling system is introduced.
- Do not put backend OpenAI, RAG, database, or reservation logic in this repository.

## Chat UI Patterns
- Display clear speaker roles: user vs assistant.
- Use stable message objects with at least `role` and `content`.
- Preserve loading and error states in the chat flow.
- Keep typing/loading indicators accessible with ARIA labels.
- Preserve scroll-to-latest behavior for ongoing conversation.
- Treat backend `sources`, tool details, tour data, discount details, or reservation metadata as optional future display data; do not invent fields that the UI does not receive.
- The backend may summarize tour listing, selection, pricing, discount, and reservation tool results in assistant text without exposing raw tool data in the public `/chat` response.

## State And Persistence
- Use hooks for stateful orchestration.
- Keep `localStorage` access guarded with `try/catch`.
- Persist only non-sensitive UI state such as conversation IDs and rendered messages.
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
- Surface backend error messages when safe and available, with a friendly fallback.
- Validate response shapes at the API adapter boundary.
- Keep `POST /chat` and `GET /chat/:conversationId` as the only active browser calls until the UI intentionally adds recommendation or reservation-specific surfaces.
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
