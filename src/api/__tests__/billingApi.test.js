import { createCheckoutSession, createCustomerPortalSession } from '../billingApi'

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

    expect(global.fetch).toHaveBeenCalledWith('/billing/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer access-token',
      },
      body: JSON.stringify({
        provider: 'stripe',
        plan: 'PRO',
      }),
    })
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

    expect(global.fetch).toHaveBeenCalledWith('/billing/portal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer access-token',
      },
      body: JSON.stringify({}),
    })
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
})
