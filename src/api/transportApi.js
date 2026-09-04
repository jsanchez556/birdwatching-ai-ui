import { API_FALLBACK_ERROR_MESSAGE, JSON_HEADERS, apiUrl, authHeaders, getApiErrorMessage, isObject, parseJsonResponse, validateEnvelope } from './http'

async function request(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(apiUrl(path), {
    method,
    headers: { ...JSON_HEADERS, ...authHeaders(token) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const envelope = await parseJsonResponse(response)
  if (!response.ok) throw new Error(getApiErrorMessage(envelope, API_FALLBACK_ERROR_MESSAGE))
  if (!validateEnvelope(envelope) || envelope.success !== true || !isObject(envelope.data)) {
    throw new Error(API_FALLBACK_ERROR_MESSAGE)
  }
  return envelope.data
}

export async function quoteTransportRoute({ originPlaceId, destinationPlaceId, token }) {
  const data = await request('/transport/routes/quote', { method: 'POST', token, body: {
    origin: { placeId: originPlaceId }, destination: { placeId: destinationPlaceId },
  } })
  if (!data.routeToken || !isObject(data.origin) || !isObject(data.destination) || !Number.isFinite(data.distanceKm) || !Number.isInteger(data.durationMinutes)) {
    throw new Error(API_FALLBACK_ERROR_MESSAGE)
  }
  return data
}

export async function loadTransportVehicles({ routeToken, passengers, luggage, token }) {
  const params = new URLSearchParams({ routeToken, passengers: String(passengers), luggage: String(luggage) })
  const data = await request(`/transport/vehicles?${params}`, { token })
  if (!Array.isArray(data.vehicles) || data.vehicles.some((vehicle) => !isObject(vehicle) || !vehicle.quoteToken)) {
    throw new Error(API_FALLBACK_ERROR_MESSAGE)
  }
  return data.vehicles
}

export async function loadTransportCheckoutContext({ token }) {
  const data = await request('/transport/checkout-context', { token })
  if (!isObject(data.contact) || !Array.isArray(data.paymentOptions)) throw new Error(API_FALLBACK_ERROR_MESSAGE)
  return data
}

export async function createTransportBooking({ booking, token }) {
  const data = await request('/transport/bookings', { method: 'POST', token, body: booking })
  if (!data.bookingReference || !data.bookingStatus) throw new Error(API_FALLBACK_ERROR_MESSAGE)
  return data
}
