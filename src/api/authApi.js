import {
  apiUrl,
  getApiErrorMessage,
  JSON_HEADERS,
  parseJsonResponse,
} from './http'

async function parseAuthResponse(response, fallbackMessage) {
  const data = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, fallbackMessage))
  }

  if (
    !data.success
    || !data.data
    || typeof data.data.token !== 'string'
    || typeof data.data.refreshToken !== 'string'
    || !data.data.user
    || typeof data.data.user.email !== 'string'
  ) {
    throw new Error('Unexpected authentication response format')
  }

  return {
    token: data.data.token,
    accessTokenExpiresAt: data.data.accessTokenExpiresAt || null,
    refreshToken: data.data.refreshToken,
    refreshTokenExpiresAt: data.data.refreshTokenExpiresAt || null,
    user: {
      id: data.data.user.id,
      email: data.data.user.email,
      name: data.data.user.name || null,
      role: data.data.user.role || 'customer',
    },
  }
}

export async function signup({ email, password, name }) {
  const response = await fetch(apiUrl('/auth/signup'), {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ email, password, name }),
  })

  return parseAuthResponse(response, 'Unable to create your account')
}

export async function login({ email, password }) {
  const response = await fetch(apiUrl('/auth/login'), {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ email, password }),
  })

  return parseAuthResponse(response, 'Unable to log in')
}

export async function refreshSession(refreshToken) {
  const response = await fetch(apiUrl('/auth/refresh'), {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ refreshToken }),
  })

  return parseAuthResponse(response, 'Your session expired. Please log in again.')
}

export async function logoutSession(refreshToken) {
  if (!refreshToken) {
    return
  }

  const response = await fetch(apiUrl('/auth/logout'), {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ refreshToken }),
  })

  if (!response.ok) {
    return
  }

  await parseJsonResponse(response)
}
