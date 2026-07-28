import { useEffect, useRef, useState } from 'react'
import ChatInput from './components/ChatInput'
import ChatMessages from './components/ChatMessages'
import CustomerContextForm from './components/CustomerContextForm'
import BirdIdentificationModal from './components/BirdIdentificationModal'
import LoginModal from './components/home/LoginModal'
import MyToursDrawer from './components/home/MyToursDrawer'
import TourCartDrawer from './components/home/TourCartDrawer'
import { createCheckoutSession, createCustomerPortalSession } from './api/billingApi'
import analytics from './analytics/analytics'
import { ANALYTICS_EVENTS } from './analytics/events'
import { FEATURE_FLAGS } from './featureFlags/flags'
import useAuth from './hooks/useAuth'
import useCart from './hooks/useCart'
import useChat from './hooks/useChat'
import useFeatureFlag from './hooks/useFeatureFlag'
import AdminDashboard from './pages/AdminDashboard'
import HomePage from './pages/HomePage'

function AppHeader({ action }) {
  return (
    <header className="app-header">
      <div className="brand-group">
        <div className="brand-mark" aria-hidden="true">BW</div>
        <div>
          <h1>Birdwatching AI</h1>
          <p>Your Costa Rica bird expert</p>
        </div>
      </div>
      {action}
    </header>
  )
}

function AuthenticatedChat({ auth, onHome }) {
  return (
    <main className="app-shell">
      <AppHeader
        action={(
          <div className="header-actions">
            <button type="button" className="logout-action" onClick={onHome}>
              Home
            </button>
            <button type="button" className="logout-action" onClick={auth.logout}>
              {auth.isVisitor ? 'Exit visitor chat' : 'Log out'}
            </button>
          </div>
        )}
      />
      <ChatSurface auth={auth} />
    </main>
  )
}

function getTourId(tour) {
  return tour?.tourId || tour?.id
}

function getTourName(tour) {
  return tour?.name || tour?.title || tour?.tourName || 'Selected tour'
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== '')
  )
}

function trackChatStarted({ plan, source, userType }) {
  analytics.track({
    event: ANALYTICS_EVENTS.CHAT_STARTED,
    properties: {
      plan,
      source,
      userType,
    },
  })
}

function summarizeTour(tour) {
  if (!tour || typeof tour !== 'object') {
    return null
  }

  const tourId = getTourId(tour)

  return compactObject({
    tourId: tourId ? Number(tourId) : undefined,
    name: getTourName(tour),
    location: tour.location,
    node: tour.node,
    subnode: tour.subnode,
    zone: tour.zone,
    pricePerPerson: tour.pricePerPerson,
    duration: tour.duration,
    durationHours: tour.durationHours,
    difficulty: tour.difficulty,
    startDate: tour.startDate || tour.start_date,
    endDate: tour.endDate || tour.end_date,
  })
}

function summarizeCartItem(item) {
  const tour = summarizeTour({
    ...(item.tour || {}),
    tourId: item.tourId || item.tour?.tourId || item.tour?.id,
    tourName: item.tourName,
  })

  return compactObject({
    itemId: item.id,
    ...tour,
    scheduledDate: item.scheduledDate,
    participants: item.participants,
    needsTransportation: item.needsTransportation,
  })
}

function buildReservationChatEntry({
  source,
  tours,
  cart,
  authUser,
}) {
  const selectedTours = tours
    .filter((tour) => tour && typeof tour === 'object')
    .map((tour) => compactObject(tour))
    .filter((tour) => tour.tourId || tour.name)
  const tourNames = selectedTours.map((tour) => tour.name).filter(Boolean)
  const isCart = source === 'tour_cart'
  const label = isCart
    ? `${selectedTours.length} tour${selectedTours.length === 1 ? '' : 's'} from my cart`
    : tourNames[0] || 'this tour'
  const entryId = [
    source,
    Date.now(),
    ...selectedTours.map((tour) => tour.itemId || tour.tourId || tour.name),
  ].join(':')
  const customerContext = compactObject({
    customerName: authUser?.name,
    customerEmail: authUser?.email,
    itineraryStartDate: cart?.itineraryStartDate,
    itineraryEndDate: cart?.itineraryEndDate,
  })
  const reservationEntry = compactObject({
    source,
    tours: selectedTours,
    cart: isCart
      ? compactObject({
        itineraryStartDate: cart?.itineraryStartDate,
        itineraryEndDate: cart?.itineraryEndDate,
        count: selectedTours.length,
      })
      : undefined,
  })
  const initialRecentAssistantMetadata = compactObject({
    conversationType: 'reservation_entry',
    conversationSource: source,
    entrySource: source,
    reservationEntry,
    tours: selectedTours,
    selectedTour: !isCart && selectedTours.length === 1 ? selectedTours[0] : undefined,
    selectedTourId: !isCart && selectedTours.length === 1 ? selectedTours[0].tourId : undefined,
    participants: selectedTours.length === 1 ? selectedTours[0].participants : undefined,
  })

  return {
    id: entryId,
    source,
    title: isCart ? 'Reserve selected tours' : 'Reserve this tour',
    initialMessage: `I would like to reserve ${label}.`,
    customerContext,
    conversationMeta: initialRecentAssistantMetadata,
    conversationContext: {
      entrySource: source,
      reservationEntry,
    },
    recentAssistantMetadata: initialRecentAssistantMetadata,
  }
}

function ChatSurface({ auth, chatEntry = null }) {
  const voiceEnabled = useFeatureFlag(FEATURE_FLAGS.VOICE_AI)
  const viewerRole = auth.user?.role || (auth.isVisitor ? 'visitor' : 'customer')
  const isReservationEntry = Boolean(chatEntry)
  const {
    messages,
    isLoading,
    isStreaming,
    isRecording,
    voiceStatus,
    error,
    customerContext,
    conversationMeta,
    setCustomerContext,
    sendMessage,
    startVoiceRecording,
    stopVoiceRecording,
    cancelVoiceRecording,
    stopGenerating,
  } = useChat({
    token: auth.token,
    getAccessToken: auth.getValidToken,
    user: auth.user,
    role: viewerRole,
  }, {
    isEphemeral: isReservationEntry,
    initialCustomerContext: chatEntry?.customerContext,
    initialConversationMeta: chatEntry?.conversationMeta,
    initialConversationContext: chatEntry?.conversationContext,
    initialEntryId: chatEntry?.id,
    initialMessage: chatEntry?.initialMessage,
    initialRecentAssistantMetadata: chatEntry?.recentAssistantMetadata,
  })
  const isVisitor = viewerRole === 'visitor'

  return (
    <div className="chat-container">
      {isVisitor && (
        <div className="chat-notice" role="status">
          Visitor mode is for bird questions only. Log in to plan or reserve tours.
        </div>
      )}
      {!isVisitor && !customerContext ? (
        <CustomerContextForm onSubmit={setCustomerContext} authUser={auth.user} />
      ) : (
        <>
          {error && (
            <div className="chat-alert" role="status">
              {error}
            </div>
          )}
          <ChatMessages
            messages={messages}
            isLoading={isLoading}
            customerContext={customerContext}
            conversationMeta={conversationMeta}
            onAction={sendMessage}
            viewerRole={viewerRole}
          />
          <ChatInput
            onSendMessage={sendMessage}
            onStopGenerating={stopGenerating}
            onStartVoiceRecording={startVoiceRecording}
            onStopVoiceRecording={stopVoiceRecording}
            onCancelVoiceRecording={cancelVoiceRecording}
            isLoading={isLoading}
            isStreaming={isStreaming}
            isRecording={isRecording}
            voiceStatus={voiceStatus}
            voiceEnabled={voiceEnabled}
          />
        </>
      )}
    </div>
  )
}

function HomeChatDrawer({ auth, chatEntry = null, onClose }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return (
    <div className="home-chat-drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="home-chat-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="home-chat-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="home-chat-drawer-header">
          <div>
            <p className="home-kicker">Birdwatching AI</p>
            <h2 id="home-chat-title">{chatEntry?.title || 'Plan your birding chat'}</h2>
          </div>
          <button
            type="button"
            className="auth-modal-close"
            aria-label="Close chat"
            onClick={onClose}
          >
            x
          </button>
        </header>
        <ChatSurface auth={auth} chatEntry={chatEntry} />
      </section>
    </div>
  )
}

function App() {
  const agentBookingEnabled = useFeatureFlag(FEATURE_FLAGS.AGENT_BOOKING)
  const birdIdentificationEnabled = useFeatureFlag(FEATURE_FLAGS.MULTIMODAL_BIRD_IDENTIFICATION)
  const [authMode, setAuthMode] = useState('login')
  const [activeView, setActiveView] = useState('home')
  const [addingTourIds, setAddingTourIds] = useState([])
  const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false)
  const [chatEntry, setChatEntry] = useState(null)
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false)
  const [isBirdIdentificationOpen, setIsBirdIdentificationOpen] = useState(false)
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
  const [isMyToursOpen, setIsMyToursOpen] = useState(false)
  const [removingTourIds, setRemovingTourIds] = useState([])
  const [reservingTourIds, setReservingTourIds] = useState([])
  const [billingError, setBillingError] = useState(null)
  const [billingReturnStatus, setBillingReturnStatus] = useState(() => {
    const status = new URLSearchParams(window.location.search).get('billing')
    return status === 'success' || status === 'cancelled' ? status : null
  })
  const [isBillingLoading, setIsBillingLoading] = useState(false)
  const hasHandledBillingSuccess = useRef(false)
  const isAppMounted = useRef(true)
  const auth = useAuth()
  const cartState = useCart({
    isAuthenticated: auth.isAuthenticated && !auth.isVisitor,
    getAccessToken: auth.getValidToken,
  })

  const showChat = activeView === 'chat' && (auth.isAuthenticated || auth.isVisitor)
  const showAdmin = activeView === 'admin'
    && auth.isAuthenticated
    && !auth.isVisitor
    && auth.user?.role === 'admin'
  const addedTourIds = cartState.cart.items.map((item) => item.tourId)
  const cartItemsByTourId = cartState.cart.items.reduce((itemsByTourId, item) => ({
    ...itemsByTourId,
    [String(item.tourId)]: item,
  }), {})

  const setTourPending = (setter, tourId, isPending) => {
    setter((currentIds) => {
      const key = String(tourId)

      if (isPending) {
        return currentIds.includes(key) ? currentIds : [...currentIds, key]
      }

      return currentIds.filter((id) => id !== key)
    })
  }

  useEffect(() => () => {
    isAppMounted.current = false
  }, [])

  useEffect(() => {
    const billingStatus = new URLSearchParams(window.location.search).get('billing')

    if (billingStatus === 'success' || billingStatus === 'cancelled') {
      const url = new URL(window.location.href)
      url.searchParams.delete('billing')
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
    }

    if (
      billingStatus !== 'success'
      || hasHandledBillingSuccess.current
      || !auth.isAuthenticated
      || auth.isVisitor
      || typeof auth.refreshCurrentUser !== 'function'
    ) {
      return undefined
    }

    hasHandledBillingSuccess.current = true

    setBillingError(null)
    auth.refreshCurrentUser()
      .catch((error) => {
        if (isAppMounted.current) {
          setBillingError(error.message || 'Unable to refresh your plan. Please reload the page.')
        }
      })

    return undefined
  }, [auth.isAuthenticated, auth.isVisitor, auth.refreshCurrentUser])

  const startChat = () => {
    if (!auth.isAuthenticated && !auth.isVisitor) {
      auth.enterAsVisitor()
    }

    setChatEntry(null)
    setIsChatDrawerOpen(true)
    trackChatStarted({
      plan: auth.user?.plan || (auth.isAuthenticated ? 'FREE' : 'VISITOR'),
      source: 'homepage',
      userType: auth.isAuthenticated ? 'authenticated' : 'visitor',
    })
  }

  const openLogin = () => {
    if (auth.isAuthenticated) {
      setIsLoginModalOpen(false)
      return
    }

    if (auth.isVisitor) {
      auth.logout()
    }

    setAuthMode('login')
    setIsLoginModalOpen(true)
  }

  const openCart = () => {
    if (!auth.isAuthenticated || auth.isVisitor) {
      openLogin()
      return
    }

    setIsCartDrawerOpen(true)
  }

  const openMyTours = () => {
    if (!auth.isAuthenticated || auth.isVisitor) {
      openLogin()
      return
    }

    setIsMyToursOpen(true)
    cartState.refreshMyTours().catch(() => {})
  }

  const openBirdIdentification = () => {
    if (!birdIdentificationEnabled) {
      return
    }

    if (!auth.isAuthenticated || auth.isVisitor) {
      openLogin()
      return
    }

    setIsBirdIdentificationOpen(true)
  }

  const openAdminDashboard = () => {
    if (!auth.isAuthenticated || auth.isVisitor || auth.user?.role !== 'admin') {
      return
    }

    setActiveView('admin')
  }

  const handleUpgradePlan = async () => {
    if (!auth.isAuthenticated || auth.isVisitor) {
      openLogin()
      return
    }

    setBillingError(null)
    setIsBillingLoading(true)

    try {
      const result = await createCheckoutSession({
        token: await auth.getValidToken(),
        plan: 'PRO',
      })
      window.location.assign(result.paymentUrl)
    } catch (error) {
      setBillingError(error.message || 'Unable to start checkout. Please try again.')
    } finally {
      setIsBillingLoading(false)
    }
  }

  const handleManageBilling = async () => {
    if (!auth.isAuthenticated || auth.isVisitor) {
      openLogin()
      return
    }

    setBillingError(null)
    setIsBillingLoading(true)

    try {
      const result = await createCustomerPortalSession({
        token: await auth.getValidToken(),
      })
      window.location.assign(result.managementUrl)
    } catch (error) {
      setBillingError(error.message || 'Unable to open billing portal. Please try again.')
    } finally {
      setIsBillingLoading(false)
    }
  }

  const handleAddTourToCart = async (tour) => {
    if (!auth.isAuthenticated || auth.isVisitor) {
      openLogin()
      return
    }

    const tourId = getTourId(tour)

    try {
      setTourPending(setAddingTourIds, tourId, true)
      await cartState.addTour(tour)
      setIsCartDrawerOpen(true)
    } catch {
      setIsCartDrawerOpen(true)
    } finally {
      setTourPending(setAddingTourIds, tourId, false)
    }
  }

  const handleReserveTour = async (tour) => {
    if (!agentBookingEnabled) {
      return
    }

    if (!auth.isAuthenticated || auth.isVisitor) {
      openLogin()
      return
    }

    const tourId = getTourId(tour)

    try {
      setTourPending(setReservingTourIds, tourId, true)
      setChatEntry(buildReservationChatEntry({
        source: 'featured_tour',
        tours: [summarizeTour(tour)],
        cart: cartState.cart,
        authUser: auth.user,
      }))
      setIsCartDrawerOpen(false)
      setIsChatDrawerOpen(true)
      trackChatStarted({
        plan: auth.user?.plan || 'FREE',
        source: 'featured_tour',
        userType: 'authenticated',
      })
    } catch {
      setIsChatDrawerOpen(true)
    } finally {
      setTourPending(setReservingTourIds, tourId, false)
    }
  }

  const handleReserveCartItems = (items) => {
    if (!agentBookingEnabled) {
      return
    }

    if (!auth.isAuthenticated || auth.isVisitor) {
      openLogin()
      return
    }

    const selectedItems = Array.isArray(items) ? items : []

    if (selectedItems.length === 0) {
      return
    }

    setChatEntry(buildReservationChatEntry({
      source: 'tour_cart',
      tours: selectedItems.map(summarizeCartItem),
      cart: cartState.cart,
      authUser: auth.user,
    }))
    setIsCartDrawerOpen(false)
    setIsChatDrawerOpen(true)
    trackChatStarted({
      plan: auth.user?.plan || 'FREE',
      source: 'tour_cart',
      userType: 'authenticated',
    })
  }

  const handleRemoveTourFromCart = async (tour) => {
    if (!auth.isAuthenticated || auth.isVisitor) {
      openLogin()
      return
    }

    const tourId = getTourId(tour)
    const cartItem = cartItemsByTourId[String(tourId)]

    if (!cartItem?.id) {
      return
    }

    try {
      setTourPending(setRemovingTourIds, tourId, true)
      await cartState.removeItem(cartItem.id)
    } catch {
      setIsCartDrawerOpen(true)
    } finally {
      setTourPending(setRemovingTourIds, tourId, false)
    }
  }

  const handleHomeAuthAction = () => {
    if (auth.isAuthenticated || auth.isVisitor) {
      setIsChatDrawerOpen(false)
      auth.logout()
      return
    }

    openLogin()
  }

  const handleLogin = async (credentials) => {
    const result = await auth.login(credentials)
    setIsLoginModalOpen(false)
    return result
  }

  const handleSignup = async (credentials) => {
    const result = await auth.signup(credentials)
    setIsLoginModalOpen(false)
    return result
  }

  const handleEnterAsVisitor = () => {
    auth.enterAsVisitor()
    setIsLoginModalOpen(false)
    setIsChatDrawerOpen(true)
    trackChatStarted({
      plan: 'VISITOR',
      source: 'login_modal',
      userType: 'visitor',
    })
  }

  const authActionLabel = auth.isAuthenticated
    ? 'Logout'
    : auth.isVisitor ? 'Logout' : 'Login'

  if (showChat) {
    return <AuthenticatedChat auth={auth} onHome={() => setActiveView('home')} />
  }

  if (showAdmin) {
    return (
      <AdminDashboard
        getAccessToken={auth.getValidToken}
        onBack={() => setActiveView('home')}
      />
    )
  }

  return (
    <>
      <HomePage
        agentBookingEnabled={agentBookingEnabled}
        addedTourIds={addedTourIds}
        addingTourIds={addingTourIds}
        authActionLabel={authActionLabel}
        cartCount={cartState.cart.count}
        cartItemsByTourId={cartItemsByTourId}
        isCartEnabled={auth.isAuthenticated && !auth.isVisitor}
        isAuthenticated={auth.isAuthenticated}
        isBillingLoading={isBillingLoading}
        billingError={billingError}
        billingReturnStatus={billingReturnStatus}
        birdIdentificationEnabled={birdIdentificationEnabled}
        onAddTourToCart={handleAddTourToCart}
        onAuthAction={handleHomeAuthAction}
        onManageBilling={handleManageBilling}
        onDismissBillingReturn={() => setBillingReturnStatus(null)}
        onOpenBirdIdentification={openBirdIdentification}
        onOpenCart={openCart}
        onOpenAdmin={openAdminDashboard}
        onOpenMyTours={openMyTours}
        onUpdateProfile={auth.updateProfile}
        onUpdateProfileImage={auth.updateProfileImage}
        onUpgradePlan={handleUpgradePlan}
        onRemoveTourFromCart={handleRemoveTourFromCart}
        removingTourIds={removingTourIds}
        onReserveTour={handleReserveTour}
        reservingTourIds={reservingTourIds}
        onStartChat={startChat}
        onLogin={openLogin}
        user={auth.user}
      />
      {isChatDrawerOpen && (auth.isAuthenticated || auth.isVisitor) && (
        <HomeChatDrawer
          auth={auth}
          chatEntry={chatEntry}
          onClose={() => setIsChatDrawerOpen(false)}
        />
      )}
      {isLoginModalOpen && (
        <LoginModal
          authMode={authMode}
          error={auth.error}
          isLoading={auth.isLoading}
          onClose={() => setIsLoginModalOpen(false)}
          onLogin={handleLogin}
          onSignup={handleSignup}
          onSwitchMode={() => setAuthMode((mode) => (mode === 'login' ? 'signup' : 'login'))}
          onEnterAsVisitor={handleEnterAsVisitor}
        />
      )}
      {isCartDrawerOpen && auth.isAuthenticated && !auth.isVisitor && (
        <TourCartDrawer
          agentBookingEnabled={agentBookingEnabled}
          authUser={auth.user}
          cart={cartState.cart}
          error={cartState.error}
          isLoading={cartState.isLoading}
          onClose={() => setIsCartDrawerOpen(false)}
          onReserveCart={handleReserveCartItems}
          onReserveItem={(item) => handleReserveCartItems([item])}
          onRemoveItem={cartState.removeItem}
          onSaveItinerary={cartState.saveItinerary}
          onUpdateItem={cartState.updateItem}
        />
      )}
      {birdIdentificationEnabled && isBirdIdentificationOpen && auth.isAuthenticated && !auth.isVisitor && (
        <BirdIdentificationModal
          auth={auth}
          onClose={() => setIsBirdIdentificationOpen(false)}
        />
      )}
      {isMyToursOpen && auth.isAuthenticated && !auth.isVisitor && (
        <MyToursDrawer
          error={cartState.error}
          isLoading={cartState.isLoading}
          onClose={() => setIsMyToursOpen(false)}
          reservations={cartState.reservations}
        />
      )}
    </>
  )
}

export default App
