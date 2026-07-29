import {
  API_FALLBACK_ERROR_MESSAGE,
  apiUrl,
  isObject,
  parseJsonResponse,
  validateEnvelope,
} from './http'

const FEATURES = new Set([
  'voice_ai',
  'multimodal_bird_identification',
  'agent_booking',
])

function isIsoTimestamp(value) {
  return typeof value === 'string'
    && !Number.isNaN(new Date(value).getTime())
    && new Date(value).toISOString() === value
}

export async function getFeatureAvailability({ signal } = {}) {
  const response = await fetch(apiUrl('/features/availability'), { signal })
  const envelope = await parseJsonResponse(response)
  if (
    !response.ok
    || !validateEnvelope(envelope)
    || envelope.success !== true
    || !isObject(envelope.data)
    || !isObject(envelope.meta)
    || !Array.isArray(envelope.data.features)
    || envelope.data.features.length !== FEATURES.size
  ) {
    throw new Error(API_FALLBACK_ERROR_MESSAGE)
  }

  const seen = new Set()
  for (const feature of envelope.data.features) {
    if (
      !isObject(feature)
      || !FEATURES.has(feature.name)
      || seen.has(feature.name)
      || typeof feature.enabled !== 'boolean'
      || feature.status !== (feature.enabled ? 'enabled' : 'disabled')
      || (feature.enabled ? feature.disabledUntil !== null : !isIsoTimestamp(feature.disabledUntil))
    ) {
      throw new Error(API_FALLBACK_ERROR_MESSAGE)
    }
    seen.add(feature.name)
  }
  return envelope.data
}

export { FEATURES as AVAILABLE_AI_FEATURES }
