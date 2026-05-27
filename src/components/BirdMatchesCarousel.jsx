import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import BirdMediaCard from './BirdMediaCard'
import useResolvedMediaUrl from '../hooks/useResolvedMediaUrl'

const VISIBLE_BIRD_COUNT = 3

function getBirdDisplayName(bird) {
  return bird?.commonName || bird?.name || bird?.scientificName || 'Bird match'
}

function getBirdKey(bird, index) {
  return bird?.speciesCode || bird?.commonName || bird?.scientificName || index
}

function BirdMatchThumbnail({ bird, displayName }) {
  const thumbnailUrl = useResolvedMediaUrl(
    bird?.media?.squarePhotoUrl || bird?.media?.photoUrl
  )

  if (!thumbnailUrl) {
    return (
      <span className="bird-carousel-thumb bird-carousel-thumb-placeholder" aria-hidden="true">
        {displayName.slice(0, 1).toUpperCase()}
      </span>
    )
  }

  return (
    <img
      className="bird-carousel-thumb"
      src={thumbnailUrl}
      alt=""
      loading="lazy"
    />
  )
}

function BirdMatchesCarousel({ birds }) {
  const [selectedBird, setSelectedBird] = useState(null)
  const [startIndex, setStartIndex] = useState(0)
  const [slideDirection, setSlideDirection] = useState('next')
  const closeButtonRef = useRef(null)
  const openerRef = useRef(null)

  const birdCount = Array.isArray(birds) ? birds.length : 0
  const maxStartIndex = Math.max(birdCount - VISIBLE_BIRD_COUNT, 0)
  const visibleBirds = Array.isArray(birds)
    ? birds.slice(startIndex, startIndex + VISIBLE_BIRD_COUNT)
    : []
  const hasPagination = birdCount > VISIBLE_BIRD_COUNT
  const canMovePrevious = startIndex > 0
  const canMoveNext = startIndex < maxStartIndex

  const closeSelectedBird = () => {
    setSelectedBird(null)
  }

  const moveCarousel = (direction) => {
    setSlideDirection(direction)
    setStartIndex((currentIndex) => {
      if (direction === 'previous') {
        return Math.max(currentIndex - 1, 0)
      }

      return Math.min(currentIndex + 1, maxStartIndex)
    })
  }

  useEffect(() => {
    setStartIndex((currentIndex) => Math.min(currentIndex, maxStartIndex))
  }, [maxStartIndex])

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

  if (birdCount === 0) {
    return null
  }

  const selectedName = getBirdDisplayName(selectedBird)

  return (
    <>
      <div className="bird-carousel" aria-label="Bird matches">
        {hasPagination && (
          <button
            className="bird-carousel-nav"
            type="button"
            aria-label="Show previous bird matches"
            disabled={!canMovePrevious}
            onClick={() => moveCarousel('previous')}
          >
            <span aria-hidden="true">&lt;</span>
          </button>
        )}

        <div className="bird-carousel-window">
          <div
            key={`${startIndex}-${slideDirection}`}
            className="bird-carousel-track"
            data-direction={slideDirection}
          >
            {visibleBirds.map((bird, index) => {
              const displayName = getBirdDisplayName(bird)
              const birdIndex = startIndex + index

              return (
                <button
                  key={getBirdKey(bird, birdIndex)}
                  className="bird-carousel-item"
                  type="button"
                  aria-label={`Open ${displayName} details`}
                  onClick={(event) => {
                    openerRef.current = event.currentTarget
                    setSelectedBird(bird)
                  }}
                >
                  <BirdMatchThumbnail bird={bird} displayName={displayName} />
                  <span className="bird-carousel-name">{displayName}</span>
                </button>
              )
            })}
          </div>
        </div>

        {hasPagination && (
          <button
            className="bird-carousel-nav"
            type="button"
            aria-label="Show next bird matches"
            disabled={!canMoveNext}
            onClick={() => moveCarousel('next')}
          >
            <span aria-hidden="true">&gt;</span>
          </button>
        )}
      </div>

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

export default BirdMatchesCarousel
