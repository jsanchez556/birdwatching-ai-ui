# Frontend Privacy and Local Retention

Back to [Project Context](../CONTEXT.md).

The backend repository's `docs/privacy-retention.md` is the portfolio-wide
inventory for chat, profiles, images, voice, reservations, traces, logs,
analytics, operational events, third parties, backups, deletion, and export.
This page records the browser-specific part of that behavior.

- Auth state stores access/refresh tokens, expiry timestamps, and the safe user
  profile in `localStorage`. Chat state stores the conversation ID, rendered
  messages, and customer itinerary context under a user-scoped key.
- Profile image file previews and microphone recordings are held in memory
  while the relevant UI is active. The browser uploads them through API
  adapters and does not store raw files in `localStorage`.
- Bird-identification job IDs and admin dashboard responses are session memory
  only. The admin dashboard must not persist operational data.
- PostHog initializes only when explicitly enabled and after the existing
  consent flow permits analytics. Provider-side retention is not controlled by
  this repository.
- Browser data has no automatic age-based cleanup. Users can clear site data
  through browser controls; logout is not presented as a guaranteed deletion
  of all cached chat keys. There is no comprehensive frontend export or account
  deletion flow today.
- Frontend build variables are public. Secrets, database URLs, provider secret
  keys, and private tokens must never be placed in `VITE_` variables.

Recommended follow-up work is to connect a future authenticated backend
export/deletion workflow, explicitly clear every user-scoped browser cache
after confirmed account deletion, and expose the deployed privacy notice and
retention periods in the account UI.
