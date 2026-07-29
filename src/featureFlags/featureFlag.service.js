import analytics, { CONSENT_CHANGED_EVENT } from '../analytics/analytics'
import posthogProvider from '../analytics/posthog'
import { FEATURE_FLAG_DEFAULTS } from './flags'

export function createFeatureFlagService({
  provider = posthogProvider,
  initializeAnalytics = () => analytics.initialize(),
  defaults = FEATURE_FLAG_DEFAULTS,
  eventTarget = typeof window === 'undefined' ? null : window,
} = {}) {
  const listeners = new Set()
  let unsubscribeProvider = null
  let listeningForConsent = false

  const notify = () => {
    listeners.forEach((listener) => listener())
  }

  const ensureProviderSubscription = () => {
    if (unsubscribeProvider || typeof provider.onFeatureFlags !== 'function') {
      return
    }

    try {
      if (!initializeAnalytics()) {
        return
      }
      unsubscribeProvider = provider.onFeatureFlags(notify)
    } catch {
      // Missing consent, configuration, and provider failures use safe defaults.
    }
  }

  const getValue = (flag) => {
    if (!Object.hasOwn(defaults, flag)) {
      return undefined
    }

    try {
      initializeAnalytics()
      const value = provider.getFeatureFlag(flag)
      return value === undefined || value === null ? defaults[flag] : value
    } catch {
      return defaults[flag]
    }
  }

  return {
    getValue,

    isEnabled(flag) {
      const value = getValue(flag)
      return value === true || (typeof value === 'string' && value !== 'false')
    },

    getVariant(flag) {
      const value = getValue(flag)
      return typeof value === 'string' ? value : defaults[flag]
    },

    subscribe(listener) {
      listeners.add(listener)
      if (!listeningForConsent && eventTarget?.addEventListener) {
        eventTarget.addEventListener(CONSENT_CHANGED_EVENT, () => {
          ensureProviderSubscription()
          notify()
        })
        listeningForConsent = true
      }
      ensureProviderSubscription()
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

const featureFlags = createFeatureFlagService()

export default featureFlags
