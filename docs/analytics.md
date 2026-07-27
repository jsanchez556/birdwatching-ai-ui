# Product Analytics

Back to [Project Context](../CONTEXT.md).

The browser uses the provider-neutral module under `src/analytics/`. PostHog is
initialized only when `VITE_POSTHOG_ENABLED=true`, a project key is configured,
and the user has granted the analytics cookie category. Autocapture, page-view
capture, page-leave capture, and session recording are disabled.

Authenticated users are identified by the stable backend user ID. A visitor
keeps PostHog's anonymous identity until signup or login calls `identify`, which
connects the anonymous activity to the authenticated person. Logout resets the
browser identity. Revoking analytics consent resets the identity and opts out
of capture.

## Browser-Owned Events

| Event | Trigger | Properties |
|---|---|---|
| `chat_started` | A homepage, login-modal, featured-tour, or cart action opens chat | `environment`, `service`, `plan`, `source`, `userType` |

Backend events such as `chat_message_sent`, `tour_recommended`,
`reservation_completed`, and `subscription_activated` are documented in the
API repository. The browser does not infer business outcomes from assistant
text, redirects, or checkout return URLs.

## Booking Funnel

In PostHog, create an ordered unique-user funnel:

```text
chat_started
  -> tour_recommended
  -> reservation_started
  -> reservation_completed
```

Filter every step to the same `environment` being evaluated. Use `plan` and
`source` for cohort breakdowns. The `featured_tour` and `tour_cart`
chat entry sources begin with a preselected tour and can legitimately skip
`tour_recommended`; keep those direct-booking entries separate when measuring
the tour-discovery funnel.

## Privacy

The analytics boundary accepts primitive allowlisted-style metadata and removes
properties whose keys indicate chat content, PII, credentials, or provider
identifiers. Never add customer names, email addresses, messages, prompts,
responses, tokens, reservation notes, or billing-provider object IDs.

Automated tests inject a fake provider and never send events to PostHog.
