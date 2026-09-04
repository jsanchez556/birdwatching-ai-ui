import { useEffect, useRef, useState } from 'react'
import { loadGoogleMaps } from '../config/googleMaps'

export default function useGooglePlaceAutocomplete({ inputElement, countryCode, onPlaceSelected }) {
  const [status, setStatus] = useState('loading')
  const callbackRef = useRef(onPlaceSelected)
  callbackRef.current = onPlaceSelected

  useEffect(() => {
    if (!inputElement) return undefined
    let active = true
    let listener

    loadGoogleMaps().then((google) => {
      if (!active) return
      const autocomplete = new google.maps.places.Autocomplete(inputElement, {
        componentRestrictions: countryCode ? { country: countryCode.toLowerCase() } : undefined,
        fields: ['place_id', 'formatted_address', 'geometry'],
      })
      listener = autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()
        if (!place.place_id || !place.geometry?.location) return
        callbackRef.current?.({
          placeId: place.place_id,
          name: place.formatted_address || inputElement.value,
          latitude: place.geometry.location.lat(),
          longitude: place.geometry.location.lng(),
        })
      })
      setStatus('ready')
    }).catch((error) => active && setStatus(error.message))

    return () => {
      active = false
      listener?.remove?.()
    }
  }, [countryCode, inputElement])

  return status
}
