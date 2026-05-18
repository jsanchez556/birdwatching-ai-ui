import { act, renderHook } from '@testing-library/react'
import useAuth from '../useAuth'
import { login, logoutSession, refreshSession, signup } from '../../api/authApi'

jest.mock('../../api/authApi', () => ({
  login: jest.fn(),
  logoutSession: jest.fn(),
  refreshSession: jest.fn(),
  signup: jest.fn(),
}))

describe('useAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    window.localStorage.clear()
  })

  test('restores auth state from localStorage', () => {
    window.localStorage.setItem('birdwatchingAI.authState', JSON.stringify({
      token: 'stored-token',
      refreshToken: 'stored-refresh-token',
      accessTokenExpiresAt: '2099-01-01T00:00:00.000Z',
      user: {
        id: 'user-1',
        email: 'ana@example.com',
        name: 'Ana Gomez',
      },
    }))

    const { result } = renderHook(() => useAuth())

    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.token).toBe('stored-token')
    expect(result.current.refreshToken).toBe('stored-refresh-token')
    expect(result.current.user).toEqual({
      id: 'user-1',
      email: 'ana@example.com',
      name: 'Ana Gomez',
      role: 'customer',
    })
  })

  test('persists login results', async () => {
    login.mockResolvedValue({
      token: 'login-token',
      refreshToken: 'login-refresh-token',
      accessTokenExpiresAt: '2099-01-01T00:00:00.000Z',
      refreshTokenExpiresAt: '2099-02-01T00:00:00.000Z',
      user: {
        id: 'user-1',
        email: 'ana@example.com',
        name: 'Ana Gomez',
      },
    })

    const { result } = renderHook(() => useAuth())

    await act(async () => {
      await result.current.login({
        email: 'ana@example.com',
        password: 'secure-password',
      })
    })

    expect(result.current.isAuthenticated).toBe(true)
    expect(JSON.parse(window.localStorage.getItem('birdwatchingAI.authState'))).toMatchObject({
      token: 'login-token',
      refreshToken: 'login-refresh-token',
      user: {
        email: 'ana@example.com',
      },
    })
  })

  test('persists signup results', async () => {
    signup.mockResolvedValue({
      token: 'signup-token',
      refreshToken: 'signup-refresh-token',
      accessTokenExpiresAt: '2099-01-01T00:00:00.000Z',
      refreshTokenExpiresAt: '2099-02-01T00:00:00.000Z',
      user: {
        id: 'user-2',
        email: 'maria@example.com',
        name: 'Maria Solis',
      },
    })

    const { result } = renderHook(() => useAuth())

    await act(async () => {
      await result.current.signup({
        name: 'Maria Solis',
        email: 'maria@example.com',
        password: 'secure-password',
      })
    })

    expect(result.current.token).toBe('signup-token')
    expect(JSON.parse(window.localStorage.getItem('birdwatchingAI.authState'))).toMatchObject({
      user: {
        email: 'maria@example.com',
      },
    })
  })

  test('logout clears auth state', async () => {
    window.localStorage.setItem('birdwatchingAI.authState', JSON.stringify({
      token: 'stored-token',
      refreshToken: 'stored-refresh-token',
      user: {
        email: 'ana@example.com',
      },
    }))

    const { result } = renderHook(() => useAuth())

    act(() => {
      result.current.logout()
    })

    expect(result.current.isAuthenticated).toBe(false)
    expect(window.localStorage.getItem('birdwatchingAI.authState')).toBeNull()
    expect(logoutSession).toHaveBeenCalledWith('stored-refresh-token')
  })

  test('refreshes an expiring access token', async () => {
    window.localStorage.setItem('birdwatchingAI.authState', JSON.stringify({
      token: 'stored-token',
      refreshToken: 'stored-refresh-token',
      accessTokenExpiresAt: '2020-01-01T00:00:00.000Z',
      user: {
        id: 'user-1',
        email: 'ana@example.com',
      },
    }))
    refreshSession.mockResolvedValue({
      token: 'fresh-token',
      refreshToken: 'fresh-refresh-token',
      accessTokenExpiresAt: '2099-01-01T00:00:00.000Z',
      refreshTokenExpiresAt: '2099-02-01T00:00:00.000Z',
      user: {
        id: 'user-1',
        email: 'ana@example.com',
        role: 'customer',
      },
    })

    const { result } = renderHook(() => useAuth())
    let token

    await act(async () => {
      token = await result.current.getValidToken()
    })

    expect(token).toBe('fresh-token')
    expect(refreshSession).toHaveBeenCalledWith('stored-refresh-token')
    expect(JSON.parse(window.localStorage.getItem('birdwatchingAI.authState'))).toMatchObject({
      token: 'fresh-token',
      refreshToken: 'fresh-refresh-token',
    })
  })

  test('clears session when refresh fails', async () => {
    window.localStorage.setItem('birdwatchingAI.authState', JSON.stringify({
      token: 'stored-token',
      refreshToken: 'stored-refresh-token',
      accessTokenExpiresAt: '2020-01-01T00:00:00.000Z',
      user: {
        id: 'user-1',
        email: 'ana@example.com',
      },
    }))
    refreshSession.mockRejectedValue(new Error('Session expired'))

    const { result } = renderHook(() => useAuth())

    await act(async () => {
      await expect(result.current.getValidToken()).rejects.toThrow('Your session expired')
    })

    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.error).toBe('Your session expired. Please log in again.')
    expect(window.localStorage.getItem('birdwatchingAI.authState')).toBeNull()
  })

  test('starts and persists a visitor session without a token', () => {
    const { result } = renderHook(() => useAuth())

    act(() => {
      result.current.enterAsVisitor()
    })

    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.isVisitor).toBe(true)
    expect(result.current.user).toMatchObject({
      id: 'visitor',
      role: 'visitor',
    })
    expect(JSON.parse(window.localStorage.getItem('birdwatchingAI.authState'))).toMatchObject({
      token: null,
      user: {
        role: 'visitor',
      },
    })
  })
})
