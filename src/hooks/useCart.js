import { useCallback, useEffect, useState } from 'react'
import {
  addCartItem,
  createCartItemReservation,
  createCartReservations,
  loadCart,
  loadMyTours,
  removeCartItem,
  updateCartItem,
} from '../api/cartApi'
import {
  readJsonCookie,
  writeJsonCookie,
} from '../utils/cookies'

const CART_ITINERARY_COOKIE = 'birdwatchingAI.cartItinerary'
const CART_ITINERARY_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

function isValidDateValue(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function readCartItineraryCookie() {
  const payload = readJsonCookie(CART_ITINERARY_COOKIE)

  if (!payload) {
    return {
      itineraryStartDate: null,
      itineraryEndDate: null,
    }
  }

  return {
    itineraryStartDate: isValidDateValue(payload.itineraryStartDate) ? payload.itineraryStartDate : null,
    itineraryEndDate: isValidDateValue(payload.itineraryEndDate) ? payload.itineraryEndDate : null,
  }
}

function writeCartItineraryCookie({ itineraryStartDate, itineraryEndDate }) {
  writeJsonCookie(CART_ITINERARY_COOKIE, {
    itineraryStartDate,
    itineraryEndDate,
  }, {
    maxAge: CART_ITINERARY_COOKIE_MAX_AGE_SECONDS,
  })
}

function createEmptyCart() {
  const itinerary = readCartItineraryCookie()

  return {
    itineraryStartDate: itinerary.itineraryStartDate,
    itineraryEndDate: itinerary.itineraryEndDate,
    items: [],
    count: 0,
  }
}

function applyCookieItinerary(cart) {
  const itinerary = readCartItineraryCookie()

  return {
    ...cart,
    itineraryStartDate: itinerary.itineraryStartDate,
    itineraryEndDate: itinerary.itineraryEndDate,
  }
}

function validateItinerary({ itineraryStartDate, itineraryEndDate }) {
  if (!itineraryStartDate || !itineraryEndDate) {
    throw new Error('Choose itinerary start and end dates.')
  }

  if (itineraryEndDate < itineraryStartDate) {
    throw new Error('Choose an end date after the start date.')
  }
}

function getTourId(tour) {
  return tour?.tourId || tour?.id
}

function getFirstOpenDate(cart) {
  if (!cart.itineraryStartDate || !cart.itineraryEndDate) return null

  const usedDates = new Set(cart.items.map((item) => item.scheduledDate).filter(Boolean))
  const cursor = new Date(`${cart.itineraryStartDate}T00:00:00`)
  const end = new Date(`${cart.itineraryEndDate}T00:00:00`)

  while (cursor <= end) {
    const value = cursor.toISOString().slice(0, 10)

    if (!usedDates.has(value)) return value
    cursor.setDate(cursor.getDate() + 1)
  }

  return null
}

function getInitialTourDate(tour, cart, participants = 1) {
  if (tour?.tourType !== 'scheduled') return getFirstOpenDate(cart)
  const usedDates = new Set(cart.items.map((item) => item.scheduledDate).filter(Boolean))
  const occurrence = (tour.occurrenceDates || []).find((item) => (
    item.status === 'scheduled'
    && Number(item.remainingSpaces) >= participants
    && !usedDates.has(item.date)
    && (!cart.itineraryStartDate || item.date >= cart.itineraryStartDate)
    && (!cart.itineraryEndDate || item.date <= cart.itineraryEndDate)
  ))
  return occurrence?.date || null
}

export default function useCart({ isAuthenticated, getAccessToken }) {
  const isEnabled = isAuthenticated && typeof getAccessToken === 'function'
  const [cart, setCart] = useState(() => createEmptyCart())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [reservations, setReservations] = useState([])

  const withToken = useCallback(async () => {
    if (!isEnabled) {
      throw new Error('Please log in to use your tour cart.')
    }

    return getAccessToken ? getAccessToken() : null
  }, [getAccessToken, isEnabled])

  const refresh = useCallback(async () => {
    if (!isEnabled) {
      setCart(createEmptyCart())
      setReservations([])
      return null
    }

    setIsLoading(true)
    setError(null)

    try {
      const token = await withToken()
      const nextCart = applyCookieItinerary(await loadCart({ token }))
      setCart(nextCart)
      return nextCart
    } catch (requestError) {
      setError(requestError.message)
      throw requestError
    } finally {
      setIsLoading(false)
    }
  }, [isEnabled, withToken])

  useEffect(() => {
    refresh().catch(() => {})
  }, [refresh])

  const saveItinerary = useCallback(async (itinerary) => {
    setError(null)

    try {
      validateItinerary(itinerary)
      writeCartItineraryCookie(itinerary)
      const nextCart = applyCookieItinerary(cart)
      setCart(nextCart)
      return nextCart
    } catch (requestError) {
      setError(requestError.message)
      throw requestError
    }
  }, [cart])

  const addTour = useCallback(async (tour, options = {}) => {
    const tourId = getTourId(tour)

    if (!tourId) {
      throw new Error('Tour details are missing.')
    }

    setIsLoading(true)
    setError(null)

    try {
      const token = await withToken()
      const participants = options.participants || 1
      const scheduledDate = options.scheduledDate || getInitialTourDate(tour, cart, participants)
      const item = await addCartItem({
        tourId,
        scheduledDate,
        participants,
        needsTransportation: options.needsTransportation,
        metadata: {
          source: 'featured_tour',
          tourName: tour.name || tour.title,
        },
      }, { token })
      const nextCart = applyCookieItinerary(await loadCart({ token }))
      setCart(nextCart)
      return item
    } catch (requestError) {
      setError(requestError.message)
      throw requestError
    } finally {
      setIsLoading(false)
    }
  }, [cart, withToken])

  const updateItem = useCallback(async (itemId, item) => {
    setIsLoading(true)
    setError(null)

    try {
      const token = await withToken()
      await updateCartItem(itemId, item, { token })
      const nextCart = applyCookieItinerary(await loadCart({ token }))
      setCart(nextCart)
      return nextCart
    } catch (requestError) {
      setError(requestError.message)
      throw requestError
    } finally {
      setIsLoading(false)
    }
  }, [withToken])

  const removeItem = useCallback(async (itemId) => {
    setIsLoading(true)
    setError(null)

    try {
      const token = await withToken()
      await removeCartItem(itemId, { token })
      const nextCart = applyCookieItinerary(await loadCart({ token }))
      setCart(nextCart)
      return nextCart
    } catch (requestError) {
      setError(requestError.message)
      throw requestError
    } finally {
      setIsLoading(false)
    }
  }, [withToken])

  const createReservations = useCallback(async ({ conversationId } = {}) => {
    setIsLoading(true)
    setError(null)

    try {
      const token = await withToken()
      const result = await createCartReservations({ conversationId }, { token })
      const nextCart = applyCookieItinerary(await loadCart({ token }))
      setCart(nextCart)
      setReservations(await loadMyTours({ token }))
      return result
    } catch (requestError) {
      setError(requestError.message)
      throw requestError
    } finally {
      setIsLoading(false)
    }
  }, [withToken])

  const createItemReservation = useCallback(async (itemId, { conversationId } = {}) => {
    setIsLoading(true)
    setError(null)

    try {
      const token = await withToken()
      const result = await createCartItemReservation({ itemId, conversationId }, { token })
      const nextCart = applyCookieItinerary(await loadCart({ token }))
      setCart(nextCart)
      setReservations(await loadMyTours({ token }))
      return result
    } catch (requestError) {
      setError(requestError.message)
      throw requestError
    } finally {
      setIsLoading(false)
    }
  }, [withToken])

  const refreshMyTours = useCallback(async () => {
    if (!isEnabled) {
      setReservations([])
      return []
    }

    setIsLoading(true)
    setError(null)

    try {
      const token = await withToken()
      const nextReservations = await loadMyTours({ token })
      setReservations(nextReservations)
      return nextReservations
    } catch (requestError) {
      setError(requestError.message)
      throw requestError
    } finally {
      setIsLoading(false)
    }
  }, [isEnabled, withToken])

  return {
    cart,
    reservations,
    isLoading,
    error,
    refresh,
    refreshMyTours,
    saveItinerary,
    addTour,
    updateItem,
    removeItem,
    createReservations,
    createItemReservation,
  }
}
