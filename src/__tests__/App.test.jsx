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
      isVisitor: false,
      isLoading: false,
      error: null,
      login: jest.fn(),
      signup: jest.fn(),
      enterAsVisitor: jest.fn(),
    })

    render(<App />)

    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
    expect(screen.queryByText(/Plan your birding chat/i)).not.toBeInTheDocument()
  })

  test('shows authenticated chat and wires logout', () => {
    const logout = jest.fn()
    useAuth.mockReturnValue({
      isAuthenticated: true,
      isVisitor: false,
      isLoading: false,
      error: null,
      token: 'stored-token',
      user: {
        id: 'user-1',
        email: 'ana@example.com',
        name: 'Ana Gomez',
        role: 'customer',
      },
      logout,
    })
    useChat.mockReturnValue({
      messages: [],
      isLoading: false,
      isStreaming: false,
      error: null,
      customerContext: null,
      conversationMeta: {},
      setCustomerContext: jest.fn(),
      sendMessage: jest.fn(),
      stopGenerating: jest.fn(),
    })

    render(<App />)

    expect(screen.getByText(/Plan your birding chat/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /log out/i }))

    expect(logout).toHaveBeenCalledTimes(1)
  })

  test('shows visitor chat without customer context form', () => {
    useAuth.mockReturnValue({
      isAuthenticated: false,
      isVisitor: true,
      isLoading: false,
      error: null,
      token: null,
      user: {
        id: 'visitor',
        name: 'Visitor',
        role: 'visitor',
      },
      logout: jest.fn(),
    })
    useChat.mockReturnValue({
      messages: [],
      isLoading: false,
      isStreaming: false,
      error: null,
      customerContext: null,
      conversationMeta: {},
      setCustomerContext: jest.fn(),
      sendMessage: jest.fn(),
      stopGenerating: jest.fn(),
    })

    render(<App />)

    expect(screen.getByText(/Visitor mode is for bird questions only/i)).toBeInTheDocument()
    expect(screen.queryByText(/Plan your birding chat/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /exit visitor chat/i })).toBeInTheDocument()
  })
})
