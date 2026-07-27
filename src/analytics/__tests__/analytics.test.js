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
        key: 'phc_test',
        host: 'https://posthog.example.test',
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
      key: 'phc_test',
      host: 'https://posthog.example.test',
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
      getConfig: () => ({ enabled: true, key: 'phc_test', host: 'https://posthog.test' }),
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
      getConfig: () => ({ enabled: true, key: 'phc_test', host: 'https://posthog.test' }),
      hasConsent: () => true,
    })

    analytics.initialize()
    analytics.track({
      event: 'chat_started',
      properties: {
        conversationId: 'conversation-1',
        recommendationCount: 2,
        message: 'private chat text',
        nested: { private: true },
      },
    })
    analytics.reset()

    expect(provider.track).toHaveBeenCalledWith('chat_started', {
      conversationId: 'conversation-1',
      recommendationCount: 2,
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
})
