# Birdwatching AI UI

React 18 + Vite frontend for the Birdwatching AI chat experience. The app collects booking-ready customer context, provides a responsive Costa Rica birdwatching assistant UI, and integrates with the Birdwatching AI API for streamed chat responses and conversation retrieval.

## Quick Links
- Project context for AI agents: [CONTEXT.md](./CONTEXT.md)
- Agent coding rules: [AGENTS.md](./AGENTS.md)
- Frontend architecture: [docs/architecture.md](./docs/architecture.md)
- Backend API integration: [docs/api.md](./docs/api.md)
- UI prompting and copy: [docs/prompting.md](./docs/prompting.md)
- Conversation state: [docs/memory.md](./docs/memory.md)
- Deployment: [docs/deployment.md](./docs/deployment.md)
- Frontend implementation rules: [docs/frontend-guidelines.md](./docs/frontend-guidelines.md)

## Stack
- React 18 with ESM
- Vite 5 and `@vitejs/plugin-react`
- CSS custom properties with utility-minded component classes
- Jest 30 with React Testing Library and jsdom
- Railway deployment through Nixpacks

## Local Setup
```bash
npm install
npm run dev
```

Create a local `.env` file with public frontend variables only:
```bash
VITE_API_URL=
VITE_API_PROXY_TARGET=http://localhost:3000
```

Leaving `VITE_API_URL` empty in local development makes the browser call relative `/chat` URLs, which Vite proxies to `VITE_API_PROXY_TARGET`. This avoids local CORS issues while developing against the backend.

All browser-exposed variables must use the `VITE_` prefix. Do not put backend secrets, OpenAI API keys, database URLs, or private tokens in frontend environment variables.

## Runtime Integration
The UI calls the backend chat API through `src/api/chatApi.js`.

Runtime endpoints used by the browser:
- `POST /chat`
- `GET /chat/:conversationId`

Backend endpoints documented for future UI expansion:
- `POST /recommend`

The deployed static server also exposes:
- `GET /health`

The backend remains the source of truth for OpenAI, RAG, tour tools, discounts, reservations, and PostgreSQL persistence. This frontend stores only UI conversation state, customer context entered by the user, and a local transcript cache in `localStorage`. When the backend returns guided action metadata, the UI renders choice/select buttons that send natural-language follow-up messages. When the backend returns reservation metadata for a confirmed booking, the UI renders a styled reservation confirmation card and keeps the assistant message visible.

## Scripts
```bash
npm run dev     # Vite dev server on port 5173
npm run build   # production Vite build to dist
npm run preview # local preview server on 0.0.0.0
npm run start   # Railway start command
npm test        # Jest + React Testing Library
```

## Railway Deployment
Railway builds the Vite app and starts a static preview server.

Build command:
```bash
npm run build
```

Start command:
```bash
npm run start
```

Required Railway variable:
```bash
VITE_API_URL=https://your-api-service.up.railway.app
```

Replace the value with the public URL of the backend that serves the `/chat` API. The backend must include the deployed frontend origin in its `CORS_ORIGINS` allowlist. For custom domains or extra preview hosts, set:
```bash
ALLOWED_HOSTS=example.com,www.example.com
```

## Current UI Shape
The app currently renders one product surface: a customer context form followed by the chat screen. It does not use React Router. If routing is added later, preserve the existing chat route as the primary product surface and keep SPA fallback behavior in deployment.
