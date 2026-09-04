import { useEffect, useState } from 'react'
import { useResolvedMedia } from '../../hooks/useResolvedMediaUrl'

export default function TransportVehicleImage({ imagePath, name }) {
  const { url, isResolving, error } = useResolvedMedia(imagePath)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => setLoadFailed(false), [url])

  if (isResolving) {
    return <div className="transport-vehicle-image" role="status" aria-label={`Loading ${name} image`} />
  }

  if (!url || error || loadFailed) {
    return <div className="transport-vehicle-image"><span aria-hidden="true">🚐</span><span className="sr-only">{name} image unavailable</span></div>
  }

  return <div className="transport-vehicle-image"><img src={url} alt={`${name} vehicle`} onError={() => setLoadFailed(true)} /></div>
}
