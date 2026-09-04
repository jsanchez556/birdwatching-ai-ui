import { DEFAULT_TOUR_TYPE, displayTourType, TOUR_TYPES } from '../tourTypes'

test('exposes the canonical customer-facing tour types', () => {
  expect(TOUR_TYPES).toEqual([
    'Birdwatching',
    'Day walk',
    'Night walk',
    'Day & Night Walk',
    'Adventure',
    'Excursion',
    'Transfer',
    'Other',
  ])
  expect(DEFAULT_TOUR_TYPE).toBe('Birdwatching')
  expect(displayTourType('Day & Night Walk')).toBe('Day & Night Walk')
  expect(displayTourType('Parks')).toBe('Other · Parks')
})
