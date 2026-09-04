import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { loadBirdProfile } from '../../api/homeApi'
import BirdMediaCard from '../BirdMediaCard'
import { useResolvedMedia } from '../../hooks/useResolvedMediaUrl'
import { displayTourType } from '../../constants/tourTypes'
import { appendMediaVersion } from '../../api/mediaApi'
import { formatTourDuration } from '../../utils/tourDuration'

const TOURS_PER_PAGE = 4
const AUTO_PAGINATION_INTERVAL_MS = 15000
const TOUR_IMAGE_PATH_PATTERN = /^tours\/(?:[1-9]\d*(?:\.png)?|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png)$/

function getTourPortraitReference(tour) {
  const storedPath = typeof tour.imagePath === 'string'
    ? tour.imagePath.trim().replace(/^\/+/, '').replace(/^files\/+/, '')
    : ''

  // A persisted image path is authoritative. Never render a potentially stale
  // portrait URL when the API also supplies a different database-backed path.
  if (storedPath) {
    if (!TOUR_IMAGE_PATH_PATTERN.test(storedPath)) return ''
    const canonicalPath = /^tours\/[1-9]\d*$/.test(storedPath)
      ? `${storedPath}.png`
      : storedPath
    const encodedPath = canonicalPath.split('/').map(encodeURIComponent).join('/')
    return appendMediaVersion(
      `/files/${encodedPath}`,
      tour.portraitVersion || tour.imageVersion,
    )
  }

  return appendMediaVersion(
    tour.portraitUrl,
    tour.portraitVersion || tour.imageVersion,
  )
}

function normalizeSearchText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function editDistance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex]
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      )
    }
    previous.splice(0, previous.length, ...current)
  }
  return previous[right.length]
}

function matchesApproximateSearch(tour, query) {
  const queryTokens = normalizeSearchText(query).split(/\s+/).filter(Boolean)
  if (!queryTokens.length) return true
  const haystack = normalizeSearchText([
    tour.name, tour.title, tour.location, tour.region, tour.zone, tour.node, tour.subnode,
    tour.description, tour.type, tour.tourType,
    ...(tour.birds || []).flatMap((bird) => [bird.name, bird.commonName, bird.tags?.join(' ')]),
  ].filter(Boolean).join(' '))
  const words = haystack.split(/[^a-z0-9]+/).filter(Boolean)
  return queryTokens.every((token) => haystack.includes(token)
    || (token.length >= 4 && words.some((word) => Math.abs(word.length - token.length) <= 2
      && editDistance(word, token) <= 2)))
}

function getCostaRicaCalendarDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${byType.year}-${byType.month}-${byType.day}`
}

function isTourEligible(tour) {
  if (tour.isActive === false || tour.ownerStatus === 'suspended') return false
  if ((tour.tourType || 'unscheduled') !== 'scheduled') {
    return Number(tour.maxParticipants ?? tour.availableSlots ?? 1) > 0
  }
  const today = getCostaRicaCalendarDate()
  const startDate = tour.startDate || tour.start_date
  if (!startDate || today >= startDate) return false
  const occurrences = Array.isArray(tour.occurrenceDates) ? tour.occurrenceDates : []
  return Number(tour.availableSlots) > 0 && occurrences.some((item) => (
    item.status === 'scheduled' && item.date >= today && Number(item.remainingSpaces) > 0
  ))
}

function formatPrice(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value) {
  if (!value) {
    return null
  }

  const dateOnlyMatch = typeof value === 'string'
    ? value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    : null
  const date = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function formatTourDates(tour) {
  const startDate = formatDate(tour.start_date || tour.startDate)
  const endDate = formatDate(tour.end_date || tour.endDate)

  if (startDate && endDate) {
    return `${startDate} to ${endDate}`
  }

  if (startDate) {
    return `From ${startDate}`
  }

  if (endDate) {
    return `Until ${endDate}`
  }

  return null
}

function formatTourLocation(tour) {
  return [
    tour.location,
    tour.node && tour.node !== tour.location ? tour.node : null,
    tour.subnode,
    tour.zone,
    tour.region,
  ].filter(Boolean)[0]
}

function formatTourNode(tour) {
  return tour.subnode || tour.node || tour.location
}

function getTourRank(tour) {
  if (tour.rank === null || tour.rank === undefined || tour.rank === '') return Number.MAX_SAFE_INTEGER
  const rank = Number(tour.rank)
  return Number.isFinite(rank) ? rank : Number.MAX_SAFE_INTEGER
}

function getZoneRank(tour) {
  if (tour.zoneRank === null || tour.zoneRank === undefined || tour.zoneRank === '') return Number.MAX_SAFE_INTEGER
  const rank = Number(tour.zoneRank)
  return Number.isFinite(rank) ? rank : Number.MAX_SAFE_INTEGER
}

function getTourKey(tour) {
  return tour.id || tour.tourId || tour.name || tour.title
}

function getTourId(tour) {
  return tour.id || tour.tourId
}

function getBirdSpeciesCode(bird) {
  return bird?.species_code || bird?.speciesCode
}

function getBirdName(bird) {
  return bird?.name || bird?.commonName || bird?.scientificName || 'Bird'
}

function ReserveTourIcon() {
  return (
    <svg
      className="tour-reserve-action-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="4" y="5" width="16" height="16" rx="3" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
      <path d="M4 10h16" />
      <path d="m8.3 15.1 2.4 2.4 5-5" />
    </svg>
  )
}

function RemoveFromCartIcon() {
  return (
    <svg
      className="tour-remove-action-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6 7h12" />
      <path d="M10 7V5h4v2" />
      <path d="M8 7l1 14h6l1-14" />
      <path d="M10.5 12.5h3" />
    </svg>
  )
}

function TourImageOverlay({ titleId, tour }) {
  const tourName = tour.name || tour.title || 'Featured tour'
  const price = formatPrice(tour.pricePerPerson)

  return (
    <div className="tour-card-overlay" aria-label="Tour summary">
      {tour.type && <span className="tour-type-badge">{displayTourType(tour.type)}</span>}
      <h3 id={titleId} className="tour-card-overlay-title">{tourName}</h3>
      {price && (
        <p className="tour-card-overlay-price">
          <strong>{price}</strong>
          <span> / person</span>
        </p>
      )}
    </div>
  )
}

function groupToursByZone(tours) {
  const groups = new Map()

  tours.forEach((tour) => {
    const zone = tour.zone || 'Featured tours'

    if (!groups.has(zone)) {
      groups.set(zone, [])
    }

    groups.get(zone).push(tour)
  })

  return Array.from(groups, ([zone, zoneTours]) => ({
    zone,
    zoneRank: Math.min(...zoneTours.map(getZoneRank)),
    tours: zoneTours
      .slice()
      .sort((left, right) => getTourRank(left) - getTourRank(right)
        || String(getTourId(left) ?? getTourKey(left)).localeCompare(String(getTourId(right) ?? getTourKey(right)))),
  })).sort((left, right) => left.zoneRank - right.zoneRank || left.zone.localeCompare(right.zone))
}

function TourCard({
  agentBookingEnabled = true,
  bookingUnavailableMessage = '',
  isAdded = false,
  isAdding = false,
  isCartEnabled = false,
  isRemoving = false,
  isReserving = false,
  onRemoveFromCart,
  onAddToCart,
  onMoreInfo,
  onReserveTour,
  tour,
}) {
  const titleId = useId()
  const [portraitFailed, setPortraitFailed] = useState(false)
  const portraitReference = getTourPortraitReference(tour)
  const portraitMedia = useResolvedMedia(portraitReference)
  const portraitUrl = portraitMedia.url
  const isPortraitPending = Boolean(portraitReference && portraitMedia.isResolving && !portraitFailed)
  const isPortraitUnavailable = Boolean(portraitMedia.error || portraitFailed)
  const tourName = tour.title || tour.name || 'Featured tour'
  const isPrimaryActionBusy = isAdding || isRemoving
  const primaryActionLabel = isRemoving
    ? 'Removing...'
    : isAdding
      ? 'Adding...'
      : isAdded ? 'Added to cart' : 'Add to cart'
  const primaryActionAriaLabel = isRemoving
    ? `Removing ${tourName} from tour cart`
    : isAdding
      ? `Adding ${tourName} to tour cart`
      : isAdded ? `Remove ${tourName} from tour cart` : `Add ${tourName} to tour cart`

  useEffect(() => {
    setPortraitFailed(false)
  }, [portraitReference])

  return (
    <article className="home-card tour-card" aria-labelledby={titleId}>
      <div
        className="tour-card-image-shell"
        aria-label={`${tourName} image and summary`}
      >
        {portraitUrl && !isPortraitUnavailable ? (
          <img
            src={portraitUrl}
            alt=""
            className="home-card-image"
            loading="eager"
            decoding="async"
            onError={() => setPortraitFailed(true)}
          />
        ) : isPortraitPending ? (
          <div className="home-card-image home-card-image-loading" role="status">
            Loading image...
          </div>
        ) : (
          <div className="home-card-image" aria-hidden="true" />
        )}
        <TourImageOverlay titleId={titleId} tour={tour} />
      </div>
      <div className="home-card-body">
        {tour.description && <p className="tour-card-description">{tour.description}</p>}
        <div className="tour-card-actions">
          <button
            type="button"
            className={isAdded ? 'tour-card-action tour-remove-action' : 'tour-card-action'}
            aria-label={primaryActionAriaLabel}
            disabled={isPrimaryActionBusy}
            onClick={() => {
              if (isAdded) {
                onRemoveFromCart?.(tour)
                return
              }

              onAddToCart?.(tour)
            }}
          >
            {isAdded ? (
              <RemoveFromCartIcon />
            ) : (
              <span className="tour-cart-action-icon" aria-hidden="true">
                <span />
              </span>
            )}
            <span>{primaryActionLabel}</span>
          </button>
          <button
              type="button"
              className="tour-card-action tour-reserve-action"
              aria-label={isReserving ? `Preparing ${tourName} reservation` : `Book Tour: ${tourName}`}
              disabled={!agentBookingEnabled || isReserving}
              title={!agentBookingEnabled ? bookingUnavailableMessage : undefined}
              onClick={() => onReserveTour?.(tour)}
            >
              <ReserveTourIcon />
              <span>{!agentBookingEnabled ? 'Booking unavailable' : isReserving ? 'Preparing...' : 'Book Tour'}</span>
            </button>
          <button
            type="button"
            className="tour-card-action tour-more-info-action"
            aria-label={`More information about ${tourName}`}
            onClick={(event) => onMoreInfo?.(tour, event.currentTarget)}
          >
            More Info
          </button>
        </div>
      </div>
    </article>
  )
}

function TourDetailsDialog({ closeButtonRef, dialogRef, onClose, onOpenBird, tour }) {
  const tourName = tour.name || tour.title || 'Featured tour'
  const dates = formatTourDates(tour)
  const price = formatPrice(tour.pricePerPerson)
  const location = formatTourLocation(tour)
  const tourArea = formatTourNode(tour)
  const duration = formatTourDuration(tour)
  const birds = Array.isArray(tour.birds) ? tour.birds.filter(Boolean) : []
  const details = [
    { label: 'Tour type', value: tour.type ? displayTourType(tour.type) : null },
    { label: 'Location', value: location },
    { label: 'Tour area', value: tourArea && tourArea !== location ? tourArea : null },
    { label: 'Duration', value: duration },
    { label: 'Difficulty', value: tour.difficulty },
    { label: 'Price per person', value: price },
    { label: 'Dates', value: dates },
    {
      label: 'Availability',
      value: tour.availableSlots === null || tour.availableSlots === undefined
        ? null
        : `${tour.availableSlots} places available`,
    },
    {
      label: 'Maximum participants',
      value: tour.maxParticipants === null || tour.maxParticipants === undefined
        ? null
        : String(tour.maxParticipants),
    },
  ].filter((detail) => detail.value)

  return createPortal(
    <div className="bird-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        ref={dialogRef}
        className="tour-details-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-details-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          ref={closeButtonRef}
          className="bird-modal-close"
          type="button"
          aria-label="Close tour details"
          onClick={onClose}
        >
          x
        </button>
        <div className="tour-details-heading">
          {tour.type && <span className="tour-type-badge">{displayTourType(tour.type)}</span>}
          <h2 id="tour-details-title">{tourName}</h2>
          {tour.description && <p>{tour.description}</p>}
        </div>
        {details.length > 0 && (
          <dl className="tour-details-list">
            {details.map((detail) => (
              <div key={detail.label}>
                <dt>{detail.label}</dt>
                <dd>{detail.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {birds.length > 0 && (
          <div className="tour-details-birds">
            <h3>Key birds</h3>
            <div>
              {birds.map((bird, index) => {
                const birdName = getBirdName(bird)
                return (
                  <button
                    key={`${birdName}-${index}`}
                    type="button"
                    aria-label={`Open ${birdName} details`}
                    onClick={(event) => onOpenBird(bird, event.currentTarget)}
                  >
                    {birdName}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </section>
    </div>,
    document.body,
  )
}

function FeaturedTours({
  agentBookingEnabled = true,
  bookingUnavailableMessage = '',
  addedTourIds = [],
  addingTourIds = [],
  isCartEnabled = false,
  removingTourIds = [],
  reservingTourIds = [],
  tours,
  isLoading,
  error,
  onAddToCart,
  onRemoveFromCart,
  onRetry,
  onReserveTour,
}) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [birdModal, setBirdModal] = useState(null)
  const [tourDetails, setTourDetails] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [paginationDirection, setPaginationDirection] = useState('next')
  const [isAutoPaginationPaused, setIsAutoPaginationPaused] = useState(false)
  const [isPointerWithinTours, setIsPointerWithinTours] = useState(false)
  const [isFocusWithinTours, setIsFocusWithinTours] = useState(false)
  const birdCloseButtonRef = useRef(null)
  const birdOpenerRef = useRef(null)
  const tourDetailsCloseButtonRef = useRef(null)
  const tourDetailsDialogRef = useRef(null)
  const tourDetailsOpenerRef = useRef(null)
  const birdRequestIdRef = useRef(0)
  const filteredTours = useMemo(() => tours.filter((tour) => (
    isTourEligible(tour)
    && matchesApproximateSearch(tour, searchQuery)
  )), [searchQuery, tours])
  const tourGroups = useMemo(() => groupToursByZone(filteredTours), [filteredTours])
  const orderedTours = useMemo(() => tourGroups.flatMap((group) => group.tours), [tourGroups])
  const pageCount = Math.ceil(orderedTours.length / TOURS_PER_PAGE)
  const lastPageIndex = Math.max((pageCount - 1) * TOURS_PER_PAGE, 0)
  const safePageIndex = Math.min(currentPageIndex, lastPageIndex)
  const visibleTours = useMemo(() => {
    const visibleTourCount = Math.min(TOURS_PER_PAGE, orderedTours.length)

    return Array.from({ length: visibleTourCount }, (_, offset) => (
      orderedTours[(safePageIndex + offset) % orderedTours.length]
    ))
  }, [orderedTours, safePageIndex])
  const addedTourIdSet = useMemo(() => new Set(addedTourIds.map(String)), [addedTourIds])
  const addingTourIdSet = useMemo(() => new Set(addingTourIds.map(String)), [addingTourIds])
  const removingTourIdSet = useMemo(() => new Set(removingTourIds.map(String)), [removingTourIds])
  const reservingTourIdSet = useMemo(() => new Set(reservingTourIds.map(String)), [reservingTourIds])
  const isBirdModalOpen = Boolean(birdModal)
  const isTourDetailsOpen = Boolean(tourDetails)

  const closeBirdModal = () => {
    birdRequestIdRef.current += 1
    setBirdModal(null)
  }

  async function openBirdModal(bird, opener) {
    const birdName = getBirdName(bird)
    const requestId = birdRequestIdRef.current + 1
    birdRequestIdRef.current = requestId
    birdOpenerRef.current = opener
    setBirdModal({
      bird: null,
      error: null,
      isLoading: true,
      name: birdName,
    })

    try {
      const birdProfile = await loadBirdProfile({
        speciesCode: getBirdSpeciesCode(bird),
        name: birdName,
      })

      if (birdRequestIdRef.current === requestId) {
        setBirdModal({
          bird: birdProfile,
          error: null,
          isLoading: false,
          name: birdProfile.commonName || birdProfile.name || birdName,
        })
      }
    } catch (profileError) {
      if (birdRequestIdRef.current === requestId) {
        setBirdModal({
          bird: null,
          error: profileError.message || 'Unable to load bird details.',
          isLoading: false,
          name: birdName,
        })
      }
    }
  }

  const closeTourDetails = () => {
    setTourDetails(null)
  }

  const openTourDetails = (tour, opener) => {
    tourDetailsOpenerRef.current = opener
    setTourDetails(tour)
  }

  function movePagination(direction) {
    setPaginationDirection(direction > 0 ? 'next' : 'previous')
    setCurrentPageIndex((currentIndex) => {
      if (pageCount <= 1) return 0

      const currentPage = Math.floor(currentIndex / TOURS_PER_PAGE)
      const nextPage = (currentPage + direction + pageCount) % pageCount
      return nextPage * TOURS_PER_PAGE
    })
  }

  useEffect(() => {
    setCurrentPageIndex(0)
  }, [searchQuery])

  useEffect(() => {
    if (currentPageIndex > lastPageIndex) setCurrentPageIndex(lastPageIndex)
  }, [currentPageIndex, lastPageIndex])

  useEffect(() => {
    const canAutoPaginate = orderedTours.length > TOURS_PER_PAGE
      && !isAutoPaginationPaused
      && !isPointerWithinTours
      && !isFocusWithinTours
      && !isBirdModalOpen
      && !isTourDetailsOpen

    if (!canAutoPaginate) return undefined

    const timeoutId = window.setTimeout(() => {
      setPaginationDirection('next')
      setCurrentPageIndex((currentIndex) => {
        const currentPage = Math.floor(currentIndex / TOURS_PER_PAGE)
        return ((currentPage + 1) % pageCount) * TOURS_PER_PAGE
      })
    }, AUTO_PAGINATION_INTERVAL_MS)

    return () => window.clearTimeout(timeoutId)
  }, [
    isAutoPaginationPaused,
    isBirdModalOpen,
    isFocusWithinTours,
    isPointerWithinTours,
    isTourDetailsOpen,
    lastPageIndex,
    orderedTours.length,
    pageCount,
    safePageIndex,
  ])

  useEffect(() => {
    if (!isBirdModalOpen) return undefined

    birdCloseButtonRef.current?.focus()

    return () => {
      birdOpenerRef.current?.focus()
    }
  }, [isBirdModalOpen])

  useEffect(() => {
    if (!isTourDetailsOpen) return undefined

    tourDetailsCloseButtonRef.current?.focus()

    return () => {
      tourDetailsOpenerRef.current?.focus()
    }
  }, [isTourDetailsOpen])

  useEffect(() => {
    if (!isBirdModalOpen && !isTourDetailsOpen) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (isBirdModalOpen) closeBirdModal()
        else closeTourDetails()
      }

      if (event.key === 'Tab' && isTourDetailsOpen && !isBirdModalOpen) {
        const focusableElements = tourDetailsDialogRef.current?.querySelectorAll(
          'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        )
        const firstElement = focusableElements?.[0]
        const lastElement = focusableElements?.[focusableElements.length - 1]

        if (!firstElement || !lastElement) {
          event.preventDefault()
        } else if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault()
          lastElement.focus()
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault()
          firstElement.focus()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    document.body.classList.add('has-open-modal')

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.classList.remove('has-open-modal')
    }
  }, [isBirdModalOpen, isTourDetailsOpen])

  return (
    <>
      <section
        id="featured-tours"
        className="home-section"
        aria-labelledby="featured-tours-title"
      >
        <div className="home-section-heading">
          <p className="home-kicker">Curated nature experiences</p>
          <h2 id="featured-tours-title">Choose how you want to explore</h2>
          <p>From dawn birding to night trails and national parks, find a guided experience that fits your pace.</p>
        </div>
        {!isLoading && !error && tours.length > 0 && (
          <form className="tour-search" role="search" aria-label="Search tours" onSubmit={(event) => event.preventDefault()}>
            <label>
              <span>Search tours</span>
              <input type="search" value={searchQuery} placeholder="Activity, destination, wildlife…" onChange={(event) => setSearchQuery(event.target.value)} />
            </label>
          </form>
        )}
        {isLoading && <p className="home-status" role="status">Loading featured tours...</p>}
        {error && (
          <div className="home-status" role="status">
            <p>Tours are temporarily unavailable.</p>
            <button type="button" onClick={onRetry}>Retry tours</button>
          </div>
        )}
        {!isLoading && !error && tours.length === 0 && (
          <p className="home-status" role="status">No featured tours are available right now.</p>
        )}
        {!isLoading && !error && tours.length > 0 && filteredTours.length === 0 && (
          <div className="home-status" role="status">
            <p>No eligible tours match your search.</p>
            <button type="button" onClick={() => setSearchQuery('')}>Clear search</button>
          </div>
        )}
        {!isLoading && !error && orderedTours.length > TOURS_PER_PAGE && (
          <nav className="tour-pagination" aria-label="Tour pagination">
            <button
              type="button"
              className="tour-pagination-autoplay"
              aria-label={isAutoPaginationPaused
                ? 'Resume automatic tour pagination'
                : 'Pause automatic tour pagination'}
              aria-pressed={isAutoPaginationPaused}
              onClick={() => setIsAutoPaginationPaused((isPaused) => !isPaused)}
            >
              {isAutoPaginationPaused ? 'Play' : 'Pause'}
            </button>
            <button
              type="button"
              aria-label={`Show previous ${TOURS_PER_PAGE} tours`}
              onClick={() => movePagination(-1)}
            >
              <span aria-hidden="true">&lsaquo;</span>
            </button>
            <span aria-live="polite">
              Page {Math.floor(safePageIndex / TOURS_PER_PAGE) + 1} of{' '}
              {pageCount}
            </span>
            <button
              type="button"
              aria-label={`Show next ${TOURS_PER_PAGE} tours`}
              onClick={() => movePagination(1)}
            >
              <span aria-hidden="true">&rsaquo;</span>
            </button>
          </nav>
        )}
        {!isLoading && !error && visibleTours.length > 0 && (
          <div
            key={`${searchQuery}-${safePageIndex}`}
            className={`home-card-grid tour-card-grid tour-page-enter-${paginationDirection}`}
            onMouseEnter={() => setIsPointerWithinTours(true)}
            onMouseLeave={() => setIsPointerWithinTours(false)}
            onFocusCapture={() => setIsFocusWithinTours(true)}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setIsFocusWithinTours(false)
            }}
          >
            {visibleTours.map((tour) => (
              <TourCard
                isAdded={addedTourIdSet.has(String(getTourId(tour)))}
                isAdding={addingTourIdSet.has(String(getTourId(tour)))}
                isCartEnabled={isCartEnabled}
                isRemoving={removingTourIdSet.has(String(getTourId(tour)))}
                isReserving={reservingTourIdSet.has(String(getTourId(tour)))}
                onAddToCart={onAddToCart}
                onRemoveFromCart={onRemoveFromCart}
                onReserveTour={onReserveTour}
                onMoreInfo={openTourDetails}
                agentBookingEnabled={agentBookingEnabled}
                bookingUnavailableMessage={bookingUnavailableMessage}
                tour={tour}
                key={getTourKey(tour)}
              />
            ))}
          </div>
        )}
      </section>

      {tourDetails && (
        <TourDetailsDialog
          closeButtonRef={tourDetailsCloseButtonRef}
          dialogRef={tourDetailsDialogRef}
          onClose={closeTourDetails}
          onOpenBird={openBirdModal}
          tour={tourDetails}
        />
      )}

      {birdModal && createPortal(
        <div
          className="bird-modal-backdrop"
          role="presentation"
          onClick={closeBirdModal}
        >
          <div
            className="bird-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${birdModal.name} details`}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              ref={birdCloseButtonRef}
              className="bird-modal-close"
              type="button"
              aria-label="Close bird details"
              onClick={closeBirdModal}
            >
              x
            </button>
            {birdModal.isLoading && (
              <p className="bird-modal-status" role="status">Loading {birdModal.name} details...</p>
            )}
            {birdModal.error && (
              <p className="bird-modal-status" role="status">{birdModal.error}</p>
            )}
            {birdModal.bird && <BirdMediaCard bird={birdModal.bird} />}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

export default FeaturedTours
