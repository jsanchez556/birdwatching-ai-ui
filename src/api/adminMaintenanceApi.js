import {
  apiUrl, authHeaders, getApiErrorMessage, isObject, JSON_HEADERS,
  parseJsonResponse, validateEnvelope,
} from './http'
import { appendMediaVersion } from './mediaApi'

export { appendMediaVersion as appendTourImageVersion } from './mediaApi'

export const MAINTENANCE_RESOURCES = Object.freeze([
  'countries', 'zones', 'nodes', 'birds', 'birds-by-node', 'tours',
])

const RESOURCE_SET = new Set(MAINTENANCE_RESOURCES)
const FALLBACK = 'The maintenance request could not be completed.'

function requireResource(resource) {
  if (!RESOURCE_SET.has(resource)) throw new Error('Unsupported maintenance resource')
}

async function request(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(apiUrl(path), {
    method,
    headers: { ...JSON_HEADERS, ...authHeaders(token) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const envelope = await parseJsonResponse(response)
  if (!response.ok) {
    const error = new Error(getApiErrorMessage(envelope, FALLBACK))
    error.status = response.status
    error.code = envelope?.error?.code || 'MAINTENANCE_REQUEST_FAILED'
    error.retryable = response.status >= 500
    throw error
  }
  if (!validateEnvelope(envelope) || envelope.success !== true || !isObject(envelope.data)) {
    throw new Error(FALLBACK)
  }
  return envelope
}

export async function listMaintenance(resource, {
  token, search = '', page = 1, limit = 25, countryId, zoneId, nodeId, type, status, difficulty,
} = {}) {
  requireResource(resource)
  const query = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (search) query.set('search', search)
  if (countryId) query.set('countryId', String(countryId))
  if (zoneId) query.set('zoneId', String(zoneId))
  if (nodeId) query.set('nodeId', String(nodeId))
  if (type) query.set('type', type)
  if (status) query.set('status', status)
  if (difficulty) query.set('difficulty', difficulty)
  const envelope = await request(`/admin/${resource}?${query}`, { token })
  if (!Array.isArray(envelope.data.items) || !isObject(envelope.meta)) throw new Error(FALLBACK)
  return { items: envelope.data.items, meta: envelope.meta, tourTypes: envelope.data.tourTypes || [] }
}

export async function getMaintenance(resource, id, { token } = {}) {
  requireResource(resource)
  const envelope = await request(`/admin/${resource}/${encodeURIComponent(id)}`, { token })
  if (!isObject(envelope.data.entity)) throw new Error(FALLBACK)
  return envelope.data.entity
}

export async function createMaintenance(resource, data, { token } = {}) {
  requireResource(resource)
  const envelope = await request(`/admin/${resource}`, { token, method: 'POST', body: data })
  if (!isObject(envelope.data.entity)) throw new Error(FALLBACK)
  return envelope.data.entity
}

export async function updateMaintenance(resource, id, data, { token } = {}) {
  requireResource(resource)
  const envelope = await request(`/admin/${resource}/${encodeURIComponent(id)}`, {
    token, method: 'PATCH', body: data,
  })
  if (!isObject(envelope.data.entity)) throw new Error(FALLBACK)
  return envelope.data.entity
}

const TOUR_IMAGE_PATH_PATTERN = /^tours\/(?:[1-9]\d*(?:\.png)?|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png)$/

export function getTourImageReference(tourId, imagePath = '', version = '') {
  const storedPath = typeof imagePath === 'string'
    ? imagePath.trim().replace(/^\/+/, '').replace(/^files\/+/, '')
    : ''
  const normalizedId = String(tourId ?? '').trim()
  const hasValidId = /^\d+$/.test(normalizedId) && Number(normalizedId) > 0
  const key = storedPath
    ? TOUR_IMAGE_PATH_PATTERN.test(storedPath)
      ? /^tours\/[1-9]\d*$/.test(storedPath) ? `${storedPath}.png` : storedPath
      : ''
    : hasValidId ? `tours/${Number(normalizedId)}.png` : ''
  if (!key) return ''
  const reference = `/files/${key.split('/').map(encodeURIComponent).join('/')}`
  return storedPath ? appendMediaVersion(reference, version) : reference
}

export async function uploadTourImage(id, file, { token } = {}) {
  const formData = new FormData()
  formData.append('image', file, file.name)
  const response = await fetch(apiUrl(`/admin/tours/${encodeURIComponent(id)}/image`), {
    method: 'PUT',
    headers: authHeaders(token),
    body: formData,
  })
  const envelope = await parseJsonResponse(response)
  if (!response.ok) {
    const error = new Error(getApiErrorMessage(envelope, 'Unable to update the tour image.'))
    error.status = response.status
    error.code = envelope?.error?.code || 'TOUR_IMAGE_REQUEST_FAILED'
    error.retryable = response.status >= 500
    throw error
  }
  if (!validateEnvelope(envelope) || envelope.success !== true || !isObject(envelope.data)
    || !isObject(envelope.data.tour) || typeof envelope.data.tour.imagePath !== 'string'
    || !isObject(envelope.data.image)
    || typeof envelope.data.image.key !== 'string'
    || typeof envelope.data.image.url !== 'string'
    || typeof envelope.data.image.version !== 'string'
    || typeof envelope.data.image.cleanupPending !== 'boolean'
    || envelope.data.tour.imagePath !== envelope.data.image.key) {
    throw new Error(FALLBACK)
  }
  return envelope.data
}

export async function deleteMaintenance(resource, id, { token } = {}) {
  requireResource(resource)
  const envelope = await request(`/admin/${resource}/${encodeURIComponent(id)}`, {
    token, method: 'DELETE',
  })
  if (!isObject(envelope.data.entity) || typeof envelope.data.archived !== 'boolean') {
    throw new Error(FALLBACK)
  }
  return envelope.data
}

export async function searchAdminLocations(query, { token, countryCode } = {}) {
  const params = new URLSearchParams({ q: String(query || '').trim() })
  if (countryCode) params.set('countryCode', String(countryCode).trim().toLowerCase())
  const envelope = await request(`/admin/location-search?${params}`, { token })
  if (!Array.isArray(envelope.data.items)) throw new Error(FALLBACK)
  return envelope.data.items
}

export async function reverseGeocodeAdminLocation({ latitude, longitude }, { token } = {}) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
  })
  const envelope = await request(`/admin/location-search?${params}`, { token })
  if (!Array.isArray(envelope.data.items)) throw new Error(FALLBACK)
  const location = envelope.data.items[0] || null
  if (location !== null && (!isObject(location) || typeof location.name !== 'string'
    || !Number.isFinite(Number(location.latitude)) || !Number.isFinite(Number(location.longitude)))) {
    throw new Error(FALLBACK)
  }
  return location
}
