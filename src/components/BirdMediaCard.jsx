import { useEffect, useRef, useState } from 'react'
import { useResolvedMedia } from '../hooks/useResolvedMediaUrl'

function normalizeLocationText(locations) {
  if (Array.isArray(locations)) {
    return locations.filter(Boolean).join(', ')
  }

  return typeof locations === 'string' ? locations : ''
}

function formatObservation(observation) {
  if (!observation || typeof observation !== 'object') {
    return ''
  }

  const locationText = normalizeLocationText(observation.locations || observation.location)
  const parts = [
    locationText,
    observation.obsDt,
    observation.howMany !== null && observation.howMany !== undefined
      ? `${observation.howMany} seen`
      : null,
  ].filter(Boolean)

  return parts.join(' - ')
}

function htmlToPlainText(html) {
  if (!html || typeof html !== 'string') {
    return ''
  }

  if (typeof window === 'undefined' || typeof window.DOMParser !== 'function') {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  }

  const parser = new window.DOMParser()
  const document = parser.parseFromString(html, 'text/html')

  return (document.body?.textContent || '').replace(/\s+/g, ' ').trim()
}

function parseSongLength(songLength) {
  if (typeof songLength === 'number') {
    return Number.isFinite(songLength) && songLength > 0 ? songLength : null
  }

  if (typeof songLength !== 'string') {
    return null
  }

  const normalizedSongLength = songLength.trim()

  if (!normalizedSongLength) {
    return null
  }

  const parts = normalizedSongLength.split(':').map((part) => Number(part))

  if (parts.some((part) => !Number.isFinite(part) || part < 0)) {
    return null
  }

  const seconds = parts.reduce((total, part) => (total * 60) + part, 0)

  return seconds > 0 ? seconds : null
}

function BirdMediaCard({ bird }) {
  const audioRef = useRef(null)
  const [playheadPercent, setPlayheadPercent] = useState(0)
  const [isAudioDurationReady, setIsAudioDurationReady] = useState(false)
  const [photoFailed, setPhotoFailed] = useState(false)
  const [sonogramFailed, setSonogramFailed] = useState(false)
  const [sonogramLoaded, setSonogramLoaded] = useState(false)
  const isBird = bird && typeof bird === 'object'
  const media = isBird ? bird.media || {} : {}
  const photoMedia = useResolvedMedia(media.photoUrl)
  const songMedia = useResolvedMedia(media.songUrl)
  const sonogramMedia = useResolvedMedia(media.sonogramUrl)
  const photoUrl = photoMedia.url
  const songUrl = songMedia.url
  const sonogramUrl = sonogramMedia.url
  const songDurationSeconds = parseSongLength(media.songLength)

  useEffect(() => {
    setPhotoFailed(false)
  }, [photoUrl])

  useEffect(() => {
    setSonogramFailed(false)
    setSonogramLoaded(false)
  }, [sonogramUrl, media.sonogramUrl])

  useEffect(() => {
    setPlayheadPercent(0)
    setIsAudioDurationReady(false)
  }, [songUrl, media.songLength])

  if (!isBird) {
    return null
  }

  const locationText = normalizeLocationText(bird.locations)
  const observationText = formatObservation(bird.lastObservation)
  const displayName = bird.commonName || bird.name || bird.scientificName || 'Bird match'
  const taxonomy = [bird.order, bird.family].filter(Boolean)
  const photoAttribution = media.photoAttribution || ''
  const songAttribution = htmlToPlainText(media.songAttributionHtml)
  const hasSonogramReference = Boolean(media.sonogramUrl)
  const isSonogramResolving = hasSonogramReference && sonogramMedia.isResolving
  const isSonogramLoading = Boolean(sonogramUrl) && !sonogramLoaded && !sonogramFailed
  const isSonogramUnavailable = hasSonogramReference && (Boolean(sonogramMedia.error) || sonogramFailed)
  const hasSound = media.songUrl || hasSonogramReference || songAttribution
  const hasPhoto = photoUrl && !photoFailed
  const hasSonogram = sonogramUrl && !sonogramFailed
  const hasSyncedSonogram = songUrl && hasSonogram && sonogramLoaded && isAudioDurationReady

  const updatePlayhead = () => {
    const audio = audioRef.current
    const audioDuration = Number.isFinite(audio?.duration) && audio.duration > 0 ? audio.duration : null
    const duration = songDurationSeconds || audioDuration

    if (!audio || !duration) {
      setPlayheadPercent(0)
      setIsAudioDurationReady(false)
      return
    }

    const currentTime = Number.isFinite(audio.currentTime) && audio.currentTime > 0 ? audio.currentTime : 0
    const nextPlayheadPercent = Math.min(Math.max((currentTime / duration) * 100, 0), 100)

    setIsAudioDurationReady(true)
    setPlayheadPercent(nextPlayheadPercent)
  }

  const resetPlayhead = () => {
    setPlayheadPercent(0)
  }

  const schedulePlayheadUpdate = () => {
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(updatePlayhead)
      return
    }

    window.setTimeout(updatePlayhead, 0)
  }

  return (
    <article className="bird-media-card" aria-label={`${displayName} bird media`}>
      <figure className="bird-media-figure">
        {hasPhoto ? (
          <img
            className="bird-media-photo"
            src={photoUrl}
            alt={`${displayName} photo`}
            loading="lazy"
            onError={() => setPhotoFailed(true)}
          />
        ) : (
          <div className="bird-media-photo bird-media-photo-placeholder" aria-label={`${displayName} photo unavailable`}>
            <span>{displayName.slice(0, 1).toUpperCase()}</span>
          </div>
        )}

        {photoAttribution && (
          <figcaption className="bird-photo-credit">
            <span>{photoAttribution}</span>
          </figcaption>
        )}
      </figure>

      <div className="bird-media-body">
        <header className="bird-species-header">
          {taxonomy.length > 0 && (
            <p className="bird-taxonomy" aria-label={`${displayName} taxonomy`}>
              {taxonomy.map((item, index) => (
                <span key={`${item}-${index}`}>{item}</span>
              ))}
            </p>
          )}

          <div className="bird-title-row">
            <p className="bird-media-eyebrow">Species profile</p>
            <h3>
              <span>{displayName}</span>
              {bird.scientificName && (
                <em>{bird.scientificName}</em>
              )}
            </h3>
          </div>
        </header>

        {bird.description && (
          <section className="bird-identification" aria-label={`${displayName} identification`}>
            <h4>Identification</h4>
            <p className="bird-description">{bird.description}</p>
          </section>
        )}

        <dl className="bird-facts">
          {bird.family && (
            <div>
              <dt>Family</dt>
              <dd>{bird.family}</dd>
            </div>
          )}
          {locationText && (
            <div>
              <dt>Locations</dt>
              <dd>{locationText}</dd>
            </div>
          )}
          {observationText && (
            <div>
              <dt>Recent observation</dt>
              <dd>{observationText}</dd>
            </div>
          )}
        </dl>

        {hasSound && (
          <div className="bird-media-assets">
            <h4>Audio</h4>
            {songUrl && (
              <audio
                ref={audioRef}
                aria-label={`${displayName} song recording`}
                controls
                preload="none"
                src={songUrl}
                onEnded={resetPlayhead}
                onDurationChange={updatePlayhead}
                onLoadedMetadata={updatePlayhead}
                onPlay={schedulePlayheadUpdate}
                onPlaying={updatePlayhead}
                onSeeked={updatePlayhead}
                onTimeUpdate={updatePlayhead}
              />
            )}

            {hasSonogramReference && (
              hasSonogram ? (
                <div className="bird-sonogram-frame">
                  {(isSonogramResolving || isSonogramLoading) && (
                    <p className="bird-media-loading" aria-live="polite">
                      Loading sonogram...
                    </p>
                  )}
                  <img
                    className={`bird-sonogram${sonogramLoaded ? '' : ' is-loading'}`}
                    src={sonogramUrl}
                    alt={`${displayName} sonogram`}
                    loading="eager"
                    decoding="async"
                    onLoad={() => {
                      setSonogramLoaded(true)
                      schedulePlayheadUpdate()
                    }}
                    onError={() => {
                      setSonogramLoaded(false)
                      setSonogramFailed(true)
                    }}
                  />
                  {hasSyncedSonogram && (
                    <span
                      className="bird-sonogram-playhead"
                      aria-hidden="true"
                      style={{ '--playhead-position': `${playheadPercent}%` }}
                    >
                      <span></span>
                    </span>
                  )}
                </div>
              ) : isSonogramResolving ? (
                <p className="bird-media-loading" aria-live="polite">
                  Loading sonogram...
                </p>
              ) : isSonogramUnavailable ? (
                <p className="bird-media-unavailable">Sonogram unavailable.</p>
              ) : (
                null
              )
            )}

            {songAttribution && (
              <p className="bird-media-attribution">
                {songAttribution}
              </p>
            )}
          </div>
        )}

      </div>
    </article>
  )
}

export default BirdMediaCard
