import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

jest.mock('../hooks/useAuth', () => ({
  __esModule: true,
  default: jest.fn(),
}))
jest.mock('../hooks/useChat', () => ({
  __esModule: true,
  default: jest.fn(),
}))

const App = require('../App').default
const useAuth = require('../hooks/useAuth').default
const useChat = require('../hooks/useChat').default

describe('App authentication flow', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    window.localStorage.clear()
  })

  test('shows auth views instead of chat when unauthenticated', () => {
    useAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      error: null,
      login: jest.fn(),
      signup: jest.fn(),
    })

    render(<App />)

    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
    expect(screen.queryByText(/Plan your birding chat/i)).not.toBeInTheDocument()
  })

  test('shows authenticated chat and wires logout', () => {
    const logout = jest.fn()
    useAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      error: null,
      token: 'stored-token',
      user: {
        id: 'user-1',
        email: 'ana@example.com',
        name: 'Ana Gomez',
      },
      logout,
    })
    useChat.mockReturnValue({
      messages: [],
      isLoading: false,
      isStreaming: false,
      error: null,
      customerContext: null,
      setCustomerContext: jest.fn(),
      sendMessage: jest.fn(),
      stopGenerating: jest.fn(),
    })

    render(<App />)

    expect(screen.getByText(/Plan your birding chat/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /log out/i }))

    expect(logout).toHaveBeenCalledTimes(1)
  })
})
