import {
  APPROXIMATE_DEVICE_LOCATION_ACCURACY_METERS,
  distanceBetweenCoordinates,
  MAX_DEVICE_LOCATION_ACCURACY_METERS,
  validateDevicePosition,
} from '../geolocation'

const NOW = 2000000000000

function position(latitude, longitude, accuracy, timestamp = NOW) {
  return { coords: { latitude, longitude, accuracy }, timestamp }
}

test('preserves latitude and longitude ordering and classifies reported accuracy', () => {
  expect(validateDevicePosition(position(10.73312345, -85.04498765, 25), NOW)).toEqual({
    valid: true,
    latitude: 10.73312345,
    longitude: -85.04498765,
    accuracy: 25,
    approximate: false,
  })
  expect(validateDevicePosition(position(10.7, -85.05,
    APPROXIMATE_DEVICE_LOCATION_ACCURACY_METERS + 1), NOW)).toMatchObject({
    valid: true, approximate: true,
  })
})

test('rejects stale, invalidly timestamped, and excessively inaccurate positions', () => {
  expect(validateDevicePosition(position(10.7, -85.05, 25, NOW - 120001), NOW))
    .toMatchObject({ valid: false, reason: 'stale' })
  expect(validateDevicePosition(position(10.7, -85.05, 25, 0), NOW))
    .toMatchObject({ valid: false, reason: 'stale' })
  expect(validateDevicePosition(position(10.7, -85.05,
    MAX_DEVICE_LOCATION_ACCURACY_METERS + 1), NOW))
    .toMatchObject({ valid: false, reason: 'poor_accuracy' })
})

test('rejects missing accuracy and invalid coordinates', () => {
  expect(validateDevicePosition(position(91, -85, 25), NOW))
    .toMatchObject({ valid: false, reason: 'coordinates' })
  expect(validateDevicePosition(position(10, -85, undefined), NOW))
    .toMatchObject({ valid: false, reason: 'accuracy' })
})

test('measures reverse-label distance without swapping coordinates', () => {
  const distance = distanceBetweenCoordinates(
    { latitude: 10.733, longitude: -85.044 },
    { latitude: 9.95, longitude: -85.65 },
  )
  expect(distance).toBeGreaterThan(100000)
  expect(distanceBetweenCoordinates(
    { latitude: 10.733, longitude: -85.044 },
    { latitude: 10.7331, longitude: -85.0441 },
  )).toBeLessThan(25)
})
