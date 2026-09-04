import { useEffect, useRef, useState } from 'react'
import { loadGoogleMaps } from '../config/googleMaps'
import { FOCUSED_LOCATION_ZOOM, resolveCountryMapView } from '../config/map'

function hasCoordinate(value) {
  return value !== null && value !== '' && value !== undefined && Number.isFinite(Number(value))
}

export default function useGoogleCoordinatePickerMap({
  mapElement, latitude, longitude, country, focusPoint, onChange,
}) {
  const [status, setStatus] = useState('loading')
  const callbackRef = useRef(onChange)
  callbackRef.current = onChange

  useEffect(() => {
    if (!mapElement) return undefined
    let active = true
    const listeners = []
    let marker

    loadGoogleMaps().then((google) => {
      if (!active) return
      const initialView = hasCoordinate(latitude) && hasCoordinate(longitude)
        ? { latitude: Number(latitude), longitude: Number(longitude), zoom: FOCUSED_LOCATION_ZOOM }
        : resolveCountryMapView(country)
      const map = new google.maps.Map(mapElement, {
        center: { lat: initialView.latitude, lng: initialView.longitude },
        zoom: initialView.zoom,
        streetViewControl: false,
        mapTypeControl: false,
      })
      marker = new google.maps.Marker({ map, draggable: true, visible: false })
      const reportPosition = (position) => callbackRef.current?.({
        latitude: Number(position.lat().toFixed(6)),
        longitude: Number(position.lng().toFixed(6)),
      })
      listeners.push(map.addListener('click', (event) => {
        marker.setPosition(event.latLng)
        marker.setVisible(true)
        reportPosition(event.latLng)
      }))
      listeners.push(marker.addListener('dragend', () => reportPosition(marker.getPosition())))
      mapElement.coordinateMap = {
        google,
        map,
        marker,
        setPoint(nextLatitude, nextLongitude) {
          if (!hasCoordinate(nextLatitude) || !hasCoordinate(nextLongitude)) {
            marker.setVisible(false)
            return
          }
          marker.setPosition({ lat: Number(nextLatitude), lng: Number(nextLongitude) })
          marker.setVisible(true)
        },
        panTo(nextLatitude, nextLongitude) {
          map.panTo({ lat: nextLatitude, lng: nextLongitude })
          map.setZoom(FOCUSED_LOCATION_ZOOM)
        },
      }
      mapElement.coordinateMap.setPoint(latitude, longitude)
      setStatus('ready')
    }).catch((error) => active && setStatus(error.message))

    return () => {
      active = false
      listeners.forEach((listener) => listener.remove?.())
      marker?.setMap(null)
      delete mapElement.coordinateMap
    }
  }, [mapElement])

  useEffect(() => {
    mapElement?.coordinateMap?.setPoint(latitude, longitude)
  }, [mapElement, latitude, longitude])

  useEffect(() => {
    if (focusPoint) mapElement?.coordinateMap?.panTo(focusPoint.latitude, focusPoint.longitude)
  }, [focusPoint, mapElement])

  return status
}
