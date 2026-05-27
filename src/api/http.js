const apiBaseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

export const API_FALLBACK_ERROR_MESSAGE = 'Something went wrong. Please try again.'

export function apiUrl(path) {
  return `${apiBaseUrl}${path}`
}

export function authHeaders(token) {
  return token
    ? { Authorization: `Bearer ${token}` }
    : {}
}

export async function parseJsonResponse(response) {
  return response.json().catch(() => ({}))
}

export function getApiErrorMessage(data, fallbackMessage) {
  return data?.meta?.message || data?.error?.message || data?.error || fallbackMessage
}

export function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function validateEnvelope(data) {
  return isObject(data)
    && Object.prototype.hasOwnProperty.call(data, 'success')
    && Object.prototype.hasOwnProperty.call(data, 'data')
    && Object.prototype.hasOwnProperty.call(data, 'meta')
}

export const JSON_HEADERS = {
  'Content-Type': 'application/json',
}
