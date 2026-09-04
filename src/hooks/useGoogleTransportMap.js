import { useEffect, useRef, useState } from 'react'
import { loadGoogleMaps } from '../config/googleMaps'

const COUNTRY_CODE = (import.meta.env.VITE_TRANSPORT_COUNTRY_CODE || 'CR').toLowerCase()
const COSTA_RICA_BOUNDS = { north: 11.22, south: 8.03, east: -82.55, west: -85.95 }


export default function useGoogleTransportMap({ mapElement, originInput, destinationInput, route, onPlaceChange }) {
  const [status, setStatus] = useState('loading')
  const callbackRef = useRef(onPlaceChange)
  callbackRef.current = onPlaceChange

  useEffect(() => {
    if (!mapElement || !originInput || !destinationInput) return undefined
    let active = true
    const listeners = []
    const markers = {}
    let polyline

    loadGoogleMaps().then((google) => {
      if (!active) return
      const bounds = COUNTRY_CODE === 'cr' ? COSTA_RICA_BOUNDS : undefined
      const routeColor = getComputedStyle(document.documentElement).getPropertyValue('--brand').trim() || '#28734d'
      const map = new google.maps.Map(mapElement, {
        center: { lat: 9.75, lng: -84.2 }, zoom: 7, restriction: bounds ? { latLngBounds: bounds, strictBounds: true } : undefined,
        streetViewControl: false, mapTypeControl: false,
      })
      const geocoder = new google.maps.Geocoder()
      const attach = (kind, input) => {
        const autocomplete = new google.maps.places.Autocomplete(input, {
          componentRestrictions: { country: COUNTRY_CODE }, fields: ['place_id', 'formatted_address', 'geometry'],
        })
        listeners.push(autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace()
          if (!place.place_id || !place.geometry?.location) return
          callbackRef.current(kind, { placeId: place.place_id, label: place.formatted_address || input.value,
            latitude: place.geometry.location.lat(), longitude: place.geometry.location.lng() })
        }))
        markers[kind] = new google.maps.Marker({ map, draggable: true, label: kind === 'origin' ? 'A' : 'B' })
        listeners.push(markers[kind].addListener('dragend', async () => {
          const result = await geocoder.geocode({ location: markers[kind].getPosition() }).catch(() => null)
          const place = result?.results?.[0]
          if (place?.place_id) callbackRef.current(kind, { placeId: place.place_id, label: place.formatted_address,
            latitude: markers[kind].getPosition().lat(), longitude: markers[kind].getPosition().lng() })
        }))
      }
      attach('origin', originInput)
      attach('destination', destinationInput)
      mapElement.transportMap = { google, map, markers, setRoute(nextRoute) {
        for (const kind of ['origin', 'destination']) {
          const point = nextRoute?.[kind]
          if (point) markers[kind].setPosition({ lat: point.latitude, lng: point.longitude })
        }
        polyline?.setMap(null)
        if (nextRoute?.encodedPolyline) {
          polyline = new google.maps.Polyline({ map, path: google.maps.geometry.encoding.decodePath(nextRoute.encodedPolyline), strokeColor: routeColor, strokeWeight: 5 })
          const routeBounds = new google.maps.LatLngBounds()
          polyline.getPath().forEach((point) => routeBounds.extend(point))
          map.fitBounds(routeBounds, 42)
        }
      } }
      mapElement.transportMap.setRoute(route)
      setStatus('ready')
    }).catch((error) => active && setStatus(error.message))
    return () => { active = false; listeners.forEach((listener) => listener.remove?.()); delete mapElement.transportMap }
  }, [destinationInput, mapElement, originInput])

  useEffect(() => { mapElement?.transportMap?.setRoute(route) }, [mapElement, route])
  return status
}
