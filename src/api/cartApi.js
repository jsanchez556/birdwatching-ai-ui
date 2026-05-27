import {
  apiUrl,
  authHeaders,
  API_FALLBACK_ERROR_MESSAGE,
  getApiErrorMessage,
  isObject,
  JSON_HEADERS,
  parseJsonResponse,
  validateEnvelope,
} from './http'

function assertCartEnvelope(data) {
  if (!validateEnvelope(data) || data.success !== true || !isObject(data.data) || !isObject(data.meta)) {
    throw new Error(API_FALLBACK_ERROR_MESSAGE)
  }
}

function normalizeCart(cart) {
  if (!isObject(cart)) {
    throw new Error(API_FALLBACK_ERROR_MESSAGE)
  }

  return {
    itineraryStartDate: cart.itineraryStartDate || null,
    itineraryEndDate: cart.itineraryEndDate || null,
    items: Array.isArray(cart.items) ? cart.items : [],
    count: Number.isInteger(Number(cart.count)) ? Number(cart.count) : 0,
  }
}

async function cartRequest(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(apiUrl(path), {
    method,
    headers: {
      ...(body ? JSON_HEADERS : {}),
      ...authHeaders(token),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, API_FALLBACK_ERROR_MESSAGE))
  }

  assertCartEnvelope(data)
  return data.data
}

export async function loadCart({ token } = {}) {
  const data = await cartRequest('/cart', { token })
  return normalizeCart(data.cart)
}

export async function addCartItem(item, { token } = {}) {
  const data = await cartRequest('/cart/items', {
    token,
    method: 'POST',
    body: item,
  })

  if (!isObject(data.item)) {
    throw new Error(API_FALLBACK_ERROR_MESSAGE)
  }

  return data.item
}

export async function updateCartItem(itemId, item, { token } = {}) {
  const data = await cartRequest(`/cart/items/${encodeURIComponent(itemId)}`, {
    token,
    method: 'PATCH',
    body: item,
  })

  if (!isObject(data.item)) {
    throw new Error(API_FALLBACK_ERROR_MESSAGE)
  }

  return data.item
}

export async function removeCartItem(itemId, { token } = {}) {
  await cartRequest(`/cart/items/${encodeURIComponent(itemId)}`, {
    token,
    method: 'DELETE',
  })
}

export async function createCartReservations({ conversationId } = {}, { token } = {}) {
  const data = await cartRequest('/cart/reservations', {
    token,
    method: 'POST',
    body: { conversationId },
  })

  if (!Array.isArray(data.reservations)) {
    throw new Error(API_FALLBACK_ERROR_MESSAGE)
  }

  return data
}

export async function createCartItemReservation({ itemId, conversationId } = {}, { token } = {}) {
  const data = await cartRequest('/cart/reservations', {
    token,
    method: 'POST',
    body: { conversationId, itemIds: [itemId] },
  })

  if (!Array.isArray(data.reservations)) {
    throw new Error(API_FALLBACK_ERROR_MESSAGE)
  }

  return data
}

export async function loadMyTours({ token } = {}) {
  const data = await cartRequest('/cart/reservations', { token })

  if (!Array.isArray(data.reservations)) {
    throw new Error(API_FALLBACK_ERROR_MESSAGE)
  }

  return data.reservations
}
