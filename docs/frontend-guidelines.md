# Frontend Guidelines

Back to [Project Context](../CONTEXT.md). Pair this with [API Integration](./api.md) before changing backend calls.

## Implementation Style
- Use explicit ESM imports and exports.
- Keep React components small and prop-driven.
- Use hooks for browser APIs, state transitions, and side effects.
- Keep API calls in `src/api/`; components should not know URL construction details.
- Keep comments practical and sparse; explain intent or edge cases.
- Prefer repository-local patterns before adding dependencies.

## Components
- Keep chat bubbles, lists, input controls, and future panels as composable pieces.
- Use clear role naming for `user` and `assistant`.
- Keep presentational components tolerant of empty arrays and loading states.
- Keep icon-only controls accessible through `aria-label`.
- Avoid coupling components directly to `localStorage` or backend `fetch`.

## State
- Keep `useChat` responsible for conversation orchestration until state complexity justifies splitting hooks.
- Use functional `setState` when deriving next messages from previous messages.
- Guard browser storage calls with `try/catch`.
- Store only non-sensitive UI state.
- Prefer backend hydration over treating local cache as authoritative.

## API
- Normalize request URL behavior in one place.
- Validate backend response shapes before returning data to hooks.
- Throw ordinary `Error` instances with user-meaningful messages.
- Keep optional backend fields optional in the UI.
- Keep browser HTTP calls in `src/api/`; components and hooks should consume adapter functions rather than constructing backend URLs directly.
- Keep billing provider-neutral in the frontend. Use backend-returned `paymentUrl` and `managementUrl` values and do not name generic UI state after Stripe objects.
- Treat backend `sources`, tour recommendations, discount details, and reservation details as explicit UI features that require confirmed contracts before rendering.
- Prefer `meta.reservation` for reservation confirmation cards.
- Keep fallback reservation confirmation parsing conservative: require clear confirmation language plus a confirmation code, and preserve the original assistant message beside the card.
- Add tests around API adapters if response handling becomes more complex.

## Styling
- Use semantic CSS custom properties for color, borders, shadows, radius, and content width.
- Keep light and dark mode behavior paired.
- Preserve mobile-first layout behavior.
- Ensure message content wraps with long words and multiline text.
- Keep interactive target sizes comfortable on touch screens.

## Accessibility
- Prefer semantic elements: `main`, `header`, `section`, `article`, `form`, `button`, `textarea`.
- Preserve the send button accessible name.
- Preserve a status or live region for chat updates where appropriate.
- Keep `Enter` and `Shift+Enter` behavior tested if changed.
- Avoid color-only communication for errors or state.

## Environment
- Use only public frontend variables with the `VITE_` prefix in browser code.
- Keep local development proxy target in `VITE_API_PROXY_TARGET`.
- Keep production backend origin in `VITE_API_URL`.
- Keep backend-only variables such as `OPENAI_API_KEY`, `DATABASE_URL`, `OPENAI_MODEL`, and `CORS_ORIGINS` out of the frontend service.
- Do not commit `.env` files or secret-bearing examples.

## Testing
- Use React Testing Library for component behavior.
- Prefer assertions that match user behavior over implementation details.
- Keep tests close to components when they are component-specific.
- Mock `fetch`, `localStorage`, and browser APIs when testing hooks or API adapters.
