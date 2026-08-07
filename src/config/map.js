const DEFAULT_TILE_TEMPLATE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

export const MAP_TILE_TEMPLATE = import.meta.env.VITE_MAP_TILE_URL || DEFAULT_TILE_TEMPLATE
export const MAP_ATTRIBUTION_URL = 'https://www.openstreetmap.org/copyright'
export const MAP_ZOOM_RANGE = Object.freeze({ min: 0, max: 19 })
export const FALLBACK_MAP_VIEW = Object.freeze({ latitude: 9.75, longitude: -84.2, zoom: 7 })
export const FOCUSED_LOCATION_ZOOM = 13
export const MAP_TILE_SIZE = 256
export const WEB_MERCATOR_MAX_LATITUDE = 85.05112878

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

export function mapWorldSize(zoom) {
  return MAP_TILE_SIZE * (2 ** zoom)
}

export function projectMapPoint({ latitude, longitude }, zoom) {
  const worldSize = mapWorldSize(zoom)
  const boundedLatitude = Math.max(-WEB_MERCATOR_MAX_LATITUDE, Math.min(WEB_MERCATOR_MAX_LATITUDE, latitude))
  const radians = boundedLatitude * Math.PI / 180
  return {
    x: ((longitude + 180) / 360) * worldSize,
    y: (1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2 * worldSize,
  }
}

export function unprojectMapPoint({ x, y }, zoom) {
  const worldSize = mapWorldSize(zoom)
  const longitude = (x / worldSize) * 360 - 180
  const mercatorY = Math.PI * (1 - 2 * y / worldSize)
  return {
    latitude: Math.atan(Math.sinh(mercatorY)) * 180 / Math.PI,
    longitude,
  }
}

export function getMapTileUrl({ zoom, x, y }) {
  return MAP_TILE_TEMPLATE
    .replace('{z}', String(zoom))
    .replace('{x}', String(x))
    .replace('{y}', String(y))
}
