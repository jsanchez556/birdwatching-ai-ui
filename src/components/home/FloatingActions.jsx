import { useEffect, useState } from 'react'
import { useResolvedMedia } from '../../hooks/useResolvedMediaUrl'

const WHATSAPP_ICON_KEY = 'resources/wtsapp.png'

function FloatingActionIcon({ fallback, label, media }) {
  const [imageFailed, setImageFailed] = useState(false)
  const src = media.url
  const isPending = Boolean(media.isResolving && !imageFailed)
  const isUnavailable = Boolean(media.error || imageFailed)

  useEffect(() => {
    setImageFailed(false)
  }, [src])

  if (src && !isUnavailable) {
    return (
      <img
        className="home-fab-icon"
        src={src}
        alt=""
        aria-hidden="true"
        loading="eager"
        decoding="async"
        onError={() => setImageFailed(true)}
      />
    )
  }

  return (
    <span
      className={isPending ? 'home-fab-text is-loading' : 'home-fab-text'}
      aria-label={isPending ? `Loading ${label} icon` : undefined}
      role={isPending ? 'status' : undefined}
    >
      {fallback}
    </span>
  )
}

function FloatingActions() {
  const whatsappIconMedia = useResolvedMedia(WHATSAPP_ICON_KEY)

  return (
    <div className="home-fab-group" aria-label="Quick actions">
      <a
        className="home-fab whatsapp-fab"
        href="https://wa.me/00000000000"
        aria-label="Contact us on WhatsApp"
        target="_blank"
        rel="noreferrer"
      >
        <FloatingActionIcon
          fallback="WA"
          label="WhatsApp"
          media={whatsappIconMedia}
        />
      </a>
    </div>
  )
}

export default FloatingActions
