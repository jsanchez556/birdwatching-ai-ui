import { createAnalytics } from '../analytics'

function createProvider() {
  return {
    initialize: jest.fn(),
    identify: jest.fn(),
    reset: jest.fn(),
    setTrackingAllowed: jest.fn(),
    track: jest.fn(),
  }
}

describe('frontend analytics abstraction', () => {
  test('stays inactive until analytics consent is granted', () => {
    const provider = createProvider()
    const eventTarget = document.createElement('div')
    let hasConsent = false
    const analytics = createAnalytics({
      provider,
      eventTarget,
      getConfig: () => ({
        enabled: true,
        environment: 'development',
        key: 'phc_test',
        host: 'https://posthog.example.test',
        service: 'birdwatching-ai-ui',
      }),
      hasConsent: () => hasConsent,
    })

    expect(analytics.initialize()).toBe(false)
    analytics.track({ event: 'chat_started' })
    expect(provider.initialize).not.toHaveBeenCalled()

    hasConsent = true
    eventTarget.dispatchEvent(new CustomEvent('birdwatching:consent-changed'))

    expect(provider.initialize).toHaveBeenCalledWith({
      enabled: true,
      environment: 'development',
      key: 'phc_test',
      host: 'https://posthog.example.test',
      service: 'birdwatching-ai-ui',
    })
    expect(provider.setTrackingAllowed).toHaveBeenCalledWith(true)
  })

  test('connects a pending authenticated identity after consent', () => {
    const provider = createProvider()
    const eventTarget = document.createElement('div')
    let hasConsent = false
    const analytics = createAnalytics({
      provider,
      eventTarget,
      getConfig: () => ({
        enabled: true,
        environment: 'development',
        key: 'phc_test',
        host: 'https://posthog.test',
        service: 'birdwatching-ai-ui',
      }),
      hasConsent: () => hasConsent,
    })

    analytics.initialize()
    analytics.identify(42, {
      plan: 'PRO',
      email: 'must-not-be-sent@example.test',
    })
    hasConsent = true
    eventTarget.dispatchEvent(new CustomEvent('birdwatching:consent-changed'))

    expect(provider.identify).toHaveBeenCalledTimes(1)
    expect(provider.identify).toHaveBeenCalledWith('42', { plan: 'PRO' })
  })

  test('captures only safe primitive properties and resets identity', () => {
    const provider = createProvider()
    const analytics = createAnalytics({
      provider,
      eventTarget: null,
      getConfig: () => ({
        enabled: true,
        environment: 'development',
        key: 'phc_test',
        host: 'https://posthog.test',
        service: 'birdwatching-ai-ui',
      }),
      hasConsent: () => true,
    })

    analytics.initialize()
    analytics.track({
      event: 'chat_started',
      properties: {
        plan: 'PRO',
        source: 'homepage',
        userType: 'authenticated',
        message: 'private chat text',
        nested: { private: true },
      },
    })
    analytics.reset()

    expect(provider.track).toHaveBeenCalledWith('chat_started', {
      environment: 'development',
      plan: 'PRO',
      service: 'birdwatching-ai-ui',
      source: 'homepage',
      userType: 'authenticated',
    })
    expect(provider.reset).toHaveBeenCalledTimes(1)
  })

  test('does nothing when configuration is disabled or invalid', () => {
    const provider = createProvider()
    const analytics = createAnalytics({
      provider,
      eventTarget: null,
      getConfig: () => ({ enabled: false, key: '', host: 'https://posthog.test' }),
      hasConsent: () => true,
    })

    analytics.initialize()
    analytics.identify('user-1')
    analytics.track({ event: 'chat_started' })
    analytics.reset()

    expect(provider.initialize).not.toHaveBeenCalled()
    expect(provider.identify).not.toHaveBeenCalled()
    expect(provider.track).not.toHaveBeenCalled()
    expect(provider.reset).not.toHaveBeenCalled()
  })

  test('never propagates provider failures to application callers', () => {
    const initializationFailure = createProvider()
    initializationFailure.initialize.mockImplementation(() => {
      throw new Error('provider initialization failed')
    })
    const unavailableAnalytics = createAnalytics({
      provider: initializationFailure,
      eventTarget: null,
      getConfig: () => ({
        enabled: true,
        environment: 'development',
        key: 'phc_test',
        host: 'https://posthog.test',
        service: 'birdwatching-ai-ui',
      }),
      hasConsent: () => true,
    })

    expect(() => unavailableAnalytics.initialize()).not.toThrow()
    expect(() => unavailableAnalytics.identify('user-1', { plan: 'PRO' })).not.toThrow()
    expect(() => unavailableAnalytics.track({ event: 'chat_started' })).not.toThrow()

    const deliveryFailure = createProvider()
    deliveryFailure.identify.mockImplementation(() => {
      throw new Error('identify failed')
    })
    deliveryFailure.track.mockImplementation(() => {
      throw new Error('capture failed')
    })
    deliveryFailure.reset.mockImplementation(() => {
      throw new Error('reset failed')
    })
    const bestEffortAnalytics = createAnalytics({
      provider: deliveryFailure,
      eventTarget: null,
      getConfig: () => ({
        enabled: true,
        environment: 'development',
        key: 'phc_test',
        host: 'https://posthog.test',
        service: 'birdwatching-ai-ui',
      }),
      hasConsent: () => true,
    })

    expect(bestEffortAnalytics.initialize()).toBe(true)
    expect(() => bestEffortAnalytics.identify('user-1', { plan: 'PRO' })).not.toThrow()
    expect(() => bestEffortAnalytics.track({
      event: 'chat_started',
      properties: { source: 'homepage' },
    })).not.toThrow()
    expect(() => bestEffortAnalytics.reset()).not.toThrow()
  })
})
