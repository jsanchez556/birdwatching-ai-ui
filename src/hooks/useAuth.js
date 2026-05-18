import { useCallback, useState } from 'react'
import { login as loginRequest, signup as signupRequest } from '../api/authApi'

const AUTH_STORAGE_KEY = 'birdwatchingAI.authState'

function readStoredAuthState() {
  try {
    const stored = window.localStorage.getItem(AUTH_STORAGE_KEY)
    const parsed = stored ? JSON.parse(stored) : null

    if (
      parsed
      && typeof parsed === 'object'
      && typeof parsed.token === 'string'
      && parsed.user
      && typeof parsed.user.email === 'string'
    ) {
      return {
        token: parsed.token,
        user: {
          id: parsed.user.id,
          email: parsed.user.email,
          name: parsed.user.name || null,
        },
      }
    }
  } catch {
    return null
  }

  return null
}

function persistAuthState(authState) {
  try {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authState))
  } catch {
    // Auth still works for this tab when storage is unavailable.
  }
}

function clearAuthState() {
  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
  } catch {
    // Nothing else to do when storage is unavailable.
  }
}

export default function useAuth() {
  const [initialAuthState] = useState(readStoredAuthState)
  const [user, setUser] = useState(initialAuthState?.user || null)
  const [token, setToken] = useState(initialAuthState?.token || null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const applyAuthResult = useCallback((result) => {
    setUser(result.user)
    setToken(result.token)
    persistAuthState(result)
  }, [])

  const signup = useCallback(async (credentials) => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await signupRequest(credentials)
      applyAuthResult(result)
      return result
    } catch (requestError) {
      setError(requestError.message)
      throw requestError
    } finally {
      setIsLoading(false)
    }
  }, [applyAuthResult])

  const login = useCallback(async (credentials) => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await loginRequest(credentials)
      applyAuthResult(result)
      return result
    } catch (requestError) {
      setError(requestError.message)
      throw requestError
    } finally {
      setIsLoading(false)
    }
  }, [applyAuthResult])

  const logout = useCallback(() => {
    setUser(null)
    setToken(null)
    setError(null)
    clearAuthState()
  }, [])

  return {
    user,
    token,
    isAuthenticated: Boolean(token && user),
    isLoading,
    error,
    signup,
    login,
    logout,
  }
}
