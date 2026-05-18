import { fireEvent, render, screen } from '@testing-library/react'
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

  test('shows customer initials in user message avatars', () => {
    const messages = [
      { role: 'user', content: 'I want a Monteverde tour.' },
      { role: 'assistant', content: 'I can help with that.' },
    ]

    render(
      <ChatMessages
        messages={messages}
        isLoading={false}
        customerContext={{ customerName: 'Jose Sánchez Vasquez' }}
      />
    )

    expect(screen.getByText('JS')).toBeInTheDocument()
    expect(screen.getByText('BW')).toBeInTheDocument()
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
          'Customer name: Ana Rivera',
          'Tour name: Monteverde Quetzal Tour',
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
        metadata: {
          reservation: {
            confirmationCode: 'BW-META123',
            reservationId: 99,
            customerName: 'Luis Mora',
            tourName: 'Tortuguero Canal Bird Safari',
            tourId: 6,
            participants: 4,
            tourTotalPrice: 360,
            transportationPrice: 198,
            grandTotalPrice: 558,
            discountReason: 'Group discount',
          },
        },
      },
    ]

    render(<ChatMessages messages={messages} isLoading={false} />)

    expect(screen.getByText(assistantText)).toBeInTheDocument()
    expect(screen.getByLabelText(/Reservation confirmation/i)).toBeInTheDocument()
    expect(screen.getByText('BW-META123')).toBeInTheDocument()
    expect(screen.getByText('Luis Mora')).toBeInTheDocument()
    expect(screen.getByText('Tortuguero Canal Bird Safari')).toBeInTheDocument()
    expect(screen.getByText('$360.00')).toBeInTheDocument()
    expect(screen.getByText('$198.00')).toBeInTheDocument()
    expect(screen.getByText('$558.00')).toBeInTheDocument()
    expect(screen.getByText('Group discount')).toBeInTheDocument()
  })

  test('renders reservation metadata returned with backend snake_case fields', () => {
    const messages = [
      {
        role: 'assistant',
        content: 'Your reservation is confirmed.',
        metadata: {
          reservation: {
            confirmation_code: 'BW-SNAKE123',
            customer_name: 'Mariana Solis',
            tourName: 'Carara Scarlet Macaw Walk',
            participants: 2,
            created_at: '2026-05-12T14:00:00Z',
            total_price: 210,
          },
        },
      },
    ]

    render(<ChatMessages messages={messages} isLoading={false} />)

    expect(screen.getByLabelText(/Reservation confirmation/i)).toBeInTheDocument()
    expect(screen.getByText('BW-SNAKE123')).toBeInTheDocument()
    expect(screen.getByText('Mariana Solis')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('$210.00')).toBeInTheDocument()
    expect(screen.getByText('2026-05-12T14:00:00Z')).toBeInTheDocument()
  })

  test('renders transportation from selected transportation metadata', () => {
    const messages = [
      {
        role: 'assistant',
        content: 'Your reservation is confirmed.',
        metadata: {
          reservation: {
            confirmation_code: 'BW-TRANSPORT123',
            id: 14,
            customer_name: 'Jose Sánchez Vasquez',
            tour_id: 1,
            tourName: 'Monteverde Quetzal Tour',
            participants: 3,
            total_price: 360,
          },
          selectedTransportation: {
            transportationOption: 'shared_shuttle',
            label: 'Shared shuttle',
            origin: 'San Jose',
            destination: 'Monteverde',
            pricePerPerson: 65,
            totalPrice: 195,
            currency: 'USD',
          },
        },
      },
    ]

    render(<ChatMessages messages={messages} isLoading={false} />)

    expect(screen.getByLabelText(/Reservation confirmation/i)).toBeInTheDocument()
    expect(screen.getByText('BW-TRANSPORT123')).toBeInTheDocument()
    expect(screen.getByText(/Shared shuttle from San Jose to Monteverde/i)).toBeInTheDocument()
    expect(screen.getByText('$195.00')).toBeInTheDocument()
    expect(screen.getByText('$555.00')).toBeInTheDocument()
  })

  test('renders reservation data from chat-level metadata', () => {
    const messages = [
      {
        role: 'assistant',
        content: 'Your reservation is confirmed.',
      },
    ]
    const conversationMeta = {
      reservation: {
        confirmationCode: 'BW-CHATMETA123',
        customerName: 'Jose Sánchez Vasquez',
        tourName: 'Monteverde Quetzal Tour',
        totalPrice: 360,
      },
      participants: 3,
      selectedTransportation: {
        transportationOption: 'shared_shuttle',
        label: 'Shared shuttle',
        origin: 'San Jose',
        destination: 'Monteverde',
        totalPrice: 195,
      },
    }

    render(<ChatMessages messages={messages} isLoading={false} conversationMeta={conversationMeta} />)

    expect(screen.getByLabelText(/Reservation confirmation/i)).toBeInTheDocument()
    expect(screen.getByText('BW-CHATMETA123')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText(/Shared shuttle from San Jose to Monteverde/i)).toBeInTheDocument()
    expect(screen.getByText('$555.00')).toBeInTheDocument()
  })

  test('prefers chat-level selected transportation over legacy reservation transportation', () => {
    const messages = [
      {
        role: 'assistant',
        content: 'Your reservation is confirmed.',
      },
    ]
    const conversationMeta = {
      reservation: {
        confirmationCode: 'BW-PREFERSELECTED',
        tourName: 'Monteverde Quetzal Tour',
        totalPrice: 360,
        transportation: {
          transportationOption: 'private_transfer',
          label: 'Private transfer',
          origin: 'San Jose',
          destination: 'Monteverde',
          totalPrice: 220,
        },
      },
      selectedTransportation: {
        transportationOption: 'shared_shuttle',
        label: 'Shared shuttle',
        origin: 'San Jose',
        destination: 'Monteverde',
        totalPrice: 195,
      },
    }

    render(<ChatMessages messages={messages} isLoading={false} conversationMeta={conversationMeta} />)

    expect(screen.getByText(/Shared shuttle from San Jose to Monteverde/i)).toBeInTheDocument()
    expect(screen.queryByText(/Private transfer/i)).not.toBeInTheDocument()
    expect(screen.getByText('$555.00')).toBeInTheDocument()
  })

  test('does not repeat chat-level reservation cards on non-confirmation messages', () => {
    const messages = [
      {
        role: 'assistant',
        content: 'Please confirm this reservation.',
      },
      {
        role: 'assistant',
        content: 'Your reservation is confirmed.',
      },
    ]
    const conversationMeta = {
      reservation: {
        confirmationCode: 'BW-ONCE123',
        tourName: 'Monteverde Quetzal Tour',
      },
    }

    render(<ChatMessages messages={messages} isLoading={false} conversationMeta={conversationMeta} />)

    expect(screen.getAllByLabelText(/Reservation confirmation/i)).toHaveLength(1)
    expect(screen.getByText('BW-ONCE123')).toBeInTheDocument()
  })

  test('does not render a structured card from duplicated top-level reservation data', () => {
    const messages = [
      {
        role: 'assistant',
        content: 'Your reservation is confirmed.',
        reservation: {
          confirmationCode: 'BW-TOPLEVEL',
          customerName: 'Legacy User',
          totalPrice: 210,
        },
      },
    ]

    render(<ChatMessages messages={messages} isLoading={false} />)

    expect(screen.queryByLabelText(/Reservation confirmation/i)).not.toBeInTheDocument()
    expect(screen.queryByText('BW-TOPLEVEL')).not.toBeInTheDocument()
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

  test('renders structured choice buttons from assistant metadata', () => {
    const onAction = jest.fn()
    const messages = [
      {
        role: 'assistant',
        content: 'I found 3 tours that match your preferences.',
        metadata: {
          uiAction: {
            type: 'choice',
            prompt: 'What would you like to do next?',
            options: [
              { label: 'Show me details', value: 'show_details' },
              { label: 'Proceed with booking', value: 'proceed_booking' },
              { label: 'Confirm reservation', value: 'confirm_reservation' },
            ],
          },
        },
      },
    ]

    render(<ChatMessages messages={messages} isLoading={false} onAction={onAction} />)

    fireEvent.click(screen.getByRole('button', { name: /Show me details/i }))
    fireEvent.click(screen.getByRole('button', { name: /Confirm reservation/i }))

    expect(onAction).toHaveBeenCalledWith('Show me details')
    expect(onAction).toHaveBeenCalledWith('Confirm reservation')
    expect(onAction).not.toHaveBeenCalledWith('confirm_reservation')
  })

  test('renders tour selection buttons from database-backed metadata', () => {
    const onAction = jest.fn()
    const messages = [
      {
        role: 'assistant',
        content: 'Which tour are you interested in?',
        metadata: {
          uiAction: {
            type: 'tour_selection',
            prompt: 'Which tour are you interested in?',
            options: [
              {
                label: 'Sarapiqui Rainforest Tour',
                value: { tourId: 2, tourName: 'Sarapiqui Rainforest Tour' },
                description: 'Sarapiqui · $95 · 5h · easy',
              },
            ],
          },
        },
      },
    ]

    render(<ChatMessages messages={messages} isLoading={false} onAction={onAction} />)

    fireEvent.click(screen.getByRole('button', { name: /Sarapiqui Rainforest Tour/i }))

    expect(onAction).toHaveBeenCalledWith('I choose tour 2: Sarapiqui Rainforest Tour')
  })

  test('renders participant count as a numeric dropdown', () => {
    const onAction = jest.fn()
    const messages = [
      {
        role: 'assistant',
        content: 'How many participants should I reserve?',
        metadata: {
          uiAction: {
            type: 'participant_count',
            prompt: 'How many participants should I reserve?',
            min: 1,
            max: 3,
            options: [
              { label: '1', value: 1 },
              { label: '2', value: 2 },
              { label: '3', value: 3 },
            ],
          },
        },
      },
    ]

    render(<ChatMessages messages={messages} isLoading={false} onAction={onAction} />)

    fireEvent.change(screen.getByLabelText(/How many participants/i), {
      target: { value: '3' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Send/i }))

    expect(onAction).toHaveBeenCalledWith('3')
  })

  test('renders transportation selection buttons from assistant metadata', () => {
    const onAction = jest.fn()
    const messages = [
      {
        role: 'assistant',
        content: 'Transportation from San Jose is available.',
        metadata: {
          uiAction: {
            type: 'transportation_selection',
            prompt: 'Which transportation option would you prefer for San Jose to Monteverde?',
            options: [
              {
                label: 'Shared shuttle',
                value: {
                  transportationOption: 'shared_shuttle',
                  origin: 'San Jose',
                  destination: 'Monteverde',
                },
                description: 'USD 65 per person, USD 195 total · 3.5-4.5 hours from San Jose',
                recommended: true,
              },
              {
                label: 'Private transfer',
                value: {
                  transportationOption: 'private_transfer',
                  origin: 'San Jose',
                  destination: 'Monteverde',
                },
                description: 'USD 220 total · 3.5-4.5 hours from San Jose',
                recommended: false,
              },
            ],
          },
        },
      },
    ]

    render(<ChatMessages messages={messages} isLoading={false} onAction={onAction} />)

    expect(screen.getByText('Recommended')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Shared shuttle/i }))

    expect(onAction).toHaveBeenCalledWith('I choose shared shuttle from San Jose to Monteverde')
  })

  test('renders transportation preference choices from assistant metadata', () => {
    const onAction = jest.fn()
    const messages = [
      {
        role: 'assistant',
        content: 'Would you like transportation for this tour?',
        metadata: {
          uiAction: {
            type: 'choice',
            prompt: 'Would you like transportation for this tour?',
            options: [
              { label: 'Yes, show transportation', value: 'show_transportation' },
              { label: 'No, I have my own transportation', value: 'decline_transportation' },
            ],
          },
        },
      },
    ]

    render(<ChatMessages messages={messages} isLoading={false} onAction={onAction} />)

    fireEvent.click(screen.getByRole('button', { name: /Yes, show transportation/i }))
    fireEvent.click(screen.getByRole('button', { name: /No, I have my own transportation/i }))

    expect(onAction).toHaveBeenCalledWith('Show transportation')
    expect(onAction).toHaveBeenCalledWith('No, I have my own transportation')
  })

  test('renders reservation confirmation actions from assistant metadata', () => {
    const onAction = jest.fn()
    const messages = [
      {
        role: 'assistant',
        content: 'Please confirm this reservation.',
        metadata: {
          uiAction: {
            type: 'reservation_confirmation',
            prompt: 'Confirm this reservation?',
            options: [
              { label: 'Confirm reservation', value: 'confirm_reservation' },
              { label: 'Cancel', value: 'cancel_reservation' },
            ],
          },
        },
      },
    ]

    render(<ChatMessages messages={messages} isLoading={false} onAction={onAction} />)

    fireEvent.click(screen.getByRole('button', { name: /Confirm reservation/i }))
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }))

    expect(onAction).toHaveBeenCalledWith('Confirm reservation')
    expect(onAction).toHaveBeenCalledWith('Cancel reservation')
  })
})
