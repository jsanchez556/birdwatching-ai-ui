export const MAP_ZOOM_RANGE = Object.freeze({ min: 0, max: 19 })
export const FALLBACK_MAP_VIEW = Object.freeze({ latitude: 9.75, longitude: -84.2, zoom: 7 })
export const FOCUSED_LOCATION_ZOOM = 13

function finite(value) {
  if (value === '' || value === null || value === undefined) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function resolveCountryMapView(country) {
  const latitude = finite(country?.latitude)
  const longitude = finite(country?.longitude)
  const zoom = finite(country?.zoom)
  const valid = latitude !== null && latitude >= -90 && latitude <= 90
    && longitude !== null && longitude >= -180 && longitude <= 180
    && Number.isInteger(zoom) && zoom >= MAP_ZOOM_RANGE.min && zoom <= MAP_ZOOM_RANGE.max
  return valid ? { latitude, longitude, zoom } : FALLBACK_MAP_VIEW
}
