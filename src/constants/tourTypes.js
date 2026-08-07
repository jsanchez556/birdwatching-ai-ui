export const TOUR_TYPES = Object.freeze([
  'Birdwatching', 'Day walk', 'Night walk', 'Parks', 'Other',
])

export const DEFAULT_TOUR_TYPE = TOUR_TYPES[0]

export function displayTourType(value) {
  return TOUR_TYPES.includes(value) ? value : value ? `Other · ${value}` : DEFAULT_TOUR_TYPE
}
