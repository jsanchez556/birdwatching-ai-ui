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

  test('opens a structured featured-tour reservation in the homepage chat drawer', async () => {
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

    expect(result.current.activeSurface).toBe('home')
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

  test('opens cart reservation entry in the homepage chat drawer', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      isVisitor: false,
      token: 'token',
      user: { id: '1', name: 'Ana', email: 'ana@example.com', plan: 'PRO' },
      getValidToken: jest.fn().mockResolvedValue('token'),
    })
    const { result } = renderHook(() => useProductShell())

    act(() => result.current.actions.reserveCartItems([{
      id: 21,
      tourId: 12,
      tour: { id: 12, name: 'Monteverde Dawn Chorus' },
    }]))

    expect(result.current.activeSurface).toBe('home')
    expect(result.current.openOverlay).toBe('chat')
    expect(result.current.chatEntry).toMatchObject({ source: 'tour_cart' })
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

  test('opens the homepage chat drawer when continuing as a visitor from login', () => {
    const enterAsVisitor = jest.fn()
    useAuth.mockReturnValue({
      isAuthenticated: false,
      isVisitor: false,
      user: null,
      enterAsVisitor,
    })
    const { result } = renderHook(() => useProductShell())

    act(() => result.current.actions.enterAsVisitor())

    expect(enterAsVisitor).toHaveBeenCalledTimes(1)
    expect(result.current.activeSurface).toBe('home')
    expect(result.current.openOverlay).toBe('chat')
    expect(result.current.chatEntry).toBeNull()
    expect(analytics.track).toHaveBeenCalledWith(expect.objectContaining({
      properties: expect.objectContaining({ source: 'login_modal', userType: 'visitor' }),
    }))
  })

  test('retains successful tour image updates for the homepage surface', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      isVisitor: false,
      user: { id: '1', role: 'admin' },
      getValidToken: jest.fn().mockResolvedValue('token'),
    })
    const { result } = renderHook(() => useProductShell())

    act(() => result.current.actions.recordTourImageUpdate({
      tourId: 9,
      imagePath: 'tours/9.png',
      url: '/files/tours/9.png',
      version: '1725379200000',
    }))

    expect(result.current.home.tourImageUpdates).toEqual({
      9: {
        imagePath: 'tours/9.png',
        url: '/files/tours/9.png',
        version: '1725379200000',
      },
    })
  })
})
