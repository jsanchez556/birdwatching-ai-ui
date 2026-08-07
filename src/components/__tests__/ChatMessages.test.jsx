import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import ChatMessages from '../ChatMessages'
import { clearMediaUrlCache } from '../../api/mediaApi'

describe('ChatMessages', () => {
  beforeEach(() => {
    clearMediaUrlCache()
    global.fetch = jest.fn()
  })

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

  test('renders structured tour recommendation cards while preserving assistant text', () => {
    const messages = [{
      role: 'assistant',
      content: 'I found two tours that match your preferences.',
      metadata: {
        tourRecommendation: {
          summary: 'I found two tours that match your preferences.',
          recommendations: [
            {
              tourId: '12',
              tourName: 'Monteverde Quetzal Tour',
              location: 'Monteverde',
              estimatedPrice: { amount: 120, currency: 'USD' },
              matchReasons: ['Matches Monteverde', 'Fits a moderate budget'],
              availabilityStatus: 'available',
              confidence: 0.94,
            },
            {
              tourId: '13',
              tourName: 'Curi-Cancha Morning Walk',
              location: 'Curi-Cancha',
              estimatedPrice: { amount: null, currency: null },
              matchReasons: ['Easy walking route'],
              availabilityStatus: 'limited',
              confidence: 0.81,
            },
          ],
          sources: [],
          assumptions: [],
          followUpQuestion: 'Which tour interests you?',
        },
      },
    }]

    render(<ChatMessages messages={messages} isLoading={false} />)

    expect(screen.getByText('I found two tours that match your preferences.')).toBeInTheDocument()
    const recommendations = screen.getByLabelText('Tour recommendations')
    expect(within(recommendations).getByRole('heading', { name: 'Monteverde Quetzal Tour' })).toBeInTheDocument()
    expect(within(recommendations).getByRole('heading', { name: 'Curi-Cancha Morning Walk' })).toBeInTheDocument()
    expect(within(recommendations).getByText('94%')).toBeInTheDocument()
    expect(within(recommendations).getByText('$120')).toBeInTheDocument()
    expect(within(recommendations).getByText('Available')).toBeInTheDocument()
    expect(within(recommendations).getByText('Limited availability')).toBeInTheDocument()
    expect(within(recommendations).getByText('Price unavailable')).toBeInTheDocument()
  })

  test('does not parse assistant prose to construct recommendation cards', () => {
    render(
      <ChatMessages
        messages={[{
          role: 'assistant',
          content: 'Monteverde Quetzal Tour\nMatch: 94%\nPrice: $120\nAvailability: Available',
        }]}
        isLoading={false}
      />
    )

    expect(screen.getByText(/Monteverde Quetzal Tour/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Tour recommendations')).not.toBeInTheDocument()
  })

  test('renders no recommendation cards for empty or missing optional metadata', () => {
    const emptyContract = {
      summary: 'No supported matches were found.',
      recommendations: [],
      sources: [],
      assumptions: [],
      followUpQuestion: null,
    }

    render(
      <ChatMessages
        messages={[
          { role: 'assistant', content: 'Ordinary response.' },
          {
            role: 'assistant',
            content: 'No supported matches were found.',
            metadata: { tourRecommendation: emptyContract },
          },
        ]}
        isLoading={false}
      />
    )

    expect(screen.getByText('Ordinary response.')).toBeInTheDocument()
    expect(screen.getByText('No supported matches were found.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Tour recommendations')).not.toBeInTheDocument()
  })

  test('ignores invalid persisted recommendation metadata without crashing', () => {
    render(
      <ChatMessages
        messages={[{
          role: 'assistant',
          content: 'The original assistant response remains.',
          metadata: {
            tourRecommendation: {
              summary: 'Invalid metadata',
              recommendations: [{
                tourName: 'Incomplete tour',
                confidence: 2,
              }],
            },
          },
        }]}
        isLoading={false}
      />
    )

    expect(screen.getByText('The original assistant response remains.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Tour recommendations')).not.toBeInTheDocument()
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

  test('renders returned voice response audio on assistant messages', () => {
    const messages = [
      {
        role: 'assistant',
        content: 'Listen for the repeated call near the canopy edge.',
        audioUrl: 'https://cdn.example.com/files/voice-chat/response.mp3',
      },
    ]

    render(<ChatMessages messages={messages} isLoading={false} />)

    expect(screen.getByLabelText(/voice response audio/i))
      .toHaveAttribute('src', 'https://cdn.example.com/files/voice-chat/response.mp3')
  })

  test('renders voice response audio from the canonical message field', () => {
    const messages = [
      {
        role: 'assistant',
        content: 'Look low in the understory and pause at the bend.',
        audioUrl: 'https://cdn.example.com/files/voice-chat/metadata-response.mp3',
      },
    ]

    render(<ChatMessages messages={messages} isLoading={false} />)

    expect(screen.getByLabelText(/voice response audio/i))
      .toHaveAttribute('src', 'https://cdn.example.com/files/voice-chat/metadata-response.mp3')
  })

  test('renders bird matches as a carousel and opens the selected bird in a modal', () => {
    const messages = [
      {
        role: 'assistant',
        content: 'The Great Tinamou is often heard before it is seen.',
        metadata: {
          birdMatches: [
            {
              speciesCode: 'gretin1',
              commonName: 'Great Tinamou',
              scientificName: 'Tinamus major',
              order: 'Tinamiformes',
              family: 'Tinamous',
              description: 'A large ground bird.',
              locations: ['La Cusinga Lodge'],
              lastObservation: {
                locations: ['La Cusinga Lodge'],
                obsDt: '2026-05-21 04:58',
                howMany: 1,
              },
              media: {
                photoUrl: 'https://example.com/great-tinamou.jpg',
                squarePhotoUrl: 'https://example.com/great-tinamou-square.jpg',
                photoAttribution: 'Photo by Example Birder',
                wikiTitle: 'Great_tinamou',
                songUrl: 'https://example.com/great-tinamou.mp3',
                sonogramUrl: 'https://example.com/great-tinamou-sonogram.png',
                songAttributionHtml: '<p>Sound recording by Example Recordist, sourced from <a href="https://xeno-canto.org/">xeno-canto</a>. Licensed under <a href="https://creativecommons.org/licenses/by-nc-sa/3.0/">CC BY-NC-SA 3.0</a>.</p>',
              },
            },
            {
              speciesCode: 'thitin1',
              commonName: 'Thicket Tinamou',
              scientificName: 'Crypturellus cinnamomeus',
              family: 'Tinamous',
              media: {},
            },
          ],
        },
      },
    ]

    render(<ChatMessages messages={messages} isLoading={false} />)

    expect(screen.getByText(/The Great Tinamou is often heard before it is seen\./i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Bird matches$/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Open Great Tinamou details/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Open Thicket Tinamou details/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Great Tinamou bird media/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Open Great Tinamou details/i }).querySelector('img'))
      .toHaveAttribute('src', 'https://example.com/great-tinamou-square.jpg')

    fireEvent.click(screen.getByRole('button', { name: /Open Great Tinamou details/i }))

    const modal = screen.getByRole('dialog', { name: /Great Tinamou details/i })
    const messageBubble = screen.getByText(/The Great Tinamou is often heard before it is seen\./i).closest('.message-bubble')

    expect(document.body).toContainElement(modal)
    expect(document.body).toHaveClass('has-open-modal')
    expect(messageBubble).not.toContainElement(modal)
    expect(within(modal).getByLabelText(/Great Tinamou bird media/i)).toBeInTheDocument()
    expect(within(modal).getByText('Tinamus major')).toBeInTheDocument()
    expect(within(modal).getByLabelText(/Great Tinamou taxonomy/i)).toHaveTextContent('Tinamiformes')
    expect(within(modal).getByLabelText(/Great Tinamou taxonomy/i)).toHaveTextContent('Tinamous')
    expect(within(modal).getByRole('heading', { name: /Identification/i })).toBeInTheDocument()
    expect(within(modal).getByRole('heading', { name: /Audio/i })).toBeInTheDocument()
    expect(within(modal).getByText('Photo by Example Birder')).toBeInTheDocument()
    expect(within(modal).getByText(/Sound recording by Example Recordist, sourced from xeno-canto/i)).toBeInTheDocument()
    expect(within(modal).getByAltText(/Great Tinamou photo/i)).toHaveAttribute('src', 'https://example.com/great-tinamou.jpg')
    expect(within(modal).getByLabelText(/Great Tinamou song recording/i)).toHaveAttribute('src', 'https://example.com/great-tinamou.mp3')
    expect(within(modal).getByAltText(/Great Tinamou sonogram/i)).toHaveAttribute('src', 'https://example.com/great-tinamou-sonogram.png')

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(screen.queryByRole('dialog', { name: /Great Tinamou details/i })).not.toBeInTheDocument()
    expect(document.body).not.toHaveClass('has-open-modal')
    expect(screen.getByRole('button', { name: /Open Great Tinamou details/i })).toHaveFocus()
  })

  test('paginates bird matches one at a time', () => {
    const messages = [
      {
        role: 'assistant',
        content: 'Here are likely matches.',
        metadata: {
          birdMatches: [
            { speciesCode: 'gretin1', commonName: 'Great Tinamou', media: {} },
            { speciesCode: 'thitin1', commonName: 'Thicket Tinamou', media: {} },
            { speciesCode: 'slbwoo1', commonName: 'Slaty-backed Woodpecker', media: {} },
            { speciesCode: 'keptou1', commonName: 'Keel-billed Toucan', media: {} },
          ],
        },
      },
    ]

    render(<ChatMessages messages={messages} isLoading={false} />)

    expect(screen.getByRole('button', { name: /Show previous bird matches/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Show next bird matches/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Open Great Tinamou details/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Open Thicket Tinamou details/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Open Slaty-backed Woodpecker details/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Open Keel-billed Toucan details/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Show next bird matches/i }))

    expect(screen.getByRole('button', { name: /Show previous bird matches/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Show next bird matches/i })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /Open Great Tinamou details/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Open Thicket Tinamou details/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Open Slaty-backed Woodpecker details/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Open Keel-billed Toucan details/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Show previous bird matches/i }))

    expect(screen.getByRole('button', { name: /Show previous bird matches/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Show next bird matches/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Open Great Tinamou details/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Open Keel-billed Toucan details/i })).not.toBeInTheDocument()
  })

  test('keeps bird media optional inside the selected bird modal', () => {
    const messages = [
      {
        role: 'assistant',
        content: 'Here is a likely match.',
        metadata: {
          birdMatches: [
            {
              speciesCode: 'thitin1',
              commonName: 'Thicket Tinamou',
              scientificName: 'Crypturellus cinnamomeus',
              family: 'Tinamous',
              media: {},
            },
          ],
        },
      },
    ]

    render(<ChatMessages messages={messages} isLoading={false} />)

    fireEvent.click(screen.getByRole('button', { name: /Open Thicket Tinamou details/i }))

    const modal = screen.getByRole('dialog', { name: /Thicket Tinamou details/i })
    expect(within(modal).getByText('Crypturellus cinnamomeus')).toBeInTheDocument()
    expect(within(modal).getByLabelText(/Thicket Tinamou photo unavailable/i)).toBeInTheDocument()
    expect(within(modal).queryByLabelText(/Thicket Tinamou song recording/i)).not.toBeInTheDocument()
    expect(within(modal).queryByAltText(/Thicket Tinamou sonogram/i)).not.toBeInTheDocument()
    expect(within(modal).queryByText(/Loading sonogram/i)).not.toBeInTheDocument()
    expect(within(modal).queryByText(/Sonogram unavailable/i)).not.toBeInTheDocument()
    expect(within(modal).queryByText(/Sound recording/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Close bird details/i }))

    expect(screen.queryByRole('dialog', { name: /Thicket Tinamou details/i })).not.toBeInTheDocument()
  })

  test('shows a stable sonogram loading state while a relative media URL resolves', async () => {
    let resolveMediaRequest
    global.fetch.mockImplementation(() => new Promise((resolve) => {
      resolveMediaRequest = resolve
    }))
    const messages = [
      {
        role: 'assistant',
        content: 'Here is a sonogram-only match.',
        metadata: {
          birdMatches: [
            {
              speciesCode: 'gretin1',
              commonName: 'Great Tinamou',
              scientificName: 'Tinamus major',
              media: {
                sonogramUrl: 'sonograms/great-tinamou.png',
              },
            },
          ],
        },
      },
    ]

    render(<ChatMessages messages={messages} isLoading={false} />)

    fireEvent.click(screen.getByRole('button', { name: /Open Great Tinamou details/i }))

    const modal = screen.getByRole('dialog', { name: /Great Tinamou details/i })
    expect(within(modal).getByText(/Loading sonogram/i)).toBeInTheDocument()
    expect(within(modal).queryByText(/Sonogram unavailable/i)).not.toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith('/files/sonograms/great-tinamou.png')

    resolveMediaRequest({
      ok: true,
      json: async () => ({
        success: true,
        data: { url: 'https://bucket.example.test/sonograms/great-tinamou.png' },
      }),
    })

    await waitFor(() => {
      expect(within(modal).getByAltText(/Great Tinamou sonogram/i))
        .toHaveAttribute('src', 'https://bucket.example.test/sonograms/great-tinamou.png')
    })
  })

  test('renders xeno-canto sono media aliases with a loading state', async () => {
    const messages = [
      {
        role: 'assistant',
        content: 'Here is a bird with xeno-canto media.',
        metadata: {
          birdMatches: [
            {
              speciesCode: 'gretin1',
              commonName: 'Great Tinamou',
              scientificName: 'Tinamus major',
              media: {
                sono: 'https://xeno-canto.org/sounds/spectrograms/OQZFKFTAKD/1046027/grey-small.png',
              },
            },
          ],
        },
      },
    ]

    render(<ChatMessages messages={messages} isLoading={false} />)

    fireEvent.click(screen.getByRole('button', { name: /Open Great Tinamou details/i }))

    const modal = screen.getByRole('dialog', { name: /Great Tinamou details/i })
    const sonogram = within(modal).getByAltText(/Great Tinamou sonogram/i)

    expect(within(modal).getByText(/Loading sonogram/i)).toBeInTheDocument()
    expect(sonogram).toHaveAttribute(
      'src',
      'https://xeno-canto.org/sounds/spectrograms/OQZFKFTAKD/1046027/grey-small.png',
    )

    fireEvent.load(sonogram)

    await waitFor(() => {
      expect(within(modal).queryByText(/Loading sonogram/i)).not.toBeInTheDocument()
    })
  })

  test('shows sonogram fallback only after the image load fails', () => {
    const messages = [
      {
        role: 'assistant',
        content: 'Here is a bird with a sonogram.',
        metadata: {
          birdMatches: [
            {
              speciesCode: 'gretin1',
              commonName: 'Great Tinamou',
              scientificName: 'Tinamus major',
              media: {
                sonogramUrl: 'https://example.com/great-tinamou-sonogram.png',
              },
            },
          ],
        },
      },
    ]

    render(<ChatMessages messages={messages} isLoading={false} />)

    fireEvent.click(screen.getByRole('button', { name: /Open Great Tinamou details/i }))

    const modal = screen.getByRole('dialog', { name: /Great Tinamou details/i })
    const sonogram = within(modal).getByAltText(/Great Tinamou sonogram/i)

    expect(within(modal).getByText(/Loading sonogram/i)).toBeInTheDocument()
    expect(within(modal).queryByText(/Sonogram unavailable/i)).not.toBeInTheDocument()

    fireEvent.error(sonogram)

    expect(within(modal).getByText(/Sonogram unavailable/i)).toBeInTheDocument()
    expect(within(modal).queryByAltText(/Great Tinamou sonogram/i)).not.toBeInTheDocument()
  })

  test('initializes and updates the sonogram playhead during first audio playback', async () => {
    const messages = [
      {
        role: 'assistant',
        content: 'Here is a bird with synced audio.',
        metadata: {
          birdMatches: [
            {
              speciesCode: 'gretin1',
              commonName: 'Great Tinamou',
              scientificName: 'Tinamus major',
              media: {
                songUrl: 'https://example.com/great-tinamou.mp3',
                sonogramUrl: 'https://example.com/great-tinamou-sonogram.png',
              },
            },
          ],
        },
      },
    ]

    render(<ChatMessages messages={messages} isLoading={false} />)

    fireEvent.click(screen.getByRole('button', { name: /Open Great Tinamou details/i }))

    const modal = screen.getByRole('dialog', { name: /Great Tinamou details/i })
    const audio = within(modal).getByLabelText(/Great Tinamou song recording/i)
    const sonogram = within(modal).getByAltText(/Great Tinamou sonogram/i)

    expect(modal.querySelector('.bird-sonogram-playhead')).not.toBeInTheDocument()

    Object.defineProperty(audio, 'duration', {
      configurable: true,
      value: 10,
    })
    Object.defineProperty(audio, 'currentTime', {
      configurable: true,
      writable: true,
      value: 0,
    })

    fireEvent.load(sonogram)
    fireEvent.loadedMetadata(audio)
    fireEvent.play(audio)

    await waitFor(() => {
      expect(modal.querySelector('.bird-sonogram-playhead')).toBeInTheDocument()
      expect(modal.querySelector('.bird-sonogram-playhead'))
        .toHaveStyle({ '--playhead-position': '0%' })
    })

    audio.currentTime = 2
    fireEvent.timeUpdate(audio)

    await waitFor(() => {
      expect(modal.querySelector('.bird-sonogram-playhead'))
        .toHaveStyle({ '--playhead-position': '20%' })
    })
  })

  test('uses bird media songLength when audio metadata duration is unavailable', async () => {
    const messages = [
      {
        role: 'assistant',
        content: 'Here is a bird with synced audio duration metadata.',
        metadata: {
          birdMatches: [
            {
              speciesCode: 'gretin1',
              commonName: 'Great Tinamou',
              scientificName: 'Tinamus major',
              media: {
                songUrl: 'https://example.com/great-tinamou.mp3',
                sonogramUrl: 'https://example.com/great-tinamou-sonogram.png',
                songLength: '0:20',
              },
            },
          ],
        },
      },
    ]

    render(<ChatMessages messages={messages} isLoading={false} />)

    fireEvent.click(screen.getByRole('button', { name: /Open Great Tinamou details/i }))

    const modal = screen.getByRole('dialog', { name: /Great Tinamou details/i })
    const audio = within(modal).getByLabelText(/Great Tinamou song recording/i)
    const sonogram = within(modal).getByAltText(/Great Tinamou sonogram/i)

    Object.defineProperty(audio, 'duration', {
      configurable: true,
      value: Number.NaN,
    })
    Object.defineProperty(audio, 'currentTime', {
      configurable: true,
      writable: true,
      value: 5,
    })

    fireEvent.load(sonogram)
    fireEvent.loadedMetadata(audio)
    fireEvent.timeUpdate(audio)

    await waitFor(() => {
      expect(modal.querySelector('.bird-sonogram-playhead'))
        .toHaveStyle({ '--playhead-position': '25%' })
    })
  })

  test('resets the sonogram playhead when audio ends', async () => {
    const messages = [
      {
        role: 'assistant',
        content: 'Here is a bird with synced audio.',
        metadata: {
          birdMatches: [
            {
              speciesCode: 'gretin1',
              commonName: 'Great Tinamou',
              scientificName: 'Tinamus major',
              media: {
                songUrl: 'https://example.com/great-tinamou.mp3',
                sonogramUrl: 'https://example.com/great-tinamou-sonogram.png',
              },
            },
          ],
        },
      },
    ]

    render(<ChatMessages messages={messages} isLoading={false} />)

    fireEvent.click(screen.getByRole('button', { name: /Open Great Tinamou details/i }))

    const modal = screen.getByRole('dialog', { name: /Great Tinamou details/i })
    const audio = within(modal).getByLabelText(/Great Tinamou song recording/i)
    const sonogram = within(modal).getByAltText(/Great Tinamou sonogram/i)

    Object.defineProperty(audio, 'duration', {
      configurable: true,
      value: 8,
    })
    Object.defineProperty(audio, 'currentTime', {
      configurable: true,
      writable: true,
      value: 4,
    })

    fireEvent.load(sonogram)
    fireEvent.loadedMetadata(audio)
    fireEvent.timeUpdate(audio)

    await waitFor(() => {
      expect(modal.querySelector('.bird-sonogram-playhead'))
        .toHaveStyle({ '--playhead-position': '50%' })
    })

    fireEvent.ended(audio)

    expect(modal.querySelector('.bird-sonogram-playhead'))
      .toHaveStyle({ '--playhead-position': '0%' })
  })

  test('does not render a sonogram playhead without a synced audio pair', () => {
    const messages = [
      {
        role: 'assistant',
        content: 'Here is a bird with a sonogram only.',
        metadata: {
          birdMatches: [
            {
              speciesCode: 'gretin1',
              commonName: 'Great Tinamou',
              scientificName: 'Tinamus major',
              media: {
                sonogramUrl: 'https://example.com/great-tinamou-sonogram.png',
              },
            },
          ],
        },
      },
    ]

    render(<ChatMessages messages={messages} isLoading={false} />)

    fireEvent.click(screen.getByRole('button', { name: /Open Great Tinamou details/i }))

    const modal = screen.getByRole('dialog', { name: /Great Tinamou details/i })
    fireEvent.load(within(modal).getByAltText(/Great Tinamou sonogram/i))

    expect(modal.querySelector('.bird-sonogram-playhead')).not.toBeInTheDocument()
  })

  test('resolves relative bird media through the API media endpoint', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { url: 'https://bucket.example.test/photos/great-tinamou-square.jpg' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { url: 'https://bucket.example.test/photos/great-tinamou.jpg' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { url: 'https://bucket.example.test/songs/great-tinamou.mp3' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { url: 'https://bucket.example.test/sonograms/great-tinamou.png' },
        }),
      })

    const messages = [
      {
        role: 'assistant',
        content: 'Here is a media-rich bird profile.',
        metadata: {
          birdMatches: [
            {
              speciesCode: 'gretin1',
              commonName: 'Great Tinamou',
              scientificName: 'Tinamus major',
              media: {
                photoUrl: 'photos/great-tinamou.jpg',
                squarePhotoUrl: 'photos/great-tinamou-square.jpg',
                songUrl: 'songs/great-tinamou.mp3',
                sonogramUrl: 'sonograms/great-tinamou.png',
                photoAttribution: '(c) Example Photographer',
                songAttributionHtml: '<p>Sound recording by Example Recordist.</p>',
              },
            },
          ],
        },
      },
    ]

    render(<ChatMessages messages={messages} isLoading={false} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Open Great Tinamou details/i }).querySelector('img'))
        .toHaveAttribute('src', 'https://bucket.example.test/photos/great-tinamou-square.jpg')
    })

    fireEvent.click(screen.getByRole('button', { name: /Open Great Tinamou details/i }))

    const modal = screen.getByRole('dialog', { name: /Great Tinamou details/i })

    await waitFor(() => {
      expect(within(modal).getByAltText(/Great Tinamou photo/i))
        .toHaveAttribute('src', 'https://bucket.example.test/photos/great-tinamou.jpg')
      expect(within(modal).getByLabelText(/Great Tinamou song recording/i))
        .toHaveAttribute('src', 'https://bucket.example.test/songs/great-tinamou.mp3')
      expect(within(modal).getByAltText(/Great Tinamou sonogram/i))
        .toHaveAttribute('src', 'https://bucket.example.test/sonograms/great-tinamou.png')
      expect(within(modal).getByText('(c) Example Photographer')).toBeInTheDocument()
      expect(within(modal).getByText('Sound recording by Example Recordist.')).toBeInTheDocument()
    })

    expect(global.fetch).toHaveBeenCalledWith('/files/photos/great-tinamou-square.jpg')
    expect(global.fetch).toHaveBeenCalledWith('/files/photos/great-tinamou.jpg')
    expect(global.fetch).toHaveBeenCalledWith('/files/songs/great-tinamou.mp3')
    expect(global.fetch).toHaveBeenCalledWith('/files/sonograms/great-tinamou.png')
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

  test('renders reservation tour node, subnode, and zone metadata', () => {
    const messages = [
      {
        role: 'assistant',
        content: 'Your reservation is confirmed.',
        metadata: {
          reservation: {
            confirmation_code: 'BW-GRAPH123',
            customer_name: 'Ana Rivera',
            tour_name: 'Monteverde Quetzal Tour',
            tour_location: 'Monteverde / Curi-Cancha Reserve',
            tour_node: 'Monteverde',
            tour_subnode: 'Curi-Cancha Reserve',
            tour_zone: 'Northern Mountains',
          },
        },
      },
    ]

    render(<ChatMessages messages={messages} isLoading={false} />)

    expect(screen.getByLabelText(/Reservation confirmation/i)).toBeInTheDocument()
    expect(screen.getByText('BW-GRAPH123')).toBeInTheDocument()
    expect(screen.getByText('Monteverde / Curi-Cancha Reserve')).toBeInTheDocument()
    expect(screen.getByText('Monteverde')).toBeInTheDocument()
    expect(screen.getByText('Curi-Cancha Reserve')).toBeInTheDocument()
    expect(screen.getByText('Northern Mountains')).toBeInTheDocument()
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
    const conversationContext = {
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

    render(<ChatMessages messages={messages} isLoading={false} conversationContext={conversationContext} />)

    expect(screen.getByLabelText(/Reservation confirmation/i)).toBeInTheDocument()
    expect(screen.getByText('BW-CHATMETA123')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText(/Shared shuttle from San Jose to Monteverde/i)).toBeInTheDocument()
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
    const conversationContext = {
      reservation: {
        confirmationCode: 'BW-ONCE123',
        tourName: 'Monteverde Quetzal Tour',
      },
    }

    render(<ChatMessages messages={messages} isLoading={false} conversationContext={conversationContext} />)

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

  test('collects all missing reservation details in one message', () => {
    const onAction = jest.fn()
    const messages = [{
      role: 'assistant',
      content: 'Please provide the remaining reservation details.',
      metadata: {
        uiAction: {
          type: 'reservation_details',
          prompt: 'Please provide the remaining reservation details.',
          fields: [
            {
              name: 'date',
              type: 'date',
              label: 'Choose a date for the tour.',
              availableDates: ['2026-09-10', '2026-09-12'],
            },
            {
              name: 'participants',
              type: 'select',
              label: 'How many participants should I reserve?',
              options: [{ label: '1', value: 1 }, { label: '2', value: 2 }],
            },
            {
              name: 'transportationRequired',
              type: 'select',
              label: 'Would you like transportation?',
              options: [
                { label: 'Yes', value: true },
                { label: 'No', value: false },
              ],
            },
            {
              name: 'pickupLocation',
              type: 'text',
              label: 'Pickup location',
              requiredWhen: { field: 'transportationRequired', equals: true },
            },
          ],
        },
      },
    }]

    render(<ChatMessages messages={messages} isLoading={false} onAction={onAction} />)

    fireEvent.change(screen.getByLabelText(/Choose a date/i), {
      target: { value: '2026-09-10' },
    })
    fireEvent.change(screen.getByLabelText(/How many participants/i), {
      target: { value: '2' },
    })
    fireEvent.change(screen.getByLabelText(/Would you like transportation/i), {
      target: { value: 'true' },
    })
    fireEvent.change(screen.getByLabelText(/Pickup location/i), {
      target: { value: 'San Jose' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Send reservation details/i }))

    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onAction).toHaveBeenCalledWith(
      'I want to complete the reservation. Date: 2026-09-10. Participants: 2. Transportation required: yes. Pickup location: San Jose.'
    )
  })

  test('validates combined reservation details without resubmitting known fields', () => {
    const onAction = jest.fn()
    const messages = [{
      role: 'assistant',
      content: 'Please provide the remaining reservation details.',
      metadata: {
        uiAction: {
          type: 'reservation_details',
          fields: [{
            name: 'customerEmail',
            type: 'email',
            label: 'Email',
          }],
        },
      },
    }]

    render(<ChatMessages messages={messages} isLoading={false} onAction={onAction} />)

    fireEvent.change(screen.getByLabelText(/^Email$/i), { target: { value: 'invalid' } })
    fireEvent.click(screen.getByRole('button', { name: /Send reservation details/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/valid email/i)
    expect(onAction).not.toHaveBeenCalled()
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

  test('blocks an unavailable date before sending the date selection action', () => {
    const onAction = jest.fn()
    render(<ChatMessages messages={[{
      role: 'assistant',
      content: 'Choose a date.',
      metadata: { uiAction: { type: 'date_picker', tourId: 9, prompt: 'Choose a date', availableDates: ['2026-09-10', '2026-09-12'] } },
    }]} isLoading={false} onAction={onAction} />)

    fireEvent.change(screen.getAllByLabelText(/choose a date/i)[0], { target: { value: '2026-09-11' } })
    fireEvent.click(screen.getByRole('button', { name: /choose date/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/not available/i)
    expect(onAction).not.toHaveBeenCalled()

    fireEvent.change(screen.getAllByLabelText(/choose a date/i)[0], { target: { value: '2026-09-12' } })
    fireEvent.click(screen.getByRole('button', { name: /choose date/i }))
    expect(onAction).toHaveBeenCalledWith('Use 2026-09-12 for tour 9')
  })
})
