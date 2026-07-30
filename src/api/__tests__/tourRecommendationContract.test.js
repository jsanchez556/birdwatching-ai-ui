import {
  isTourRecommendation,
  sanitizeTourRecommendationMetadata,
} from '../tourRecommendationContract'

const validRecommendation = {
  summary: 'I found one supported match.',
  recommendations: [{
    tourId: '12',
    tourName: 'Monteverde Quetzal Tour',
    location: 'Monteverde',
    estimatedPrice: {
      amount: 120,
      currency: 'USD',
    },
    matchReasons: ['Matches Monteverde', 'Fits a moderate budget'],
    availabilityStatus: 'available',
    confidence: 0.94,
  }],
  sources: [],
  assumptions: [],
  followUpQuestion: 'Which tour interests you?',
}

describe('tour recommendation API contract', () => {
  test('accepts valid, multiple, and empty recommendation payloads', () => {
    expect(isTourRecommendation(validRecommendation)).toBe(true)
    expect(isTourRecommendation({
      ...validRecommendation,
      recommendations: [
        ...validRecommendation.recommendations,
        {
          ...validRecommendation.recommendations[0],
          tourId: '13',
          availabilityStatus: 'limited',
        },
      ],
    })).toBe(true)
    expect(isTourRecommendation({
      ...validRecommendation,
      recommendations: [],
      followUpQuestion: null,
    })).toBe(true)
  })

  test.each([
    ['confidence', { confidence: 1.2 }],
    ['price', { estimatedPrice: { amount: -1, currency: 'USD' } }],
    ['currency', { estimatedPrice: { amount: 120, currency: '$' } }],
    ['availability', { availabilityStatus: 'maybe' }],
    ['reasons', { matchReasons: [] }],
    ['required field', { tourId: undefined }],
  ])('rejects invalid %s without preserving partial metadata', (_label, patch) => {
    const invalidRecommendation = {
      ...validRecommendation,
      recommendations: [{
        ...validRecommendation.recommendations[0],
        ...patch,
      }],
    }
    const sanitized = sanitizeTourRecommendationMetadata({
      uiAction: { type: 'choice' },
      tourRecommendation: invalidRecommendation,
    })

    expect(isTourRecommendation(invalidRecommendation)).toBe(false)
    expect(sanitized).toEqual({ uiAction: { type: 'choice' } })
  })

  test('accepts explicit unknown price and availability', () => {
    expect(isTourRecommendation({
      ...validRecommendation,
      recommendations: [{
        ...validRecommendation.recommendations[0],
        estimatedPrice: { amount: null, currency: null },
        availabilityStatus: 'unknown',
      }],
    })).toBe(true)
  })
})
