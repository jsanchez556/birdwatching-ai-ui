import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom'

jest.mock('../hooks/useAuth', () => ({
  __esModule: true,
  default: jest.fn(),
}))
jest.mock('../hooks/useChat', () => ({
  __esModule: true,
  default: jest.fn(),
}))
jest.mock('../hooks/useCart', () => ({
  __esModule: true,
  default: jest.fn(),
}))
jest.mock('../hooks/useHomeContent', () => ({
  __esModule: true,
  default: jest.fn(),
}))
jest.mock('../hooks/useResolvedMediaUrl', () => {
  const useResolvedMediaUrl = jest.fn()

  return {
    __esModule: true,
    default: useResolvedMediaUrl,
    useResolvedMedia: jest.fn((value) => ({
      url: useResolvedMediaUrl(value),
      isResolving: false,
      error: null,
    })),
  }
})
jest.mock('../analytics/analytics', () => ({
  __esModule: true,
  default: {
    track: jest.fn(),
  },
}))

const App = require('../App').default
const useAuth = require('../hooks/useAuth').default
const useChat = require('../hooks/useChat').default
const useCart = require('../hooks/useCart').default
const useHomeContent = require('../hooks/useHomeContent').default
const useResolvedMediaUrl = require('../hooks/useResolvedMediaUrl').default

describe('App authentication flow', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    window.localStorage.clear()
    window.history.replaceState({}, '', '/')
    useHomeContent.mockReturnValue({
      hero: null,
      tours: [],
      birds: [],
      transfers: [],
      isLoading: false,
      error: null,
    })
    useCart.mockReturnValue({
      cart: {
        itineraryStartDate: null,
        itineraryEndDate: null,
        items: [],
        count: 0,
      },
      reservations: [],
      isLoading: false,
      error: null,
      refresh: jest.fn(),
      refreshMyTours: jest.fn().mockResolvedValue([]),
      saveItinerary: jest.fn(),
      addTour: jest.fn().mockResolvedValue({}),
      updateItem: jest.fn(),
      removeItem: jest.fn(),
      createReservations: jest.fn(),
      createItemReservation: jest.fn(),
    })
    useResolvedMediaUrl.mockImplementation((key) => `https://example.test/${key}`)
  })

  test('shows homepage as the unauthenticated entry point', () => {
    useAuth.mockReturnValue({
      isAuthenticated: false,
      isVisitor: false,
      isLoading: false,
      error: null,
      login: jest.fn(),
      signup: jest.fn(),
      enterAsVisitor: jest.fn(),
    })
    render(<App />)

    expect(screen.getByRole('heading', { name: /Find your way into the wild/i })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Login$/i }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /Start Birdwatching Chat/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Start Birdwatching Chat/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Contact us on WhatsApp/i })).not.toBeInTheDocument()
    expect(useResolvedMediaUrl).not.toHaveBeenCalledWith('resources/wtsapp.png')
    expect(useResolvedMediaUrl).not.toHaveBeenCalledWith('resources/bwapp.png')
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1)
    const transportSection = document.getElementById('transport')
    const speciesHighlightsSection = document.getElementById('bird-highlights')
    expect(transportSection).toBeInTheDocument()
    expect(speciesHighlightsSection).toBeInTheDocument()
    expect(
      transportSection.compareDocumentPosition(speciesHighlightsSection)
        & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /welcome back/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/Plan your birding chat/i)).not.toBeInTheDocument()
  })

  test('refreshes authenticated user state after a successful billing return', async () => {
    const refreshCurrentUser = jest.fn().mockResolvedValue({
      id: 'user-1',
      email: 'ana@example.com',
      plan: 'PRO',
    })
    window.history.pushState({}, '', '/?billing=success')
    useAuth.mockReturnValue({
      isAuthenticated: true,
      isVisitor: false,
      isLoading: false,
      error: null,
      user: {
        id: 'user-1',
        email: 'ana@example.com',
        name: 'Ana',
        plan: 'FREE',
      },
      getValidToken: jest.fn(),
      refreshCurrentUser,
      logout: jest.fn(),
    })

    render(<App />)

    await waitFor(() => {
      expect(refreshCurrentUser).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByText(/Subscription confirmed/i)).toBeInTheDocument()
    expect(window.location.search).toBe('')
  })

  test('keeps billing actions enabled while the plan refresh completes', async () => {
    let resolveRefresh
    const refreshCurrentUser = jest.fn(() => new Promise((resolve) => {
      resolveRefresh = resolve
    }))
    const initialAuth = {
      isAuthenticated: true,
      isVisitor: false,
      isLoading: false,
      error: null,
      user: {
        id: 'user-1',
        email: 'ana@example.com',
        name: 'Ana',
        plan: 'FREE',
      },
      getValidToken: jest.fn(),
      refreshCurrentUser,
      logout: jest.fn(),
    }
    window.history.pushState({}, '', '/?billing=success')
    useAuth.mockReturnValue(initialAuth)

    const { rerender } = render(<App />)

    await waitFor(() => {
      expect(refreshCurrentUser).toHaveBeenCalledTimes(1)
    })

    fireEvent.click(screen.getByRole('button', {
      name: /manage account for ana, ana@example.com/i,
    }))
    expect(screen.getByRole('button', { name: /upgrade to pro/i })).toBeEnabled()

    useAuth.mockReturnValue({
      ...initialAuth,
      refreshCurrentUser: jest.fn(),
    })
    rerender(<App />)

    await act(async () => {
      resolveRefresh(initialAuth.user)
    })

    expect(screen.getByRole('button', { name: /upgrade to pro/i })).toBeEnabled()
  })

  test('shows a non-error notice after cancelled checkout without refreshing the user', () => {
    const refreshCurrentUser = jest.fn()
    window.history.pushState({}, '', '/?billing=cancelled')
    useAuth.mockReturnValue({
      isAuthenticated: true,
      isVisitor: false,
      isLoading: false,
      error: null,
      user: {
        id: 'user-1',
        email: 'ana@example.com',
        name: 'Ana',
        plan: 'FREE',
      },
      getValidToken: jest.fn(),
      refreshCurrentUser,
      logout: jest.fn(),
    })

    render(<App />)

    expect(screen.getByText(/Checkout cancelled/i)).toBeInTheDocument()
    expect(screen.getByText(/No changes were made/i)).toBeInTheDocument()
    expect(refreshCurrentUser).not.toHaveBeenCalled()
    expect(window.location.search).toBe('')

    fireEvent.click(screen.getByRole('button', { name: /dismiss billing notification/i }))
    expect(screen.queryByText(/Checkout cancelled/i)).not.toBeInTheDocument()
  })

  test('renders the resolved MP4 and poster as homepage hero media', () => {
    useHomeContent.mockReturnValue({
      hero: {
        heroVideo: 'https://www.youtube-nocookie.com/embed/example',
      },
      tours: [],
      birds: [],
      transfers: [],
      isLoading: false,
      error: null,
    })
    useAuth.mockReturnValue({
      isAuthenticated: false,
      isVisitor: false,
      isLoading: false,
      error: null,
      login: jest.fn(),
      signup: jest.fn(),
      enterAsVisitor: jest.fn(),
    })

    render(<App />)

    const video = document.querySelector('video.home-hero-video')
    const source = video.querySelector('source')

    expect(useResolvedMediaUrl).toHaveBeenCalledWith('resources/home-hero.mp4')
    expect(useResolvedMediaUrl).toHaveBeenCalledWith('resources/poster.jpg')
    expect(source).toHaveAttribute('src', 'https://example.test/resources/home-hero.mp4')
    expect(source).toHaveAttribute('type', 'video/mp4')
    expect(video).toHaveAttribute('poster', 'https://example.test/resources/poster.jpg')
    expect(video.autoplay).toBe(true)
    expect(video.muted).toBe(true)
    expect(video.loop).toBe(true)
    expect(video.playsInline).toBe(true)
    expect(video).toHaveAttribute('preload', 'metadata')
  })

  test('reveals hero content 15 seconds after the MP4 can play', () => {
    jest.useFakeTimers()
    let unmount

    try {
      useHomeContent.mockReturnValue({
        hero: {
          heroVideo: 'https://www.youtube-nocookie.com/embed/example?start=54&end=84',
        },
        tours: [],
        birds: [],
        transfers: [],
        isLoading: false,
        error: null,
      })
      useAuth.mockReturnValue({
        isAuthenticated: false,
        isVisitor: false,
        isLoading: false,
        error: null,
        login: jest.fn(),
        signup: jest.fn(),
        enterAsVisitor: jest.fn(),
      })

      const renderResult = render(<App />)
      unmount = renderResult.unmount

      const video = document.querySelector('video.home-hero-video')
      const heroContent = screen
        .getByRole('heading', { name: /Find your way into the wild/i })
        .closest('.home-hero-content')

      expect(heroContent).toHaveClass('is-pending')

      fireEvent.canPlay(video)

      act(() => {
        jest.advanceTimersByTime(14999)
      })

      expect(heroContent).toHaveClass('is-pending')

      act(() => {
        jest.advanceTimersByTime(1)
      })

      expect(heroContent).toHaveClass('is-visible')

      act(() => {
        jest.advanceTimersByTime(30000)
      })

      expect(heroContent).toHaveClass('is-visible')
      expect(document.querySelector('video.home-hero-video')).toBe(video)
    } finally {
      unmount?.()
      jest.useRealTimers()
    }
  })

  test('opens the existing auth flow in a homepage modal', () => {
    useAuth.mockReturnValue({
      isAuthenticated: false,
      isVisitor: false,
      isLoading: false,
      error: null,
      login: jest.fn(),
      signup: jest.fn(),
      enterAsVisitor: jest.fn(),
    })

    render(<App />)

    fireEvent.click(screen.getAllByRole('button', { name: /^Login$/i })[0])

    const dialog = screen.getByRole('dialog', { name: /welcome back/i })
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Find your way into the wild/i })).toBeInTheDocument()
  })

  test('dismisses the login modal without leaving the homepage', () => {
    useAuth.mockReturnValue({
      isAuthenticated: false,
      isVisitor: false,
      isLoading: false,
      error: null,
      login: jest.fn(),
      signup: jest.fn(),
      enterAsVisitor: jest.fn(),
    })

    render(<App />)

    fireEvent.click(screen.getAllByRole('button', { name: /^Login$/i })[0])
    fireEvent.click(screen.getByRole('button', { name: /close login/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Find your way into the wild/i })).toBeInTheDocument()
  })

  test('submits login from the modal and stays on the homepage', async () => {
    const login = jest.fn().mockResolvedValue({
      token: 'stored-token',
      user: {
        id: 'user-1',
        email: 'ana@example.com',
        role: 'customer',
      },
    })
    useAuth.mockReturnValue({
      isAuthenticated: false,
      isVisitor: false,
      isLoading: false,
      error: null,
      login,
      signup: jest.fn(),
      enterAsVisitor: jest.fn(),
    })

    render(<App />)

    fireEvent.click(screen.getAllByRole('button', { name: /^Login$/i })[0])
    const dialog = screen.getByRole('dialog', { name: /welcome back/i })
    fireEvent.change(within(dialog).getByLabelText(/email/i), {
      target: { value: 'ana@example.com' },
    })
    fireEvent.change(within(dialog).getByLabelText(/password/i), {
      target: { value: 'secure-password' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: /^log in$/i }))

    await waitFor(() => expect(login).toHaveBeenCalledWith({
      email: 'ana@example.com',
      password: 'secure-password',
    }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Find your way into the wild/i })).toBeInTheDocument()
  })

  test('opens visitor chat in the homepage drawer from the login modal', async () => {
    let isVisitor = false
    const enterAsVisitor = jest.fn(() => {
      isVisitor = true
    })
    useAuth.mockImplementation(() => ({
      isAuthenticated: false,
      isVisitor,
      isLoading: false,
      error: null,
      token: null,
      user: isVisitor ? { id: 'visitor', name: 'Visitor', role: 'visitor' } : null,
      login: jest.fn(),
      signup: jest.fn(),
      enterAsVisitor,
      logout: jest.fn(),
    }))
    useChat.mockReturnValue({
      messages: [],
      isLoading: false,
      isStreaming: false,
      error: null,
      customerContext: null,
      conversationContext: {},
      setCustomerContext: jest.fn(),
      sendMessage: jest.fn(),
      stopGenerating: jest.fn(),
    })

    render(<App />)

    fireEvent.click(screen.getAllByRole('button', { name: /^Login$/i })[0])
    fireEvent.click(screen.getByRole('button', { name: /continue as visitor/i }))

    expect(enterAsVisitor).toHaveBeenCalledTimes(1)
    const drawer = await screen.findByRole('dialog', { name: /plan your birding chat/i })
    expect(within(drawer).getByText(/Visitor mode is for bird questions only/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Find your way into the wild/i })).toBeInTheDocument()
  })

  test('preserves signup switching inside the login modal', () => {
    useAuth.mockReturnValue({
      isAuthenticated: false,
      isVisitor: false,
      isLoading: false,
      error: null,
      login: jest.fn(),
      signup: jest.fn(),
      enterAsVisitor: jest.fn(),
    })

    render(<App />)

    fireEvent.click(screen.getAllByRole('button', { name: /^Login$/i })[0])
    fireEvent.click(screen.getByRole('button', { name: /Need an account/i }))

    expect(screen.getByRole('dialog', { name: /create your account/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/Name \(optional\)/i)).toBeInTheDocument()
  })

  test('shows authenticated homepage logout and hides duplicate login CTAs', () => {
    const logout = jest.fn()
    useAuth.mockReturnValue({
      isAuthenticated: true,
      isVisitor: false,
      isLoading: false,
      error: null,
      token: 'stored-token',
      user: {
        id: 'user-1',
        email: 'ana@example.com',
        name: 'Ana Gomez',
        role: 'customer',
      },
      logout,
      enterAsVisitor: jest.fn(),
    })

    render(<App />)

    const accountButton = screen.getByRole('button', {
      name: /manage account for ana gomez, ana@example.com/i,
    })

    expect(accountButton).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Login$/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/Log in to save your itinerary/i)).not.toBeInTheDocument()

    fireEvent.click(accountButton)
    fireEvent.click(screen.getByRole('button', { name: /^Logout$/i }))

    expect(logout).toHaveBeenCalledTimes(1)
  })

  test('adds a featured tour to the cart immediately for authenticated users', async () => {
    const addTour = jest.fn().mockResolvedValue({})
    const featuredTour = {
      id: 12,
      zone: 'Cloud forest',
      rank: 1,
      name: 'Monteverde Dawn Chorus',
      title: 'Monteverde Dawn Chorus',
      description: 'Cloud forest birding.',
      location: 'Monteverde',
      node: 'Monteverde',
      duration: '4 hours',
      difficulty: 'Moderate',
      pricePerPerson: 120,
      portraitUrl: null,
      birds: [],
    }
    useHomeContent.mockReturnValue({
      hero: null,
      tours: [featuredTour],
      birds: [],
      transfers: [],
      isLoading: false,
      error: null,
    })
    useCart.mockReturnValue({
      cart: {
        itineraryStartDate: null,
        itineraryEndDate: null,
        items: [],
        count: 0,
      },
      reservations: [],
      isLoading: false,
      error: null,
      refresh: jest.fn(),
      refreshMyTours: jest.fn().mockResolvedValue([]),
      saveItinerary: jest.fn(),
      addTour,
      updateItem: jest.fn(),
      removeItem: jest.fn(),
      createReservations: jest.fn(),
      createItemReservation: jest.fn(),
    })
    useAuth.mockReturnValue({
      isAuthenticated: true,
      isVisitor: false,
      isLoading: false,
      error: null,
      token: 'stored-token',
      user: {
        id: 'user-1',
        email: 'ana@example.com',
        name: 'Ana Gomez',
        role: 'customer',
      },
      getValidToken: jest.fn().mockResolvedValue('stored-token'),
      logout: jest.fn(),
      enterAsVisitor: jest.fn(),
    })
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /add monteverde dawn chorus to tour cart/i }))

    await waitFor(() => expect(addTour).toHaveBeenCalledWith(featuredTour))
    expect(screen.getByRole('dialog', { name: /your selected tours/i })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: /update your itinerary/i })).not.toBeInTheDocument()
  })

  test('shows add-to-cart loading while the selected tour is being added', async () => {
    let resolveAddTour
    const addTour = jest.fn().mockImplementation(() => new Promise((resolve) => {
      resolveAddTour = resolve
    }))
    const featuredTour = {
      id: 14,
      zone: 'Cloud forest',
      rank: 1,
      name: 'Slow Cart Tour',
      title: 'Slow Cart Tour',
      description: 'Cloud forest birding.',
      location: 'Monteverde',
      node: 'Monteverde',
      duration: '4 hours',
      difficulty: 'Moderate',
      pricePerPerson: 120,
      portraitUrl: null,
      birds: [],
    }
    useHomeContent.mockReturnValue({
      hero: null,
      tours: [featuredTour],
      birds: [],
      transfers: [],
      isLoading: false,
      error: null,
    })
    useCart.mockReturnValue({
      cart: {
        itineraryStartDate: null,
        itineraryEndDate: null,
        items: [],
        count: 0,
      },
      reservations: [],
      isLoading: false,
      error: null,
      refresh: jest.fn(),
      refreshMyTours: jest.fn().mockResolvedValue([]),
      saveItinerary: jest.fn(),
      addTour,
      updateItem: jest.fn(),
      removeItem: jest.fn(),
      createReservations: jest.fn(),
      createItemReservation: jest.fn(),
    })
    useAuth.mockReturnValue({
      isAuthenticated: true,
      isVisitor: false,
      isLoading: false,
      error: null,
      token: 'stored-token',
      user: {
        id: 'user-1',
        email: 'ana@example.com',
        name: 'Ana Gomez',
        role: 'customer',
      },
      getValidToken: jest.fn().mockResolvedValue('stored-token'),
      logout: jest.fn(),
      enterAsVisitor: jest.fn(),
    })
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /add slow cart tour to tour cart/i }))

    expect(await screen.findByRole('button', { name: /adding slow cart tour to tour cart/i })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /adding slow cart tour to tour cart/i }))
    expect(addTour).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveAddTour({})
    })
  })

  test('removes an added featured tour using the matching cart item id', async () => {
    const removeItem = jest.fn().mockResolvedValue({})
    const featuredTour = {
      id: 17,
      zone: 'Cloud forest',
      rank: 1,
      name: 'Removable Tour',
      title: 'Removable Tour',
      description: 'Cloud forest birding.',
      location: 'Monteverde',
      node: 'Monteverde',
      duration: '4 hours',
      difficulty: 'Moderate',
      pricePerPerson: 120,
      portraitUrl: null,
      birds: [],
    }
    useHomeContent.mockReturnValue({
      hero: null,
      tours: [featuredTour],
      birds: [],
      transfers: [],
      isLoading: false,
      error: null,
    })
    useCart.mockReturnValue({
      cart: {
        itineraryStartDate: null,
        itineraryEndDate: null,
        items: [{ id: 99, tourId: 17 }],
        count: 1,
      },
      reservations: [],
      isLoading: false,
      error: null,
      refresh: jest.fn(),
      refreshMyTours: jest.fn().mockResolvedValue([]),
      saveItinerary: jest.fn(),
      addTour: jest.fn(),
      updateItem: jest.fn(),
      removeItem,
      createReservations: jest.fn(),
      createItemReservation: jest.fn(),
    })
    useAuth.mockReturnValue({
      isAuthenticated: true,
      isVisitor: false,
      isLoading: false,
      error: null,
      token: 'stored-token',
      user: {
        id: 'user-1',
        email: 'ana@example.com',
        name: 'Ana Gomez',
        role: 'customer',
      },
      getValidToken: jest.fn().mockResolvedValue('stored-token'),
      logout: jest.fn(),
      enterAsVisitor: jest.fn(),
    })
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /remove removable tour from tour cart/i }))

    await waitFor(() => expect(removeItem).toHaveBeenCalledWith(99))
  })

  test('shows remove loading while an added featured tour is being removed', async () => {
    let resolveRemoveItem
    const removeItem = jest.fn().mockImplementation(() => new Promise((resolve) => {
      resolveRemoveItem = resolve
    }))
    const featuredTour = {
      id: 18,
      zone: 'Cloud forest',
      rank: 1,
      name: 'Slow Remove Tour',
      title: 'Slow Remove Tour',
      description: 'Cloud forest birding.',
      location: 'Monteverde',
      node: 'Monteverde',
      duration: '4 hours',
      difficulty: 'Moderate',
      pricePerPerson: 120,
      portraitUrl: null,
      birds: [],
    }
    useHomeContent.mockReturnValue({
      hero: null,
      tours: [featuredTour],
      birds: [],
      transfers: [],
      isLoading: false,
      error: null,
    })
    useCart.mockReturnValue({
      cart: {
        itineraryStartDate: null,
        itineraryEndDate: null,
        items: [{ id: 101, tourId: 18 }],
        count: 1,
      },
      reservations: [],
      isLoading: false,
      error: null,
      refresh: jest.fn(),
      refreshMyTours: jest.fn().mockResolvedValue([]),
      saveItinerary: jest.fn(),
      addTour: jest.fn(),
      updateItem: jest.fn(),
      removeItem,
      createReservations: jest.fn(),
      createItemReservation: jest.fn(),
    })
    useAuth.mockReturnValue({
      isAuthenticated: true,
      isVisitor: false,
      isLoading: false,
      error: null,
      token: 'stored-token',
      user: {
        id: 'user-1',
        email: 'ana@example.com',
        name: 'Ana Gomez',
        role: 'customer',
      },
      getValidToken: jest.fn().mockResolvedValue('stored-token'),
      logout: jest.fn(),
      enterAsVisitor: jest.fn(),
    })

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /remove slow remove tour from tour cart/i }))

    expect(await screen.findByRole('button', { name: /removing slow remove tour from tour cart/i })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /removing slow remove tour from tour cart/i }))
    expect(removeItem).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveRemoveItem({})
    })
  })

  test('logged-out reserve action opens the login flow', () => {
    const featuredTour = {
      id: 15,
      zone: 'Cloud forest',
      rank: 1,
      name: 'Guest Reserve Tour',
      title: 'Guest Reserve Tour',
      description: 'Cloud forest birding.',
      location: 'Monteverde',
      node: 'Monteverde',
      duration: '4 hours',
      difficulty: 'Moderate',
      pricePerPerson: 120,
      portraitUrl: null,
      birds: [],
    }
    useHomeContent.mockReturnValue({
      hero: null,
      tours: [featuredTour],
      birds: [],
      transfers: [],
      isLoading: false,
      error: null,
    })
    useAuth.mockReturnValue({
      isAuthenticated: false,
      isVisitor: false,
      isLoading: false,
      error: null,
      login: jest.fn(),
      signup: jest.fn(),
      enterAsVisitor: jest.fn(),
    })

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /book tour: guest reserve tour/i }))

    expect(screen.getByRole('dialog', { name: /welcome back/i })).toBeInTheDocument()
  })

  test('logged-in Book Tour opens the homepage drawer with the exact selected tour', async () => {
    const addTour = jest.fn().mockResolvedValue({})
    const featuredTour = {
      id: 16,
      zone: 'Cloud forest',
      rank: 1,
      name: 'Direct Reserve Tour',
      title: 'Direct Reserve Tour',
      description: 'Cloud forest birding.',
      location: 'Monteverde',
      node: 'Monteverde',
      duration: '4 hours',
      difficulty: 'Moderate',
      pricePerPerson: 120,
      portraitUrl: null,
      birds: [],
    }
    useHomeContent.mockReturnValue({
      hero: null,
      tours: [featuredTour],
      birds: [],
      transfers: [],
      isLoading: false,
      error: null,
    })
    useCart.mockReturnValue({
      cart: {
        itineraryStartDate: '2026-09-10',
        itineraryEndDate: '2026-09-12',
        items: [],
        count: 0,
      },
      reservations: [],
      isLoading: false,
      error: null,
      refresh: jest.fn(),
      refreshMyTours: jest.fn().mockResolvedValue([]),
      saveItinerary: jest.fn(),
      addTour,
      updateItem: jest.fn(),
      removeItem: jest.fn(),
      createReservations: jest.fn(),
      createItemReservation: jest.fn(),
    })
    useAuth.mockReturnValue({
      isAuthenticated: true,
      isVisitor: false,
      isLoading: false,
      error: null,
      token: 'stored-token',
      user: {
        id: 'user-1',
        email: 'ana@example.com',
        name: 'Ana Gomez',
        role: 'customer',
      },
      getValidToken: jest.fn().mockResolvedValue('stored-token'),
      logout: jest.fn(),
      enterAsVisitor: jest.fn(),
    })
    useChat.mockReturnValue({
      messages: [],
      isLoading: false,
      isStreaming: false,
      error: null,
      customerContext: {
        customerName: 'Ana Gomez',
        customerEmail: 'ana@example.com',
      },
      conversationContext: {},
      setCustomerContext: jest.fn(),
      sendMessage: jest.fn(),
      stopGenerating: jest.fn(),
    })

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /book tour: direct reserve tour/i }))

    expect(addTour).not.toHaveBeenCalled()
    const drawer = await screen.findByRole('dialog', { name: /reserve this tour/i })
    expect(screen.getByRole('heading', { name: /Find your way into the wild/i })).toBeInTheDocument()
    expect(within(drawer).getByRole('complementary', { name: /selected tour/i })).toHaveTextContent('Direct Reserve Tour')
    expect(useChat).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'stored-token',
      }),
      expect.objectContaining({
        isEphemeral: false,
        initialMessage: 'I would like to reserve Direct Reserve Tour.',
        initialCustomerContext: expect.objectContaining({
          customerName: 'Ana Gomez',
          customerEmail: 'ana@example.com',
          itineraryStartDate: '2026-09-10',
          itineraryEndDate: '2026-09-12',
        }),
        initialConversationContext: expect.objectContaining({
          conversationType: 'reservation_entry',
          conversationSource: 'featured_tour',
          selectedTour: expect.objectContaining({
            tourId: 16,
            name: 'Direct Reserve Tour',
            location: 'Monteverde',
          }),
          selectedTourId: 16,
        }),
      })
    )

    fireEvent.click(within(drawer).getByRole('button', { name: /close chat/i }))
    expect(screen.queryByRole('dialog', { name: /reserve this tour/i })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Find your way into the wild/i })).toBeInTheDocument()
  })

  test('opens cart reservations in the homepage drawer with structured cart context', async () => {
    const cartItem = {
      id: 201,
      tourId: 27,
      scheduledDate: '2026-09-11',
      participants: 2,
      needsTransfer: true,
      tour: {
        id: 27,
        name: 'Cart Canopy Tour',
        location: 'Sarapiqui',
        pricePerPerson: 95,
      },
    }
    useCart.mockReturnValue({
      cart: {
        itineraryStartDate: '2026-09-10',
        itineraryEndDate: '2026-09-12',
        items: [cartItem],
        count: 1,
      },
      reservations: [],
      isLoading: false,
      error: null,
      refresh: jest.fn(),
      refreshMyTours: jest.fn().mockResolvedValue([]),
      saveItinerary: jest.fn(),
      addTour: jest.fn(),
      updateItem: jest.fn(),
      removeItem: jest.fn(),
      createReservations: jest.fn(),
      createItemReservation: jest.fn(),
    })
    useAuth.mockReturnValue({
      isAuthenticated: true,
      isVisitor: false,
      isLoading: false,
      error: null,
      token: 'stored-token',
      user: {
        id: 'user-1',
        email: 'ana@example.com',
        name: 'Ana Gomez',
        role: 'customer',
      },
      getValidToken: jest.fn().mockResolvedValue('stored-token'),
      logout: jest.fn(),
      enterAsVisitor: jest.fn(),
    })
    useChat.mockReturnValue({
      messages: [],
      isLoading: false,
      isStreaming: false,
      error: null,
      customerContext: {
        customerName: 'Ana Gomez',
        customerEmail: 'ana@example.com',
      },
      conversationContext: {},
      setCustomerContext: jest.fn(),
      sendMessage: jest.fn(),
      stopGenerating: jest.fn(),
    })

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /open tour cart, 1 selected tour/i }))
    fireEvent.click(within(screen.getByRole('dialog', { name: /your selected tours/i }))
      .getByRole('button', { name: /reserve cart/i }))

    const drawer = await screen.findByRole('dialog', { name: /reserve selected tours/i })
    expect(drawer).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Find your way into the wild/i })).toBeInTheDocument()
    expect(useChat).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'stored-token' }),
      expect.objectContaining({
        isEphemeral: false,
        initialMessage: 'I would like to reserve 1 tour from my cart.',
        initialCustomerContext: expect.objectContaining({
          customerName: 'Ana Gomez',
          customerEmail: 'ana@example.com',
          itineraryStartDate: '2026-09-10',
          itineraryEndDate: '2026-09-12',
        }),
        initialConversationContext: expect.objectContaining({
          conversationType: 'reservation_entry',
          conversationSource: 'tour_cart',
          tours: [expect.objectContaining({
            itemId: 201,
            tourId: 27,
            name: 'Cart Canopy Tour',
            scheduledDate: '2026-09-11',
            participants: 2,
            needsTransfer: true,
          })],
        }),
      })
    )
  })

  test('shows visitor homepage logout action', () => {
    const logout = jest.fn()
    useAuth.mockReturnValue({
      isAuthenticated: false,
      isVisitor: true,
      isLoading: false,
      error: null,
      token: null,
      user: {
        id: 'visitor',
        name: 'Visitor',
        role: 'visitor',
      },
      logout,
      enterAsVisitor: jest.fn(),
    })

    render(<App />)

    expect(screen.getByRole('button', { name: /^Logout$/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^Logout$/i }))

    expect(logout).toHaveBeenCalledTimes(1)
  })

})
