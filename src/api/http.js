const apiBaseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

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
  return data.error?.message || data.error || fallbackMessage
}

export const JSON_HEADERS = {
  'Content-Type': 'application/json',
}
