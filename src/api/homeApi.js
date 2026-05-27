import {
  apiUrl,
  getApiErrorMessage,
  parseJsonResponse,
} from './http'

async function getEnvelope(path, fallbackMessage) {
  const response = await fetch(apiUrl(path))
  const data = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, fallbackMessage))
  }

  if (!data.success || !data.data) {
    throw new Error('Unexpected homepage response format')
  }

  return data.data
}

function requireArray(value, message) {
  if (!Array.isArray(value)) {
    throw new Error(message)
  }

  return value
}

function normalizeHero(value) {
  if (!value || typeof value !== 'object') {
    throw new Error('Unexpected hero response')
  }

  return {
    heroVideo: typeof value.heroVideo === 'string' ? value.heroVideo : '',
  }
}

export async function loadHeroContent() {
  const data = await getEnvelope('/homepage/hero', 'Unable to load hero content')
  return normalizeHero(data.hero)
}

export async function loadFeaturedTours() {
  const data = await getEnvelope('/tours', 'Unable to load tours')
  return requireArray(data.tours, 'Unexpected tours response')
}

export async function loadBirdHighlights() {
  const data = await getEnvelope('/birds/highlights', 'Unable to load bird highlights')
  return requireArray(data.birds, 'Unexpected bird highlights response')
}

export async function loadBirdProfile({ speciesCode, name }) {
  const params = new URLSearchParams()

  if (speciesCode) {
    params.set('speciesCode', speciesCode)
  }

  if (name) {
    params.set('name', name)
  }

  const data = await getEnvelope(
    `/birds/profile?${params.toString()}`,
    'Unable to load bird profile'
  )

  if (!data.bird || typeof data.bird !== 'object') {
    throw new Error('Unexpected bird profile response')
  }

  return data.bird
}

export async function loadTransportationAddOns() {
  const data = await getEnvelope('/addons/transportation', 'Unable to load transportation options')
  return requireArray(data.transportation, 'Unexpected transportation response')
}
