import { isCategoryAllowed } from '../utils/cookies'
import posthogProvider from './posthog'

const CONSENT_CHANGED_EVENT = 'birdwatching:consent-changed'
const BLOCKED_PROPERTY_PATTERN = /(authorization|customer|email|message|name|password|prompt|provider.*id|response|secret|session.*id|token)/i

function analyticsConfig() {
  return {
    enabled: import.meta.env.VITE_POSTHOG_ENABLED === 'true',
    key: import.meta.env.VITE_POSTHOG_KEY || '',
    host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
  }
}

function compactSafeProperties(properties = {}) {
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
    return {}
  }

  return Object.fromEntries(Object.entries(properties).filter(([key, value]) => (
    !BLOCKED_PROPERTY_PATTERN.test(key)
    && value !== undefined
    && value !== null
    && ['string', 'number', 'boolean'].includes(typeof value)
  )))
}

export function createAnalytics({
  provider = posthogProvider,
  getConfig = analyticsConfig,
  hasConsent = () => isCategoryAllowed('analytics'),
  eventTarget = typeof window === 'undefined' ? null : window,
} = {}) {
  let initialized = false
  let trackingAllowed = false
  let pendingIdentity = null
  let listeningForConsent = false

  const initializeProvider = () => {
    const config = getConfig()

    if (
      initialized
      || !config.enabled
      || !config.key
      || !hasConsent()
    ) {
      return false
    }

    try {
      provider.initialize(config)
      provider.setTrackingAllowed(true)
      initialized = true
      trackingAllowed = true

      if (pendingIdentity) {
        provider.identify(pendingIdentity.userId, pendingIdentity.properties)
      }
    } catch {
      return false
    }

    return true
  }

  const handleConsentChange = () => {
    if (hasConsent()) {
      const wasInitialized = initialized
      initializeProvider()
      if (initialized) {
        try {
          provider.setTrackingAllowed(true)
          trackingAllowed = true
          if (wasInitialized && pendingIdentity) {
            provider.identify(pendingIdentity.userId, pendingIdentity.properties)
          }
        } catch {
          trackingAllowed = false
        }
      }
      return
    }

    if (initialized) {
      try {
        provider.reset()
        provider.setTrackingAllowed(false)
      } catch {
        // Analytics failures must not interrupt consent updates.
      }
      trackingAllowed = false
    }
  }

  return {
    initialize() {
      if (!listeningForConsent && eventTarget?.addEventListener) {
        eventTarget.addEventListener(CONSENT_CHANGED_EVENT, handleConsentChange)
        listeningForConsent = true
      }

      return initializeProvider()
    },

    identify(userId, properties = {}) {
      if (userId === undefined || userId === null || String(userId).trim() === '') {
        return
      }

      pendingIdentity = {
        userId: String(userId),
        properties: compactSafeProperties(properties),
      }

      if (!hasConsent()) {
        return
      }

      const wasInitialized = initialized
      initializeProvider()

      if (wasInitialized && initialized && trackingAllowed) {
        try {
          provider.identify(pendingIdentity.userId, pendingIdentity.properties)
        } catch {
          // Identification is best-effort.
        }
      }
    },

    reset() {
      pendingIdentity = null
      if (initialized) {
        try {
          provider.reset()
        } catch {
          // Reset is best-effort.
        }
      }
    },

    track({ event, properties = {} } = {}) {
      if (typeof event !== 'string' || !event.trim()) {
        return
      }

      if (!hasConsent()) {
        return
      }

      if ((initializeProvider() || initialized) && trackingAllowed) {
        try {
          provider.track(event.trim(), compactSafeProperties(properties))
        } catch {
          // Capture is best-effort.
        }
      }
    },
  }
}

const analytics = createAnalytics()

export { CONSENT_CHANGED_EVENT, compactSafeProperties }
export default analytics
