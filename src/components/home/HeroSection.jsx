import { useEffect, useMemo, useRef, useState } from 'react'

const HERO_CONTENT_REVEAL_DELAY_MS = 15000
const HERO_SEGMENT_LOOP_BUFFER_MS = 250
const YOUTUBE_HOST_PATTERN = /(^|\.)youtube(?:-nocookie)?\.com$/

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function getHeroVideoConfig(videoUrl) {
  try {
    const url = new URL(videoUrl)
    const isYouTubeEmbed = YOUTUBE_HOST_PATTERN.test(url.hostname) && url.pathname.startsWith('/embed/')
    const start = Number.parseInt(url.searchParams.get('start'), 10)
    const end = Number.parseInt(url.searchParams.get('end'), 10)
    const segment = Number.isFinite(start) && Number.isFinite(end) && end > start
      ? { start, end }
      : null

    if (!isYouTubeEmbed) {
      return { src: videoUrl, segment: null, targetOrigin: null }
    }

    const videoId = url.pathname.split('/').filter(Boolean)[1]

    if (!videoId) {
      return { src: videoUrl, segment, targetOrigin: url.origin }
    }

    const smoothPlaybackParams = {
      autoplay: '1',
      controls: '0',
      enablejsapi: '1',
      loop: '1',
      modestbranding: '1',
      mute: '1',
      playsinline: '1',
      rel: '0',
      playlist: videoId,
    }

    for (const [key, value] of Object.entries(smoothPlaybackParams)) {
      url.searchParams.set(key, value)
    }

    if (typeof window !== 'undefined' && window.location?.origin) {
      url.searchParams.set('origin', window.location.origin)
    }

    return { src: url.toString(), segment, targetOrigin: url.origin }
  } catch {
    return { src: videoUrl, segment: null, targetOrigin: null }
  }
}

function postYouTubeCommand(iframe, targetOrigin, func, args = []) {
  iframe?.contentWindow?.postMessage(
    JSON.stringify({
      event: 'command',
      func,
      args,
    }),
    targetOrigin || '*'
  )
}

function HeroSection({
  heroVideo,
  onAuthAction,
  showLoginCta = true,
}) {
  const [hasVideoError, setHasVideoError] = useState(false)
  const [isHeroContentVisible, setIsHeroContentVisible] = useState(() => !heroVideo || prefersReducedMotion())
  const [isHeroVideoLoaded, setIsHeroVideoLoaded] = useState(false)
  const heroVideoRef = useRef(null)
  const revealTimerRef = useRef(null)
  const hasStartedHeroContentRevealRef = useRef(false)
  const shouldShowVideo = Boolean(heroVideo) && !hasVideoError
  const heroVideoConfig = useMemo(
    () => (
      shouldShowVideo
        ? getHeroVideoConfig(heroVideo)
        : { src: '', segment: null, targetOrigin: null }
    ),
    [heroVideo, shouldShowVideo]
  )

  useEffect(() => {
    setHasVideoError(false)
    setIsHeroVideoLoaded(false)

    if (!heroVideo || prefersReducedMotion()) {
      setIsHeroContentVisible(true)
      hasStartedHeroContentRevealRef.current = true
      return
    }

    setIsHeroContentVisible(false)
    hasStartedHeroContentRevealRef.current = false

    if (revealTimerRef.current) {
      window.clearTimeout(revealTimerRef.current)
      revealTimerRef.current = null
    }
  }, [heroVideo])

  useEffect(() => () => {
    if (revealTimerRef.current) {
      window.clearTimeout(revealTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!shouldShowVideo || !isHeroVideoLoaded || !heroVideoConfig.segment || prefersReducedMotion()) {
      return undefined
    }

    const { start, end } = heroVideoConfig.segment
    const loopDelayMs = Math.max(1000, ((end - start) * 1000) - HERO_SEGMENT_LOOP_BUFFER_MS)
    const seekToSegmentStart = () => {
      postYouTubeCommand(heroVideoRef.current, heroVideoConfig.targetOrigin, 'seekTo', [start, true])
      postYouTubeCommand(heroVideoRef.current, heroVideoConfig.targetOrigin, 'playVideo')
    }

    seekToSegmentStart()

    const intervalId = window.setInterval(seekToSegmentStart, loopDelayMs)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [
    heroVideoConfig.segment,
    heroVideoConfig.targetOrigin,
    isHeroVideoLoaded,
    shouldShowVideo,
  ])

  const handleHeroVideoLoad = () => {
    setIsHeroVideoLoaded(true)

    if (hasStartedHeroContentRevealRef.current) {
      return
    }

    hasStartedHeroContentRevealRef.current = true

    if (prefersReducedMotion()) {
      setIsHeroContentVisible(true)
      return
    }

    revealTimerRef.current = window.setTimeout(() => {
      setIsHeroContentVisible(true)
      revealTimerRef.current = null
    }, HERO_CONTENT_REVEAL_DELAY_MS)
  }

  const handleHeroVideoError = () => {
    setHasVideoError(true)
    setIsHeroContentVisible(true)
  }

  return (
    <section className={shouldShowVideo ? 'home-hero has-video' : 'home-hero'} aria-labelledby="home-hero-title">
      <div className="home-hero-fallback" aria-hidden="true" />
      {shouldShowVideo && (
        <iframe
          ref={heroVideoRef}
          className="home-hero-video"
          src={heroVideoConfig.src}
          title="Rainforest canopy video background"
          aria-hidden="true"
          tabIndex={-1}
          loading="lazy"
          allow="autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={handleHeroVideoLoad}
          onError={handleHeroVideoError}
        />
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
