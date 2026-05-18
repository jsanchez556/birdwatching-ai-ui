import { act, renderHook } from '@testing-library/react'
import useAuth from '../useAuth'
import { login, signup } from '../../api/authApi'

jest.mock('../../api/authApi', () => ({
  login: jest.fn(),
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
      user: {
        id: 'user-1',
        email: 'ana@example.com',
        name: 'Ana Gomez',
      },
    }))

    const { result } = renderHook(() => useAuth())

    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.token).toBe('stored-token')
    expect(result.current.user).toEqual({
      id: 'user-1',
      email: 'ana@example.com',
      name: 'Ana Gomez',
    })
  })

  test('persists login results', async () => {
    login.mockResolvedValue({
      token: 'login-token',
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
      user: {
        email: 'ana@example.com',
      },
    })
  })

  test('persists signup results', async () => {
    signup.mockResolvedValue({
      token: 'signup-token',
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
  })
})
