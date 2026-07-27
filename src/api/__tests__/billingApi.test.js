import {
  BILLING_REQUEST_TIMEOUT_MS,
  createCheckoutSession,
  createCustomerPortalSession,
} from '../billingApi'

describe('billingApi', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  test('creates a provider checkout session with bearer auth', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          provider: 'stripe',
          plan: 'PRO',
          paymentUrl: 'https://checkout.stripe.com/c/pay/cs_test_123',
        },
        meta: {},
      }),
    })

    await expect(createCheckoutSession({
      token: 'access-token',
      provider: 'stripe',
      plan: 'PRO',
    })).resolves.toEqual({
      provider: 'stripe',
      plan: 'PRO',
      paymentUrl: 'https://checkout.stripe.com/c/pay/cs_test_123',
    })

    expect(global.fetch).toHaveBeenCalledWith('/billing/checkout', expect.objectContaining({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer access-token',
      },
      body: JSON.stringify({
        provider: 'stripe',
        plan: 'PRO',
      }),
      signal: expect.any(AbortSignal),
    }))
  })

  test('creates a billing management session with bearer auth', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          provider: 'stripe',
          managementUrl: 'https://billing.stripe.com/p/session/test_123',
        },
        meta: {},
      }),
    })

    await expect(createCustomerPortalSession({ token: 'access-token' })).resolves.toEqual({
      provider: 'stripe',
      managementUrl: 'https://billing.stripe.com/p/session/test_123',
    })

    expect(global.fetch).toHaveBeenCalledWith('/billing/portal', expect.objectContaining({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer access-token',
      },
      body: JSON.stringify({}),
      signal: expect.any(AbortSignal),
    }))
  })

  test('rejects invalid portal envelopes', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {},
        meta: {},
      }),
    })

    await expect(createCustomerPortalSession({ token: 'access-token' }))
      .rejects.toThrow('Unexpected billing portal response format')
  })

  test('times out checkout requests so the upgrade action can be retried', async () => {
    jest.useFakeTimers()
    global.fetch.mockImplementation((url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        const error = new Error('aborted')
        error.name = 'AbortError'
        reject(error)
      })
    }))

    try {
      const checkoutPromise = createCheckoutSession({
        token: 'access-token',
        plan: 'PRO',
      })

      jest.advanceTimersByTime(BILLING_REQUEST_TIMEOUT_MS)

      await expect(checkoutPromise)
        .rejects.toThrow('Billing took too long to respond. Please try again.')
    } finally {
      jest.useRealTimers()
    }
  })
})
