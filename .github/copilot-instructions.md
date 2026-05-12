# Copilot Instructions

Use this file as repository-specific guidance for GitHub Copilot. For fuller context, read [CONTEXT.md](../CONTEXT.md), [AGENTS.md](../AGENTS.md), and the focused docs in [docs/](../docs/).

## Coding Conventions
- Use React 18 function components and hooks.
- Use ESM syntax with explicit imports and exports.
- Use `camelCase` for functions and variables.
- Use `PascalCase` for React components.
- Keep public data payloads explicit and predictable.
- Keep comments practical; explain intent, not obvious syntax.

## Architecture Rules
- This is a single React/Vite UI rooted at `src/`; do not assume an `apps/` monorepo layout.
- App composition lives in `src/App.jsx`.
- Presentational components live in `src/components/`.
- Stateful behavior and browser side effects live in `src/hooks/`.
- Backend HTTP adapters live in `src/api/`.
- Global CSS tokens, layout, and responsive behavior live in `src/index.css`.
- Vite dev proxy and preview host configuration live in `vite.config.js`.
- Static deployment support lives in `railway.json` and `server.js`.

## Preferred Patterns
- Keep components prop-driven and accessible.
- Use `useChat` or focused hooks for conversation orchestration.
- Use `src/api/chatApi.js` for chat backend calls.
- Validate backend response shapes before returning data to UI state.
- Guard `localStorage` reads and writes with `try/catch`.
- Preserve relative `/chat` requests in local development when `VITE_API_URL` is empty.
- Treat backend tour, discount, reservation, and RAG behavior as backend-owned unless a confirmed API contract exposes structured UI fields.
- Prefer documented `meta.reservation` for reservation confirmation cards; keep text extraction display-only and conservative as a fallback.
- Test user-visible behavior with React Testing Library.

## Forbidden Patterns
- Do not call OpenAI from browser code.
- Do not add backend database, RAG, reservation, or tool-calling logic to this repository.
- Do not put backend secrets, OpenAI API keys, database URLs, tokens, or passwords in frontend code or `VITE_` variables.
- Do not call `fetch` directly from presentational components.
- Do not invent backend response fields for sources, tours, discounts, or reservations; update docs and contracts when new fields are confirmed.
- Do not introduce React Router, state libraries, UI kits, or styling frameworks without a clear project-level reason.
- Do not duplicate architecture documentation across markdown files; link to the source of truth instead.

## AI-First Development Principles
- Optimize changes for future AI agents: keep boundaries obvious, names descriptive, and files focused.
- Treat UI copy, API contracts, and local state behavior as first-class documented behavior.
- Update [docs/api.md](../docs/api.md) when backend integration changes.
- Update [docs/memory.md](../docs/memory.md) when conversation continuity changes.
- Update [docs/prompting.md](../docs/prompting.md) when input handling, output rendering, or chat copy changes.
- Prefer small, testable changes over broad rewrites.

## Response Style Expectations
- Be concise and implementation-focused.
- Lead with the concrete change or finding.
- Reference exact files when explaining behavior.
- Mention tests run and any residual risk.
- Avoid generic advice that is not grounded in this repository.
