import { useEffect, useMemo, useRef, useState } from 'react'
import { createCheckoutSession, createCustomerPortalSession } from '../api/billingApi'
import analytics from '../analytics/analytics'
import { ANALYTICS_EVENTS } from '../analytics/events'
import { FEATURE_FLAGS } from '../featureFlags/flags'
import {
  buildReservationChatEntry,
  getTourId,
  summarizeCartItem,
  summarizeTour,
} from '../utils/reservationEntry'
import useAuth from './useAuth'
import useCart from './useCart'
import useFeatureAvailability from './useFeatureAvailability'
import useFeatureFlag from './useFeatureFlag'
import { canManageTours } from '../constants/userRoles'

function getBillingReturnStatus() {
  const status = new URLSearchParams(window.location.search).get('billing')
  return status === 'success' || status === 'cancelled' ? status : null
}

function trackChatStarted({ plan, source, userType }) {
  analytics.track({
    event: ANALYTICS_EVENTS.CHAT_STARTED,
    properties: { plan, source, userType },
  })
}

function setPendingId(setter, tourId, isPending) {
  setter((currentIds) => {
    const key = String(tourId)
    if (isPending) return currentIds.includes(key) ? currentIds : [...currentIds, key]
    return currentIds.filter((id) => id !== key)
  })
}

export default function useProductShell() {
  const agentBookingFlagEnabled = useFeatureFlag(FEATURE_FLAGS.AGENT_BOOKING)
  const birdIdentificationFlagEnabled = useFeatureFlag(FEATURE_FLAGS.MULTIMODAL_BIRD_IDENTIFICATION)
  const { getFeature } = useFeatureAvailability()
  const bookingAvailability = getFeature(FEATURE_FLAGS.AGENT_BOOKING)
  const birdAvailability = getFeature(FEATURE_FLAGS.MULTIMODAL_BIRD_IDENTIFICATION)
  const agentBookingEnabled = agentBookingFlagEnabled && bookingAvailability.enabled
  const birdIdentificationEnabled = birdIdentificationFlagEnabled && birdAvailability.enabled
  const auth = useAuth()
  const cart = useCart({
    isAuthenticated: auth.isAuthenticated && !auth.isVisitor,
    getAccessToken: auth.getValidToken,
  })
  const [activeSurface, setActiveSurface] = useState('home')
  const [authMode, setAuthMode] = useState('login')
  const [chatEntry, setChatEntry] = useState(null)
  const [openOverlay, setOpenOverlay] = useState(null)
  const [addingTourIds, setAddingTourIds] = useState([])
  const [removingTourIds, setRemovingTourIds] = useState([])
  const [reservingTourIds, setReservingTourIds] = useState([])
  const [tourImageUpdates, setTourImageUpdates] = useState({})
  const [billingError, setBillingError] = useState(null)
  const [billingReturnStatus, setBillingReturnStatus] = useState(getBillingReturnStatus)
  const [isBillingLoading, setIsBillingLoading] = useState(false)
  const hasHandledBillingSuccess = useRef(false)
  const isMounted = useRef(true)

  const isSignedInCustomer = auth.isAuthenticated && !auth.isVisitor
  const cartItemsByTourId = useMemo(() => cart.cart.items.reduce((byTourId, item) => ({
    ...byTourId,
    [String(item.tourId)]: item,
  }), {}), [cart.cart.items])

  useEffect(() => () => {
    isMounted.current = false
  }, [])

  useEffect(() => {
    const billingStatus = getBillingReturnStatus()

    if (billingStatus) {
      const url = new URL(window.location.href)
      url.searchParams.delete('billing')
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
    }

    if (
      billingStatus !== 'success'
      || hasHandledBillingSuccess.current
      || !isSignedInCustomer
      || typeof auth.refreshCurrentUser !== 'function'
    ) {
      return
    }

    hasHandledBillingSuccess.current = true
    setBillingError(null)
    auth.refreshCurrentUser().catch((error) => {
      if (isMounted.current) {
        setBillingError(error.message || 'Unable to refresh your plan. Please reload the page.')
      }
    })
  }, [auth.refreshCurrentUser, isSignedInCustomer])

  const openLogin = () => {
    if (auth.isAuthenticated) {
      setOpenOverlay(null)
      return
    }
    if (auth.isVisitor) auth.logout()
    setAuthMode('login')
    setOpenOverlay('login')
  }

  const requireCustomer = (action) => {
    if (!isSignedInCustomer) {
      openLogin()
      return false
    }
    action?.()
    return true
  }

  const openReservationChat = ({ source, tours }) => {
    setChatEntry(buildReservationChatEntry({
      source,
      tours,
      cart: cart.cart,
      authUser: auth.user,
    }))
    setOpenOverlay('chat')
    trackChatStarted({
      plan: auth.user?.plan || 'FREE',
      source,
      userType: 'authenticated',
    })
  }

  const reserveTour = async (tour) => {
    if (!agentBookingEnabled || !requireCustomer()) return
    const tourId = getTourId(tour)

    try {
      setPendingId(setReservingTourIds, tourId, true)
      openReservationChat({
        source: 'featured_tour',
        tours: [summarizeTour(tour)],
      })
    } finally {
      setPendingId(setReservingTourIds, tourId, false)
    }
  }

  const reserveCartItems = (items) => {
    if (!agentBookingEnabled || !requireCustomer()) return
    const selectedItems = Array.isArray(items) ? items : []
    if (selectedItems.length === 0) return

    openReservationChat({
      source: 'tour_cart',
      tours: selectedItems.map(summarizeCartItem),
    })
  }

  const addTourToCart = async (tour) => {
    if (!requireCustomer()) return
    const tourId = getTourId(tour)

    try {
      setPendingId(setAddingTourIds, tourId, true)
      await cart.addTour(tour)
    } finally {
      setOpenOverlay('cart')
      setPendingId(setAddingTourIds, tourId, false)
    }
  }

  const removeTourFromCart = async (tour) => {
    if (!requireCustomer()) return
    const tourId = getTourId(tour)
    const cartItem = cartItemsByTourId[String(tourId)]
    if (!cartItem?.id) return

    try {
      setPendingId(setRemovingTourIds, tourId, true)
      await cart.removeItem(cartItem.id)
    } finally {
      setPendingId(setRemovingTourIds, tourId, false)
    }
  }

  const startBillingAction = async (request, fallbackMessage) => {
    if (!requireCustomer()) return
    setBillingError(null)
    setIsBillingLoading(true)

    try {
      const result = await request()
      window.location.assign(result.paymentUrl || result.managementUrl)
    } catch (error) {
      setBillingError(error.message || fallbackMessage)
    } finally {
      setIsBillingLoading(false)
    }
  }

  const login = async (credentials) => {
    const result = await auth.login(credentials)
    setOpenOverlay(null)
    return result
  }

  const signup = async (credentials) => {
    const result = await auth.signup(credentials)
    setOpenOverlay(null)
    return result
  }

  const enterAsVisitor = () => {
    auth.enterAsVisitor()
    setChatEntry(null)
    setOpenOverlay('chat')
    trackChatStarted({ plan: 'VISITOR', source: 'login_modal', userType: 'visitor' })
  }

  const authAction = () => {
    if (auth.isAuthenticated || auth.isVisitor) {
      setOpenOverlay(null)
      auth.logout()
    } else {
      openLogin()
    }
  }

  const openAdmin = () => {
    if (isSignedInCustomer && auth.user?.role === 'admin') setActiveSurface('admin')
  }

  const recordTourImageUpdate = ({ tourId, imagePath, url, version } = {}) => {
    const key = String(tourId || '').trim()
    if (!key || !imagePath || !url) return
    setTourImageUpdates((current) => ({
      ...current,
      [key]: { imagePath, url, version: version || '' },
    }))
  }

  return {
    activeSurface: activeSurface === 'admin'
      && isSignedInCustomer
      && auth.user?.role === 'admin'
      ? 'admin'
      : activeSurface === 'my-tours' && !canManageTours(auth.user?.role)
        ? 'home'
        : activeSurface,
    auth,
    cart,
    chatEntry,
    openOverlay,
    authMode,
    featureAccess: {
      agentBookingEnabled,
      birdIdentificationEnabled,
      bookingUnavailableMessage: bookingAvailability.enabled ? '' : bookingAvailability.message,
      birdIdentificationUnavailableMessage: birdAvailability.enabled ? '' : birdAvailability.message,
    },
    home: {
      addedTourIds: cart.cart.items.map((item) => item.tourId),
      addingTourIds,
      authActionLabel: auth.isAuthenticated || auth.isVisitor ? 'Logout' : 'Login',
      billingError,
      billingReturnStatus,
      cartItemsByTourId,
      isBillingLoading,
      removingTourIds,
      reservingTourIds,
      tourImageUpdates,
    },
    actions: {
      addTourToCart,
      authAction,
      closeOverlay: () => setOpenOverlay(null),
      dismissBillingReturn: () => setBillingReturnStatus(null),
      enterAsVisitor,
      login,
      manageBilling: () => startBillingAction(
        async () => createCustomerPortalSession({ token: await auth.getValidToken() }),
        'Unable to open billing portal. Please try again.'
      ),
      openAdmin,
      openBirdIdentification: () => {
        if (birdIdentificationEnabled) requireCustomer(() => setOpenOverlay('bird-identification'))
      },
      openCart: () => requireCustomer(() => setOpenOverlay('cart')),
      openLogin,
      openBookings: () => requireCustomer(() => {
        setOpenOverlay('bookings')
        cart.refreshMyTours().catch(() => {})
      }),
      openMyTours: () => requireCustomer(() => {
        if (canManageTours(auth.user?.role)) {
          setOpenOverlay(null)
          setActiveSurface('my-tours')
        }
      }),
      removeTourFromCart,
      recordTourImageUpdate,
      reserveCartItems,
      reserveTour,
      setAuthMode,
      showHome: () => {
        setActiveSurface('home')
        setChatEntry(null)
      },
      signup,
      upgradePlan: () => startBillingAction(
        async () => createCheckoutSession({
          token: await auth.getValidToken(),
          plan: 'PRO',
        }),
        'Unable to start checkout. Please try again.'
      ),
    },
  }
}
