import { useEffect, useRef, useState } from 'react'
import { useResolvedMedia } from '../../hooks/useResolvedMediaUrl'
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion'

const HERO_VIDEO_PATH = 'resources/home-hero.mp4'
const HERO_POSTER_PATH = 'resources/poster.jpg'
const HERO_CONTENT_REVEAL_DELAY_MS = 15000

function HeroSection({
  onAuthAction,
  showLoginCta = true,
}) {
  const isReducedMotion = usePrefersReducedMotion()
  const posterMedia = useResolvedMedia(HERO_POSTER_PATH)
  const videoMedia = useResolvedMedia(isReducedMotion ? '' : HERO_VIDEO_PATH)
  const [hasPosterError, setHasPosterError] = useState(false)
  const [hasVideoError, setHasVideoError] = useState(false)
  const [isHeroContentVisible, setIsHeroContentVisible] = useState(isReducedMotion)
  const revealTimerRef = useRef(null)
  const hasStartedHeroContentRevealRef = useRef(false)
  const posterUrl = hasPosterError ? '' : posterMedia.url
  const shouldShowVideo = !isReducedMotion && Boolean(videoMedia.url) && !videoMedia.error && !hasVideoError

  useEffect(() => {
    setHasPosterError(false)
  }, [posterMedia.url])

  useEffect(() => {
    setHasVideoError(false)

    if (revealTimerRef.current) {
      window.clearTimeout(revealTimerRef.current)
      revealTimerRef.current = null
    }

    if (isReducedMotion || videoMedia.error) {
      setIsHeroContentVisible(true)
      hasStartedHeroContentRevealRef.current = true
      return
    }

    setIsHeroContentVisible(false)
    hasStartedHeroContentRevealRef.current = false
  }, [isReducedMotion, videoMedia.error, videoMedia.url])

  useEffect(() => () => {
    if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current)
  }, [])

  const revealHeroContentAfterDelay = () => {
    if (hasStartedHeroContentRevealRef.current) return

    hasStartedHeroContentRevealRef.current = true
    revealTimerRef.current = window.setTimeout(() => {
      setIsHeroContentVisible(true)
      revealTimerRef.current = null
    }, HERO_CONTENT_REVEAL_DELAY_MS)
  }

  const handleVideoError = () => {
    if (revealTimerRef.current) {
      window.clearTimeout(revealTimerRef.current)
      revealTimerRef.current = null
    }

    setHasVideoError(true)
    setIsHeroContentVisible(true)
  }

  return (
    <section
      id="about-us"
      className={shouldShowVideo ? 'home-hero has-video' : 'home-hero'}
      aria-labelledby="home-hero-title"
    >
      <div className="home-hero-fallback" aria-hidden="true" />
      {posterUrl && (
        <img
          className="home-hero-poster"
          src={posterUrl}
          alt=""
          aria-hidden="true"
          onError={() => setHasPosterError(true)}
        />
      )}
      {shouldShowVideo && (
        <video
          className="home-hero-video"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={posterUrl || undefined}
          aria-hidden="true"
          tabIndex={-1}
          onCanPlay={revealHeroContentAfterDelay}
          onError={handleVideoError}
          onAbort={handleVideoError}
        >
          <source src={videoMedia.url} type="video/mp4" />
        </video>
      )}
      <div className={isHeroContentVisible ? 'home-hero-content is-visible' : 'home-hero-content is-pending'}>
        <p className="home-kicker">Small-group nature experiences in Costa Rica</p>
        <h1 id="home-hero-title">Find your way into the wild.</h1>
        <p>
          Discover birdwatching, day walks, night trails, and national parks with
          local guidance, clear availability, and effortless trip planning.
        </p>
        <div className="home-hero-actions" aria-label="Homepage actions">
          {showLoginCta && (
            <button type="button" className="home-secondary-action" onClick={onAuthAction}>
              Login
            </button>
          )}
          <a className="home-primary-action" href="#featured-tours">
            Explore Tours
          </a>
        </div>
      </div>
    </section>
  )
}

export default HeroSection
