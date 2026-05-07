import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import ChatMessages from '../ChatMessages'

describe('ChatMessages', () => {
  test('renders empty welcome state when there are no messages and not loading', () => {
    render(<ChatMessages messages={[]} isLoading={false} />)

    expect(screen.getByText(/Welcome to Birdwatching AI/i)).toBeInTheDocument()
    expect(screen.getByText(/Ask me about birds, locations, and tours in Costa Rica./i)).toBeInTheDocument()
  })

  test('renders user and AI messages correctly', () => {
    const messages = [
      { role: 'user', content: 'Where is the best place to see toucans?' },
      { role: 'assistant', content: 'Try the cloud forests around Monteverde.' }
    ]

    render(<ChatMessages messages={messages} isLoading={false} />)

    expect(screen.getByText(/Where is the best place to see toucans\?/i)).toBeInTheDocument()
    expect(screen.getByText(/Try the cloud forests around Monteverde\./i)).toBeInTheDocument()
    expect(screen.getByText(/You/i)).toBeInTheDocument()
    expect(screen.getByText(/Birdwatching AI/i)).toBeInTheDocument()
  })

  test('shows loading indicator when AI is thinking', () => {
    const messages = [{ role: 'assistant', content: 'Searching for the best birding spots...' }]

    render(<ChatMessages messages={messages} isLoading={true} />)

    expect(screen.getByLabelText(/Birdwatching AI is thinking/i)).toBeInTheDocument()
  })
})