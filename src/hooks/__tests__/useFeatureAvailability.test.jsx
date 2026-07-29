import { act, renderHook, waitFor } from '@testing-library/react'
import useFeatureAvailability from '../useFeatureAvailability'
import { getFeatureAvailability } from '../../api/featureAvailabilityApi'

jest.mock('../../api/featureAvailabilityApi', () => ({
  getFeatureAvailability: jest.fn(),
}))

describe('useFeatureAvailability', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    getFeatureAvailability.mockResolvedValue({
      features: [
        { name: 'voice_ai', enabled: false, status: 'disabled', disabledUntil: new Date(Date.now() + 60_000).toISOString() },
        { name: 'multimodal_bird_identification', enabled: true, status: 'enabled', disabledUntil: null },
        { name: 'agent_booking', enabled: true, status: 'enabled', disabledUntil: null },
      ],
    })
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.clearAllMocks()
  })

  test('exposes disabled state and refreshes when the UTC countdown expires', async () => {
    const { result } = renderHook(() => useFeatureAvailability())
    await waitFor(() => expect(result.current.getFeature('voice_ai').message).toMatch(/voice messages/i))
    expect(result.current.getFeature('voice_ai').message).toMatch(/voice messages/i)

    await act(async () => {
      jest.advanceTimersByTime(60_100)
      await Promise.resolve()
    })
    expect(getFeatureAvailability).toHaveBeenCalledTimes(2)
  })
})
