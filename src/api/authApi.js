const apiBaseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

function apiUrl(path) {
  return `${apiBaseUrl}${path}`
}

async function parseAuthResponse(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const errorMessage = data.error?.message || data.error || fallbackMessage
    throw new Error(errorMessage)
  }

  if (
    !data.success
    || !data.data
    || typeof data.data.token !== 'string'
    || !data.data.user
    || typeof data.data.user.email !== 'string'
  ) {
    throw new Error('Unexpected authentication response format')
  }

  return {
    token: data.data.token,
    user: {
      id: data.data.user.id,
      email: data.data.user.email,
      name: data.data.user.name || null,
    },
  }
}

export async function signup({ email, password, name }) {
  const response = await fetch(apiUrl('/auth/signup'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password, name }),
  })

  return parseAuthResponse(response, 'Unable to create your account')
}

export async function login({ email, password }) {
  const response = await fetch(apiUrl('/auth/login'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })

  return parseAuthResponse(response, 'Unable to log in')
}
