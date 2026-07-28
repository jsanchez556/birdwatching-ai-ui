import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { loadBirdProfile } from '../../api/homeApi'
import BirdMediaCard from '../BirdMediaCard'
import { useResolvedMedia } from '../../hooks/useResolvedMediaUrl'

const TOURS_PER_PAGE = 3

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
  const rank = Number(tour.rank)
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

function MetadataIcon({ type }) {
  const commonProps = {
    className: 'tour-card-overlay-icon',
    viewBox: '0 0 24 24',
    'aria-hidden': 'true',
    focusable: 'false',
  }

  if (type === 'duration') {
    return (
      <svg {...commonProps}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    )
  }

  if (type === 'difficulty') {
    return (
      <svg {...commonProps}>
        <path d="M5 20V10" />
        <path d="M12 20V5" />
        <path d="M19 20v-8" />
      </svg>
    )
  }

  if (type === 'price') {
    return (
      <svg {...commonProps}>
        <path d="M12 3v18" />
        <path d="M17 7.5c0-1.7-2.1-3-4.7-3S7 5.8 7 7.9c0 1.9 1.5 2.9 5 3.6 3.6.8 5 1.8 5 3.7 0 2.1-2.3 3.4-5.1 3.4S7 17.2 7 15.3" />
      </svg>
    )
  }

  return (
    <svg {...commonProps}>
      <path d="M12 21s7-6.1 7-12a7 7 0 0 0-14 0c0 5.9 7 12 7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  )
}

function TourImageOverlay({ tour }) {
  const tourName = tour.name || tour.title
  const price = formatPrice(tour.pricePerPerson)
  const overlayItems = [
    { key: 'node', icon: 'location', label: 'Location', value: formatTourNode(tour) },
    { key: 'duration', icon: 'duration', label: 'Duration', value: tour.duration },
    { key: 'difficulty', icon: 'difficulty', label: 'Difficulty', value: tour.difficulty },
    { key: 'price', icon: 'price', label: 'Price', value: price ? `From ${price}` : null },
  ]

  return (
    <div className="tour-card-overlay" aria-label="Tour summary">
      <p className="tour-card-overlay-title">{tourName}</p>
      <dl className="tour-card-overlay-meta">
        {overlayItems.map((item) => (
          <div className="tour-card-overlay-row" key={item.key}>
            <dt className="sr-only">{item.label}</dt>
            <dd>
              <MetadataIcon type={item.icon} />
              <span>{item.value || 'Not specified'}</span>
            </dd>
          </div>
        ))}
      </dl>
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
    tours: zoneTours
      .slice()
      .sort((left, right) => getTourRank(left) - getTourRank(right)),
  }))
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
  onOpenBird,
  onReserveTour,
  tour,
}) {
  const price = formatPrice(tour.pricePerPerson)
  const dates = formatTourDates(tour)
  const birds = Array.isArray(tour.birds) ? tour.birds.filter((bird) => bird?.name).slice(0, 3) : []
  const [portraitFailed, setPortraitFailed] = useState(false)
  const portraitMedia = useResolvedMedia(tour.portraitUrl)
  const portraitUrl = portraitMedia.url
  const isPortraitPending = Boolean(tour.portraitUrl && portraitMedia.isResolving && !portraitFailed)
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
  }, [tour.portraitUrl, portraitUrl])

  return (
    <article className="home-card tour-card">
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
        <TourImageOverlay tour={tour} />
      </div>
      <div className="home-card-body">
        {tour.description && <p className="tour-card-description">{tour.description}</p>}
        <dl className="home-card-facts">
          {dates && (
            <div>
              <dt>Dates</dt>
              <dd>{dates}</dd>
            </div>
          )}
        </dl>
        {birds.length > 0 && (
          <p className="tour-card-birds">
            <span className="tour-card-birds-label">Key birds</span>
            <span className="tour-card-bird-list">
              {birds.map((bird, index) => {
                const birdName = getBirdName(bird)

                return (
                  <span className="tour-card-bird-item" key={`${birdName}-${index}`}>
                    {index > 0 && <span className="tour-card-bird-separator">, </span>}
                    <button
                      className="tour-card-bird-button"
                      type="button"
                      aria-label={`Open ${birdName} details`}
                      onClick={(event) => onOpenBird(bird, event.currentTarget)}
                    >
                      {birdName}
                    </button>
                  </span>
                )
              })}
            </span>
          </p>
        )}
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
              aria-label={isReserving ? `Preparing ${tourName} reservation` : `Reserve ${tourName}`}
              disabled={!agentBookingEnabled || isReserving}
              title={!agentBookingEnabled ? bookingUnavailableMessage : undefined}
              onClick={() => onReserveTour?.(tour)}
            >
              <ReserveTourIcon />
              <span>{!agentBookingEnabled ? 'Booking unavailable' : isReserving ? 'Preparing...' : 'Reserve tour'}</span>
            </button>
        </div>
      </div>
    </article>
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
  onReserveTour,
}) {
  const [carouselIndexes, setCarouselIndexes] = useState({})
  const [birdModal, setBirdModal] = useState(null)
  const closeButtonRef = useRef(null)
  const openerRef = useRef(null)
  const birdRequestIdRef = useRef(0)
  const tourGroups = useMemo(() => groupToursByZone(tours), [tours])
  const addedTourIdSet = useMemo(() => new Set(addedTourIds.map(String)), [addedTourIds])
  const addingTourIdSet = useMemo(() => new Set(addingTourIds.map(String)), [addingTourIds])
  const removingTourIdSet = useMemo(() => new Set(removingTourIds.map(String)), [removingTourIds])
  const reservingTourIdSet = useMemo(() => new Set(reservingTourIds.map(String)), [reservingTourIds])
  const isBirdModalOpen = Boolean(birdModal)

  const closeBirdModal = () => {
    birdRequestIdRef.current += 1
    setBirdModal(null)
  }

  async function openBirdModal(bird, opener) {
    const birdName = getBirdName(bird)
    const requestId = birdRequestIdRef.current + 1
    birdRequestIdRef.current = requestId
    openerRef.current = opener
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

  function moveCarousel(zone, direction, tourCount) {
    setCarouselIndexes((currentIndexes) => {
      const currentIndex = currentIndexes[zone] || 0
      const maxIndex = Math.max(tourCount - TOURS_PER_PAGE, 0)
      const nextIndex = Math.min(Math.max(currentIndex + direction, 0), maxIndex)

      return {
        ...currentIndexes,
        [zone]: nextIndex,
      }
    })
  }

  useEffect(() => {
    if (!isBirdModalOpen) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeBirdModal()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    closeButtonRef.current?.focus()
    document.body.classList.add('has-open-modal')

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.classList.remove('has-open-modal')
      openerRef.current?.focus()
    }
  }, [isBirdModalOpen])

  return (
    <>
      <section id="featured-tours" className="home-section" aria-labelledby="featured-tours-title">
        <div className="home-section-heading">
          <p className="home-kicker">Featured tours</p>
          <h2 id="featured-tours-title">Birding routes with room to breathe</h2>
        </div>
        {isLoading && <p className="home-status" role="status">Loading featured tours...</p>}
        {error && <p className="home-status" role="status">Tours are temporarily unavailable.</p>}
        {!isLoading && !error && tours.length === 0 && (
          <p className="home-status" role="status">No featured tours are available right now.</p>
        )}
        {!isLoading && !error && tourGroups.map(({ zone, tours: zoneTours }) => {
          const currentIndex = Math.min(
            carouselIndexes[zone] || 0,
            Math.max(zoneTours.length - TOURS_PER_PAGE, 0),
          )
          const visibleTours = zoneTours.slice(currentIndex, currentIndex + TOURS_PER_PAGE)
          const hasMultiplePages = zoneTours.length > TOURS_PER_PAGE

          return (
            <div className="tour-zone-carousel" key={zone}>
              <div className="tour-zone-header">
                <h3>{zone}</h3>
                {hasMultiplePages && (
                  <div className="tour-carousel-controls">
                    <button
                      type="button"
                      aria-label={`Show previous ${zone} tours`}
                      disabled={currentIndex === 0}
                      onClick={() => moveCarousel(zone, -1, zoneTours.length)}
                    >
                      <span aria-hidden="true">&lsaquo;</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Show next ${zone} tours`}
                      disabled={currentIndex >= zoneTours.length - TOURS_PER_PAGE}
                      onClick={() => moveCarousel(zone, 1, zoneTours.length)}
                    >
                      <span aria-hidden="true">&rsaquo;</span>
                    </button>
                  </div>
                )}
              </div>
              <div className="home-card-grid tour-card-grid">
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
                    agentBookingEnabled={agentBookingEnabled}
                    bookingUnavailableMessage={bookingUnavailableMessage}
                    tour={tour}
                    onOpenBird={openBirdModal}
                    key={getTourKey(tour)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </section>

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
              ref={closeButtonRef}
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
