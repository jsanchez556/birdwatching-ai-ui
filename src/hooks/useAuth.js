import { useCallback, useState } from 'react'
import { login as loginRequest, signup as signupRequest } from '../api/authApi'
import { AUTH_STORAGE_KEY, readJsonStorage, removeStorageItem, writeJsonStorage } from '../utils/storage'

const VISITOR_USER = {
  id: 'visitor',
  email: null,
  name: 'Visitor',
  role: 'visitor',
}

function readStoredAuthState() {
  const parsed = readJsonStorage(AUTH_STORAGE_KEY)

  if (
    parsed
    && typeof parsed === 'object'
    && parsed.user?.role === 'visitor'
  ) {
    return {
      token: null,
      user: VISITOR_USER,
    }
  }

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
        role: parsed.user.role || 'customer',
      },
    }
  }

  return null
}

function persistAuthState(authState) {
  writeJsonStorage(AUTH_STORAGE_KEY, authState)
}

function clearAuthState() {
  removeStorageItem(AUTH_STORAGE_KEY)
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

  const enterAsVisitor = useCallback(() => {
    const visitorState = {
      token: null,
      user: VISITOR_USER,
    }

    setUser(visitorState.user)
    setToken(null)
    setError(null)
    persistAuthState(visitorState)
  }, [])

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
    isVisitor: user?.role === 'visitor',
    isLoading,
    error,
    signup,
    login,
    enterAsVisitor,
    logout,
  }
}
