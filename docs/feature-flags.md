# Feature flags

PostHog feature flags control product availability without a frontend redeploy.
Components consume `src/featureFlags/featureFlag.service.js` through
`src/hooks/useFeatureFlag.js`; they do not call PostHog directly.

## Flag catalog

| Key | Type | Safe fallback | Frontend behavior |
|---|---|---|---|
| `voice_ai` | Boolean | Enabled | Shows or hides voice recording |
| `advanced_rag` | Multivariate | `current_retrieval` | Available to frontend consumers; retrieval selection is authoritative on the API |
| `multimodal_bird_identification` | Boolean | Enabled | Shows or hides bird identification |
| `agent_booking` | Boolean | Enabled | Shows or hides reservation entry points |

Flags use the same consent-gated PostHog initialization and authenticated
identity as product analytics. Identifying a user supplies the safe `plan` and
`role` properties used for targeting. Flag failures and missing configuration
fall back to current product behavior.

The backend must enforce gated capabilities. Hiding a frontend control is not
an authorization boundary.
