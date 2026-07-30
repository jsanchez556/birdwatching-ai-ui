/**
 * @typedef {'available'|'limited'|'unavailable'|'unknown'} AvailabilityStatus
 * @typedef {{amount: number|null, currency: string|null}} EstimatedPrice
 * @typedef {{
 *   tourId: string,
 *   tourName: string,
 *   location: string,
 *   estimatedPrice: EstimatedPrice,
 *   matchReasons: string[],
 *   availabilityStatus: AvailabilityStatus,
 *   confidence: number
 * }} TourRecommendationItem
 * @typedef {{
 *   summary: string,
 *   recommendations: TourRecommendationItem[],
 *   sources: {title: string, url: string|null}[],
 *   assumptions: string[],
 *   followUpQuestion: string|null
 * }} TourRecommendation
 */

const AVAILABILITY_STATUSES = new Set([
  'available',
  'limited',
  'unavailable',
  'unknown',
])

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function hasExactKeys(value, keys) {
  const actualKeys = Object.keys(value).sort()
  return actualKeys.length === keys.length
    && actualKeys.every((key, index) => key === [...keys].sort()[index])
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function isNullableUrl(value) {
  if (value === null) return true
  if (!isNonEmptyString(value)) return false

  try {
    return ['http:', 'https:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}

function isEstimatedPrice(value) {
  if (!isObject(value) || !hasExactKeys(value, ['amount', 'currency'])) return false

  const bothUnknown = value.amount === null && value.currency === null
  const bothKnown = typeof value.amount === 'number'
    && Number.isFinite(value.amount)
    && value.amount >= 0
    && typeof value.currency === 'string'
    && /^[A-Z]{3}$/.test(value.currency)

  return bothUnknown || bothKnown
}

function isRecommendation(value) {
  return isObject(value)
    && hasExactKeys(value, [
      'tourId',
      'tourName',
      'location',
      'estimatedPrice',
      'matchReasons',
      'availabilityStatus',
      'confidence',
    ])
    && isNonEmptyString(value.tourId)
    && isNonEmptyString(value.tourName)
    && isNonEmptyString(value.location)
    && isEstimatedPrice(value.estimatedPrice)
    && Array.isArray(value.matchReasons)
    && value.matchReasons.length > 0
    && value.matchReasons.every((reason) => isNonEmptyString(reason) && reason.trim().length >= 3)
    && AVAILABILITY_STATUSES.has(value.availabilityStatus)
    && typeof value.confidence === 'number'
    && Number.isFinite(value.confidence)
    && value.confidence >= 0
    && value.confidence <= 1
}

/**
 * @param {unknown} value
 * @returns {value is TourRecommendation}
 */
export function isTourRecommendation(value) {
  return isObject(value)
    && hasExactKeys(value, [
      'summary',
      'recommendations',
      'sources',
      'assumptions',
      'followUpQuestion',
    ])
    && isNonEmptyString(value.summary)
    && Array.isArray(value.recommendations)
    && value.recommendations.every(isRecommendation)
    && Array.isArray(value.sources)
    && value.sources.every((source) => (
      isObject(source)
      && hasExactKeys(source, ['title', 'url'])
      && isNonEmptyString(source.title)
      && isNullableUrl(source.url)
    ))
    && Array.isArray(value.assumptions)
    && value.assumptions.every(isNonEmptyString)
    && (value.followUpQuestion === null || isNonEmptyString(value.followUpQuestion))
}

/**
 * @param {unknown} metadata
 * @returns {unknown}
 */
export function sanitizeTourRecommendationMetadata(metadata) {
  if (!isObject(metadata)) return metadata

  const { tourRecommendation, ...rest } = metadata
  return isTourRecommendation(tourRecommendation)
    ? { ...rest, tourRecommendation }
    : rest
}
