import { useEffect, useState } from 'react'
import useGoogleTransportMap from '../../hooks/useGoogleTransportMap'

export default function TransportMap({ places, route, onPlaceChange }) {
  const [mapElement, setMapElement] = useState(null)
  const [originInput, setOriginInput] = useState(null)
  const [destinationInput, setDestinationInput] = useState(null)
  const status = useGoogleTransportMap({ mapElement, originInput, destinationInput, route, onPlaceChange })
  useEffect(() => {
    if (originInput && places.origin?.label) originInput.value = places.origin.label
    if (destinationInput && places.destination?.label) destinationInput.value = places.destination.label
  }, [destinationInput, originInput, places.destination?.label, places.origin?.label])
  return (
    <div className="transport-location-layout">
      <div className="transport-location-fields">
        <label htmlFor="transport-origin">Pickup location
          <input id="transport-origin" ref={setOriginInput} defaultValue={places.origin?.label || ''} placeholder="Search in Costa Rica" autoComplete="off" onChange={() => places.origin && onPlaceChange('origin', null)} />
        </label>
        <label htmlFor="transport-destination">Drop-off location
          <input id="transport-destination" ref={setDestinationInput} defaultValue={places.destination?.label || ''} placeholder="Search in Costa Rica" autoComplete="off" onChange={() => places.destination && onPlaceChange('destination', null)} />
        </label>
        <p className="transport-field-help">Type an address or move either marker on the map. Results are limited to Costa Rica.</p>
      </div>
      <div className="transport-map-wrap">
        <div ref={setMapElement} className="transport-map" aria-label="Pickup and drop-off map" />
        {status !== 'ready' && <p className="transport-map-status" role={status === 'loading' ? 'status' : 'alert'}>{status === 'loading' ? 'Loading map…' : status}</p>}
      </div>
    </div>
  )
}
