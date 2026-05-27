import { act, renderHook, waitFor } from '@testing-library/react'
import useCart from '../useCart'
import {
  addCartItem,
  createCartItemReservation,
  createCartReservations,
  loadCart,
  loadMyTours,
  removeCartItem,
  updateCartItem,
} from '../../api/cartApi'
import { removeCookie, writeJsonCookie } from '../../utils/cookies'

const CART_ITINERARY_COOKIE = 'birdwatchingAI.cartItinerary'

jest.mock('../../api/cartApi', () => ({
  addCartItem: jest.fn(),
  createCartItemReservation: jest.fn(),
  createCartReservations: jest.fn(),
  loadCart: jest.fn(),
  loadMyTours: jest.fn(),
  removeCartItem: jest.fn(),
  updateCartItem: jest.fn(),
}))

function emptyBackendCart(overrides = {}) {
  return {
    itineraryStartDate: null,
    itineraryEndDate: null,
    items: [],
    count: 0,
    ...overrides,
  }
}

describe('useCart itinerary cookie persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    removeCookie(CART_ITINERARY_COOKIE)
    loadCart.mockResolvedValue(emptyBackendCart())
    loadMyTours.mockResolvedValue([])
    addCartItem.mockResolvedValue({ id: 1 })
    updateCartItem.mockResolvedValue({ id: 1 })
    removeCartItem.mockResolvedValue()
    createCartReservations.mockResolvedValue({ count: 1, reservations: [] })
    createCartItemReservation.mockResolvedValue({ count: 1, reservations: [] })
  })

  afterEach(() => {
    removeCookie(CART_ITINERARY_COOKIE)
  })

  test('saving itinerary writes dates to a cookie without calling a backend save endpoint', async () => {
    const getAccessToken = jest.fn().mockResolvedValue('token-1')
    const { result } = renderHook(() => useCart({
      isAuthenticated: true,
      getAccessToken,
    }))

    await waitFor(() => expect(loadCart).toHaveBeenCalledTimes(1))
    jest.clearAllMocks()

    await act(async () => {
      await result.current.saveItinerary({
        itineraryStartDate: '2026-07-14',
        itineraryEndDate: '2026-07-16',
      })
    })

    expect(document.cookie).toContain(CART_ITINERARY_COOKIE)
    expect(decodeURIComponent(document.cookie)).toContain('"itineraryStartDate":"2026-07-14"')
    expect(decodeURIComponent(document.cookie)).toContain('"itineraryEndDate":"2026-07-16"')
    expect(result.current.cart).toMatchObject({
      itineraryStartDate: '2026-07-14',
      itineraryEndDate: '2026-07-16',
    })
    expect(loadCart).not.toHaveBeenCalled()
    expect(getAccessToken).not.toHaveBeenCalled()
  })

  test('hydrates cart itinerary dates from the cookie over backend cart values', async () => {
    writeJsonCookie(CART_ITINERARY_COOKIE, {
      itineraryStartDate: '2026-08-01',
      itineraryEndDate: '2026-08-03',
    })
    loadCart.mockResolvedValue(emptyBackendCart({
      itineraryStartDate: '2026-01-01',
      itineraryEndDate: '2026-01-02',
    }))

    const { result } = renderHook(() => useCart({
      isAuthenticated: true,
      getAccessToken: jest.fn().mockResolvedValue('token-1'),
    }))

    await waitFor(() => expect(result.current.cart).toMatchObject({
      itineraryStartDate: '2026-08-01',
      itineraryEndDate: '2026-08-03',
    }))
  })

  test('rejects invalid itinerary ranges before writing the cookie', async () => {
    const getAccessToken = jest.fn().mockResolvedValue('token-1')
    const { result } = renderHook(() => useCart({
      isAuthenticated: true,
      getAccessToken,
    }))

    await waitFor(() => expect(loadCart).toHaveBeenCalledTimes(1))

    let saveError

    await act(async () => {
      try {
        await result.current.saveItinerary({
          itineraryStartDate: '2026-07-16',
          itineraryEndDate: '2026-07-14',
        })
      } catch (error) {
        saveError = error
      }
    })

    expect(saveError).toEqual(new Error('Choose an end date after the start date.'))
    expect(document.cookie).not.toContain(CART_ITINERARY_COOKIE)
  })
})
