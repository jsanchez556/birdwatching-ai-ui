export const DEVICE_LOCATION_OPTIONS = Object.freeze({
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0,
})

export const MAX_DEVICE_LOCATION_AGE_MS = 120000
export const MAX_DEVICE_LOCATION_ACCURACY_METERS = 1000
export const APPROXIMATE_DEVICE_LOCATION_ACCURACY_METERS = 100
export const MAX_REVERSE_LABEL_DISTANCE_METERS = 25000
const MAX_FUTURE_CLOCK_SKEW_MS = 30000
const EARTH_RADIUS_METERS = 6371000

function coordinate(value, min, max) {
  const number = Number(value)
  return Number.isFinite(number) && number >= min && number <= max ? number : null
}

export function validateDevicePosition(position, now = Date.now()) {
  const latitude = coordinate(position?.coords?.latitude, -90, 90)
  const longitude = coordinate(position?.coords?.longitude, -180, 180)
  if (latitude === null || longitude === null) {
    return { valid: false, reason: 'coordinates' }
  }

  const accuracy = Number(position?.coords?.accuracy)
  if (!Number.isFinite(accuracy) || accuracy < 0) {
    return { valid: false, reason: 'accuracy' }
  }
  if (accuracy > MAX_DEVICE_LOCATION_ACCURACY_METERS) {
    return { valid: false, reason: 'poor_accuracy', accuracy }
  }

  const timestamp = Number(position?.timestamp)
  const age = now - timestamp
  if (!Number.isFinite(timestamp) || timestamp <= 0 || age > MAX_DEVICE_LOCATION_AGE_MS
    || age < -MAX_FUTURE_CLOCK_SKEW_MS) {
    return { valid: false, reason: 'stale', age }
  }

  return {
    valid: true,
    latitude,
    longitude,
    accuracy,
    approximate: accuracy > APPROXIMATE_DEVICE_LOCATION_ACCURACY_METERS,
  }
}

export function distanceBetweenCoordinates(first, second) {
  const latitude1 = coordinate(first?.latitude, -90, 90)
  const longitude1 = coordinate(first?.longitude, -180, 180)
  const latitude2 = coordinate(second?.latitude, -90, 90)
  const longitude2 = coordinate(second?.longitude, -180, 180)
  if ([latitude1, longitude1, latitude2, longitude2].includes(null)) return Number.NaN
  const radians = (degrees) => degrees * (Math.PI / 180)
  const latitudeDelta = radians(latitude2 - latitude1)
  const longitudeDelta = radians(longitude2 - longitude1)
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(latitude1)) * Math.cos(radians(latitude2))
    * Math.sin(longitudeDelta / 2) ** 2
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
