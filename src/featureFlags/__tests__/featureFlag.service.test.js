import { createFeatureFlagService } from '../featureFlag.service'
import { FEATURE_FLAGS, RETRIEVAL_VARIANTS } from '../flags'

function createProvider() {
  return {
    getFeatureFlag: jest.fn(),
    onFeatureFlags: jest.fn(() => jest.fn()),
  }
}

describe('frontend feature flag service', () => {
  test('returns safe defaults when PostHog is unavailable', () => {
    const provider = createProvider()
    provider.getFeatureFlag.mockImplementation(() => {
      throw new Error('provider unavailable')
    })
    const service = createFeatureFlagService({
      provider,
      initializeAnalytics: () => false,
      eventTarget: null,
    })

    expect(service.isEnabled(FEATURE_FLAGS.VOICE_AI)).toBe(true)
    expect(service.getVariant(FEATURE_FLAGS.ADVANCED_RAG)).toBe(RETRIEVAL_VARIANTS.CURRENT)
  })

  test('returns boolean flags and multivariate values from PostHog', () => {
    const provider = createProvider()
    provider.getFeatureFlag.mockImplementation((flag) => ({
      [FEATURE_FLAGS.VOICE_AI]: false,
      [FEATURE_FLAGS.ADVANCED_RAG]: RETRIEVAL_VARIANTS.NEW,
    })[flag])
    const service = createFeatureFlagService({
      provider,
      initializeAnalytics: () => true,
      eventTarget: null,
    })

    expect(service.isEnabled(FEATURE_FLAGS.VOICE_AI)).toBe(false)
    expect(service.getVariant(FEATURE_FLAGS.ADVANCED_RAG)).toBe(RETRIEVAL_VARIANTS.NEW)
  })

  test('notifies subscribers when PostHog reloads flags', () => {
    const provider = createProvider()
    let onFlagsLoaded
    provider.onFeatureFlags.mockImplementation((callback) => {
      onFlagsLoaded = callback
      return jest.fn()
    })
    const listener = jest.fn()
    const service = createFeatureFlagService({
      provider,
      initializeAnalytics: () => true,
      eventTarget: null,
    })

    service.subscribe(listener)
    onFlagsLoaded()

    expect(listener).toHaveBeenCalledTimes(1)
  })

  test('keeps application defaults when analytics initialization fails', () => {
    const provider = createProvider()
    const service = createFeatureFlagService({
      provider,
      initializeAnalytics: () => {
        throw new Error('analytics unavailable')
      },
      eventTarget: null,
    })

    expect(service.isEnabled(FEATURE_FLAGS.VOICE_AI)).toBe(true)
    expect(service.getVariant(FEATURE_FLAGS.ADVANCED_RAG))
      .toBe(RETRIEVAL_VARIANTS.CURRENT)
    expect(provider.getFeatureFlag).not.toHaveBeenCalled()
  })
})
