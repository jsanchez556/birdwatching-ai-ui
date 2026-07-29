import { getFeatureAvailability } from '../featureAvailabilityApi'

function response(body, ok = true) {
  return { ok, json: jest.fn().mockResolvedValue(body) }
}

describe('featureAvailabilityApi', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  test('loads and strictly validates authoritative public feature state', async () => {
    const data = {
      features: [
        { name: 'voice_ai', enabled: false, status: 'disabled', disabledUntil: '2026-07-29T17:00:00.000Z' },
        { name: 'multimodal_bird_identification', enabled: true, status: 'enabled', disabledUntil: null },
        { name: 'agent_booking', enabled: true, status: 'enabled', disabledUntil: null },
      ],
    }
    global.fetch.mockResolvedValue(response({ success: true, data, meta: {} }))
    await expect(getFeatureAvailability()).resolves.toEqual(data)
    expect(global.fetch).toHaveBeenCalledWith('/features/availability', { signal: undefined })
  })

  test('rejects malformed success envelopes', async () => {
    global.fetch.mockResolvedValue(response({
      success: true,
      data: { features: [{ name: 'voice_ai', enabled: true }] },
      meta: {},
    }))
    await expect(getFeatureAvailability()).rejects.toThrow('Something went wrong')
  })
})
