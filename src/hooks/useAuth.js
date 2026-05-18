import { useCallback, useState } from 'react'
import {
  login as loginRequest,
  logoutSession,
  refreshSession,
  signup as signupRequest,
} from '../api/authApi'
import { AUTH_STORAGE_KEY, readJsonStorage, removeStorageItem, writeJsonStorage } from '../utils/storage'

const VISITOR_USER = {
  id: 'visitor',
  email: null,
  name: 'Visitor',
  role: 'visitor',
}
const TOKEN_REFRESH_BUFFER_MS = 60 * 1000
const SESSION_EXPIRED_MESSAGE = 'Your session expired. Please log in again.'

function isExpiringSoon(expiresAt) {
  if (!expiresAt) {
    return true
  }

  const expiresAtMs = new Date(expiresAt).getTime()
  return !Number.isFinite(expiresAtMs) || expiresAtMs - Date.now() <= TOKEN_REFRESH_BUFFER_MS
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
      refreshToken: null,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
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
      refreshToken: typeof parsed.refreshToken === 'string' ? parsed.refreshToken : null,
      accessTokenExpiresAt: parsed.accessTokenExpiresAt || null,
      refreshTokenExpiresAt: parsed.refreshTokenExpiresAt || null,
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
  const [refreshToken, setRefreshToken] = useState(initialAuthState?.refreshToken || null)
  const [accessTokenExpiresAt, setAccessTokenExpiresAt] = useState(initialAuthState?.accessTokenExpiresAt || null)
  const [refreshTokenExpiresAt, setRefreshTokenExpiresAt] = useState(initialAuthState?.refreshTokenExpiresAt || null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const applyAuthResult = useCallback((result) => {
    setUser(result.user)
    setToken(result.token)
    setRefreshToken(result.refreshToken || null)
    setAccessTokenExpiresAt(result.accessTokenExpiresAt || null)
    setRefreshTokenExpiresAt(result.refreshTokenExpiresAt || null)
    persistAuthState(result)
  }, [])

  const clearSession = useCallback((message = null) => {
    setUser(null)
    setToken(null)
    setRefreshToken(null)
    setAccessTokenExpiresAt(null)
    setRefreshTokenExpiresAt(null)
    setError(message)
    clearAuthState()
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
    setRefreshToken(null)
    setAccessTokenExpiresAt(null)
    setRefreshTokenExpiresAt(null)
    setError(null)
    persistAuthState(visitorState)
  }, [])

  const logout = useCallback(() => {
    const activeRefreshToken = refreshToken
    clearSession()
    Promise.resolve(logoutSession(activeRefreshToken)).catch(() => {})
  }, [clearSession, refreshToken])

  const getValidToken = useCallback(async () => {
    if (user?.role === 'visitor') {
      return null
    }

    if (!token || !refreshToken) {
      clearSession(SESSION_EXPIRED_MESSAGE)
      throw new Error(SESSION_EXPIRED_MESSAGE)
    }

    if (!isExpiringSoon(accessTokenExpiresAt)) {
      return token
    }

    try {
      const result = await refreshSession(refreshToken)
      applyAuthResult(result)
      return result.token
    } catch {
      clearSession(SESSION_EXPIRED_MESSAGE)
      throw new Error(SESSION_EXPIRED_MESSAGE)
    }
  }, [accessTokenExpiresAt, applyAuthResult, clearSession, refreshToken, token, user?.role])

  return {
    user,
    token,
    refreshToken,
    accessTokenExpiresAt,
    refreshTokenExpiresAt,
    isAuthenticated: Boolean(token && user),
    isVisitor: user?.role === 'visitor',
    isLoading,
    error,
    signup,
    login,
    enterAsVisitor,
    getValidToken,
    logout,
  }
}
