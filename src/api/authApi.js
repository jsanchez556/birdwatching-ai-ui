import {
  apiUrl,
  authHeaders,
  getApiErrorMessage,
  isObject,
  JSON_HEADERS,
  parseJsonResponse,
  validateEnvelope,
} from './http'

function normalizeSafeUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name || null,
    role: user.role || 'customer',
    plan: user.plan || 'FREE',
    imageUrl: user.imageUrl || user.profileImageUrl || user.avatarUrl || null,
  }
}

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
    user: normalizeSafeUser(data.data.user),
  }
}

async function parseProfileResponse(response, fallbackMessage) {
  const data = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, fallbackMessage))
  }

  if (
    !validateEnvelope(data)
    || data.success !== true
    || !isObject(data.data)
    || !isObject(data.data.user)
    || typeof data.data.user.email !== 'string'
  ) {
    throw new Error('Unexpected profile response format')
  }

  return {
    user: normalizeSafeUser(data.data.user),
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

export async function updateProfile({ token, name }) {
  const response = await fetch(apiUrl('/auth/profile'), {
    method: 'PATCH',
    headers: {
      ...JSON_HEADERS,
      ...authHeaders(token),
    },
    body: JSON.stringify({ name }),
  })

  return parseProfileResponse(response, 'Unable to update your profile')
}

export async function updateProfileImage({ token, file }) {
  const response = await fetch(apiUrl('/auth/profile-image'), {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': file.type,
      'X-Filename': file.name,
    },
    body: file,
  })

  return parseProfileResponse(response, 'Unable to update your profile image')
}
