import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import BirdMediaCard from '../BirdMediaCard'
import { useResolvedMedia } from '../../hooks/useResolvedMediaUrl'

function getBirdDisplayName(bird) {
  return bird?.commonName || bird?.name || bird?.scientificName || 'Bird highlight'
}

function BirdMetadataIcon({ type }) {
  const commonProps = {
    className: 'tour-card-overlay-icon bird-highlight-overlay-icon',
    viewBox: '0 0 24 24',
    'aria-hidden': 'true',
    focusable: 'false',
  }

  if (type === 'family') {
    return (
      <svg {...commonProps}>
        <path d="M4 19c1.7-4 5-6 8-6s6.3 2 8 6" />
        <path d="M7 10a5 5 0 0 1 10 0" />
        <path d="M12 3v3" />
      </svg>
    )
  }

  return (
    <svg {...commonProps}>
      <path d="M6 4h9a3 3 0 0 1 3 3v15H8a3 3 0 0 1-3-3V5a1 1 0 0 1 1-1Z" />
      <path d="M8 4v16" />
      <path d="M11 8h4" />
      <path d="M11 12h3" />
    </svg>
  )
}

function BirdImageOverlay({ bird, displayName }) {
  const scientificName = bird?.scientificName || 'Scientific name not specified'
  const family = bird?.family || 'Family not specified'
  const photoAttribution = bird?.media?.photoAttribution

  return (
    <>
      <div className="bird-highlight-top-overlay">
        {photoAttribution && (
          <p className="bird-highlight-attribution">{photoAttribution}</p>
        )}
      </div>
      <div className="bird-highlight-overlay" aria-label="Bird summary">
        <p className="bird-highlight-overlay-title">{displayName}</p>
        <dl className="bird-highlight-overlay-meta">
          <div className="tour-card-overlay-row bird-highlight-overlay-row">
            <dt className="sr-only">Scientific name</dt>
            <dd>
              <BirdMetadataIcon type="scientific" />
              <span>{scientificName}</span>
            </dd>
          </div>
          <div className="tour-card-overlay-row bird-highlight-overlay-row">
            <dt className="sr-only">Family</dt>
            <dd>
              <BirdMetadataIcon type="family" />
              <span>{family}</span>
            </dd>
          </div>
        </dl>
      </div>
    </>
  )
}

function BirdHighlightImage({ bird, displayName }) {
  const [imageFailed, setImageFailed] = useState(false)
  const imageReference = bird?.media?.photoUrl || bird?.media?.squarePhotoUrl || bird?.imageUrl
  const imageMedia = useResolvedMedia(imageReference)
  const imageUrl = imageMedia.url
  const isImagePending = Boolean(imageReference && imageMedia.isResolving && !imageFailed)
  const isImageUnavailable = Boolean(imageMedia.error || imageFailed)

  useEffect(() => {
    setImageFailed(false)
  }, [imageReference, imageUrl])

  return (
    <div
      className="bird-highlight-image-shell"
      aria-label={`${displayName} image and summary`}
    >
      {imageUrl && !isImageUnavailable ? (
        <img
          src={imageUrl}
          alt={`${displayName} photo`}
          className="home-card-image"
          loading="eager"
          decoding="async"
          onError={() => setImageFailed(true)}
        />
      ) : isImagePending ? (
        <div className="home-card-image home-card-image-loading" role="status">
          Loading image...
        </div>
      ) : (
        <div className="home-card-image bird-highlight-placeholder" aria-hidden="true">
          <span>{displayName.slice(0, 1).toUpperCase()}</span>
        </div>
      )}
      <BirdImageOverlay bird={bird} displayName={displayName} />
    </div>
  )
}

function getRandomBirdHighlights(birds) {
  if (!Array.isArray(birds)) {
    return []
  }

  return birds
    .map((bird) => ({ bird, sort: Math.random() }))
    .sort((left, right) => left.sort - right.sort)
    .slice(0, 4)
    .map(({ bird }) => bird)
}

function BirdHighlights({ birds, isLoading, error }) {
  const [selectedBird, setSelectedBird] = useState(null)
  const closeButtonRef = useRef(null)
  const openerRef = useRef(null)
  const visibleBirds = useMemo(() => getRandomBirdHighlights(birds), [birds])
  const visibleBirdKey = visibleBirds
    .map((bird, index) => bird.speciesCode || getBirdDisplayName(bird) || index)
    .join('-')

  const closeSelectedBird = () => {
    setSelectedBird(null)
  }

  useEffect(() => {
    if (!selectedBird) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeSelectedBird()
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
  }, [selectedBird])

  const selectedName = getBirdDisplayName(selectedBird)

  return (
    <>
      <section id="bird-highlights" className="home-section" aria-labelledby="bird-highlights-title">
        <div className="home-section-heading">
          <p className="home-kicker">Species highlights</p>
          <h2 id="bird-highlights-title">A few of Costa Rica's headline species</h2>
        </div>
        {isLoading && <p className="home-status" role="status">Loading bird highlights...</p>}
        {error && <p className="home-status" role="status">Bird highlights are temporarily unavailable.</p>}
        <div
          key={visibleBirdKey}
          className="home-card-grid compact-grid bird-highlights-enter"
        >
          {visibleBirds.map((bird, index) => {
            const displayName = getBirdDisplayName(bird)

            return (
              <button
                className="home-card bird-highlight-card"
                key={bird.speciesCode || displayName || index}
                type="button"
                aria-label={`Open ${displayName} details`}
                onClick={(event) => {
                  openerRef.current = event.currentTarget
                  setSelectedBird(bird)
                }}
              >
                <BirdHighlightImage bird={bird} displayName={displayName} />
              </button>
            )
          })}
        </div>
      </section>

      {selectedBird && createPortal(
        <div
          className="bird-modal-backdrop"
          role="presentation"
          onClick={closeSelectedBird}
        >
          <div
            className="bird-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedName} details`}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              ref={closeButtonRef}
              className="bird-modal-close"
              type="button"
              aria-label="Close bird details"
              onClick={closeSelectedBird}
            >
              x
            </button>
            <BirdMediaCard bird={selectedBird} />
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

export default BirdHighlights
