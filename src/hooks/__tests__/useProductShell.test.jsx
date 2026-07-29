import { act, renderHook } from '@testing-library/react'
import analytics from '../../analytics/analytics'
import useAuth from '../useAuth'
import useCart from '../useCart'
import useProductShell from '../useProductShell'

jest.mock('../useAuth', () => ({ __esModule: true, default: jest.fn() }))
jest.mock('../useCart', () => ({ __esModule: true, default: jest.fn() }))
jest.mock('../useFeatureFlag', () => ({ __esModule: true, default: jest.fn(() => true) }))
jest.mock('../useFeatureAvailability', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    getFeature: () => ({ enabled: true, message: '' }),
  })),
}))
jest.mock('../../analytics/analytics', () => ({
  __esModule: true,
  default: { track: jest.fn() },
}))

describe('useProductShell', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    window.history.replaceState({}, '', '/')
    useCart.mockReturnValue({
      cart: { items: [], count: 0 },
      reservations: [],
      addTour: jest.fn(),
      removeItem: jest.fn(),
      refreshMyTours: jest.fn().mockResolvedValue([]),
    })
  })

  test('coordinates authenticated reservation entry across home and chat surfaces', async () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      isVisitor: false,
      token: 'token',
      user: { id: '1', name: 'Ana', email: 'ana@example.com', plan: 'PRO' },
      getValidToken: jest.fn().mockResolvedValue('token'),
    })
    const { result } = renderHook(() => useProductShell())

    await act(async () => {
      await result.current.actions.reserveTour({
        id: 12,
        title: 'Monteverde Dawn Chorus',
      })
    })

    expect(result.current.openOverlay).toBe('chat')
    expect(result.current.chatEntry).toMatchObject({
      source: 'featured_tour',
      initialMessage: 'I would like to reserve Monteverde Dawn Chorus.',
      customerContext: {
        customerName: 'Ana',
        customerEmail: 'ana@example.com',
      },
      conversationContext: {
        selectedTourId: 12,
      },
    })
    expect(analytics.track).toHaveBeenCalledWith(expect.objectContaining({
      properties: expect.objectContaining({ source: 'featured_tour' }),
    }))
  })

  test('gates customer-only overlays through the login flow', () => {
    useAuth.mockReturnValue({
      isAuthenticated: false,
      isVisitor: false,
      user: null,
      enterAsVisitor: jest.fn(),
    })
    const { result } = renderHook(() => useProductShell())

    act(() => result.current.actions.openCart())

    expect(result.current.openOverlay).toBe('login')
    expect(result.current.authMode).toBe('login')
  })
})
