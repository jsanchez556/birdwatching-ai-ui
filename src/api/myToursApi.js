import {
  apiUrl, authHeaders, getApiErrorMessage, isObject, JSON_HEADERS,
  parseJsonResponse, validateEnvelope,
} from './http'

const FALLBACK = 'The tour-management request could not be completed.'

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
    error.code = envelope?.error?.code || 'MY_TOURS_REQUEST_FAILED'
    error.retryable = response.status >= 500
    throw error
  }
  if (!validateEnvelope(envelope) || envelope.success !== true || !isObject(envelope.data)) {
    throw new Error(FALLBACK)
  }
  return envelope
}

export async function listMyTours({
  token, search = '', page = 1, limit = 25, type, status, difficulty, countryId, zoneId, nodeId,
} = {}) {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (search) query.set('search', search)
  if (type) query.set('type', type)
  if (status) query.set('status', status)
  if (difficulty) query.set('difficulty', difficulty)
  if (countryId) query.set('countryId', String(countryId))
  if (zoneId) query.set('zoneId', String(zoneId))
  if (nodeId) query.set('nodeId', String(nodeId))
  const envelope = await request(`/my-tours?${query}`, { token })
  if (!Array.isArray(envelope.data.items) || !isObject(envelope.meta)) throw new Error(FALLBACK)
  return { items: envelope.data.items, meta: envelope.meta }
}

export async function createMyTour(data, { token } = {}) {
  const envelope = await request('/my-tours', { token, method: 'POST', body: data })
  if (!isObject(envelope.data.entity)) throw new Error(FALLBACK)
  return envelope.data.entity
}

export async function updateMyTour(id, data, { token } = {}) {
  const envelope = await request(`/my-tours/${encodeURIComponent(id)}`, {
    token, method: 'PATCH', body: data,
  })
  if (!isObject(envelope.data.entity)) throw new Error(FALLBACK)
  return envelope.data.entity
}

export async function loadMyTourReferences({ token } = {}) {
  const envelope = await request('/my-tours/references', { token })
  if (!['countries', 'zones', 'nodes'].every((key) => Array.isArray(envelope.data[key]))) {
    throw new Error(FALLBACK)
  }
  return envelope.data
}
