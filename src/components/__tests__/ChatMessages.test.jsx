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

  test('renders an in-progress assistant message instead of a separate loading bubble', () => {
    const messages = [
      { role: 'user', content: 'Where can I see quetzals?' },
      { role: 'assistant', content: '', isStreaming: true },
    ]

    render(<ChatMessages messages={messages} isLoading={true} />)

    expect(screen.getByLabelText(/Birdwatching AI is typing/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Birdwatching AI is thinking/i)).not.toBeInTheDocument()
  })

  test('renders streamed assistant text progressively', () => {
    const messages = [
      { role: 'assistant', content: 'Look near Monteverde at dawn.', isStreaming: true },
    ]

    render(<ChatMessages messages={messages} isLoading={true} />)

    expect(screen.getByText(/Look near Monteverde at dawn\./i)).toBeInTheDocument()
  })

  test('renders a stopped empty assistant response', () => {
    const messages = [
      { role: 'assistant', content: '', isStopped: true },
    ]

    render(<ChatMessages messages={messages} isLoading={false} />)

    expect(screen.getByText(/Response stopped\./i)).toBeInTheDocument()
  })

  test('renders reservation confirmation details in a card', () => {
    const messages = [
      {
        role: 'assistant',
        content: [
          'Your reservation is confirmed!',
          'Confirmation code: BW-ABC123',
          'Reservation ID: 42',
          'Customer name: Ana Rivera',
          'Tour name: Monteverde Quetzal Tour',
          'Tour ID: 1',
          'Participants: 2',
          'Created at: 2026-05-11T10:30:00Z',
          'Total price: $240.00',
        ].join('\n'),
      },
    ]

    render(<ChatMessages messages={messages} isLoading={false} />)

    expect(screen.getByLabelText(/Reservation confirmation/i)).toBeInTheDocument()
    expect(screen.getByText(/Reservation confirmed/i)).toBeInTheDocument()
    expect(screen.getByText('BW-ABC123')).toBeInTheDocument()
    expect(screen.getByText('Ana Rivera')).toBeInTheDocument()
    expect(screen.getByText('Monteverde Quetzal Tour')).toBeInTheDocument()
    expect(screen.getByText('$240.00')).toBeInTheDocument()
  })

  test('prefers structured reservation metadata for confirmation cards', () => {
    const assistantText = 'Your reservation is confirmed.'
    const messages = [
      {
        role: 'assistant',
        content: assistantText,
        reservation: {
          confirmationCode: 'BW-META123',
          reservationId: 99,
          customerName: 'Luis Mora',
          tourName: 'Tortuguero Canal Bird Safari',
          tourId: 6,
          participants: 4,
          totalPrice: 558,
          discountReason: 'Group discount',
        },
      },
    ]

    render(<ChatMessages messages={messages} isLoading={false} />)

    expect(screen.getByText(assistantText)).toBeInTheDocument()
    expect(screen.getByLabelText(/Reservation confirmation/i)).toBeInTheDocument()
    expect(screen.getByText('BW-META123')).toBeInTheDocument()
    expect(screen.getByText('Luis Mora')).toBeInTheDocument()
    expect(screen.getByText('Tortuguero Canal Bird Safari')).toBeInTheDocument()
    expect(screen.getByText('$558.00')).toBeInTheDocument()
    expect(screen.getByText('Group discount')).toBeInTheDocument()
  })

  test('renders reservation metadata returned with backend snake_case fields', () => {
    const messages = [
      {
        role: 'assistant',
        content: 'Your reservation is confirmed.',
        reservation: {
          confirmation_code: 'BW-SNAKE123',
          id: 101,
          customer_name: 'Mariana Solis',
          tour_id: 3,
          tourName: 'Carara Scarlet Macaw Walk',
          participants: 2,
          created_at: '2026-05-12T14:00:00Z',
          total_price: 210,
        },
      },
    ]

    render(<ChatMessages messages={messages} isLoading={false} />)

    expect(screen.getByLabelText(/Reservation confirmation/i)).toBeInTheDocument()
    expect(screen.getByText('BW-SNAKE123')).toBeInTheDocument()
    expect(screen.getByText('101')).toBeInTheDocument()
    expect(screen.getByText('Mariana Solis')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('$210.00')).toBeInTheDocument()
    expect(screen.getByText('2026-05-12T14:00:00Z')).toBeInTheDocument()
  })

  test('reads reservation data from persisted message metadata', () => {
    const messages = [
      {
        role: 'assistant',
        content: 'Your reservation is confirmed.',
        metadata: {
          reservation: {
            confirmationCode: 'BW-CACHED123',
            reservationId: 77,
            customerName: 'Diego Vega',
            tourName: 'Monteverde Quetzal Tour',
            participants: 2,
            totalPrice: 240,
          },
        },
      },
    ]

    render(<ChatMessages messages={messages} isLoading={false} />)

    expect(screen.getByLabelText(/Reservation confirmation/i)).toBeInTheDocument()
    expect(screen.getByText('BW-CACHED123')).toBeInTheDocument()
    expect(screen.getByText('Diego Vega')).toBeInTheDocument()
    expect(screen.getByText('$240.00')).toBeInTheDocument()
  })
})
