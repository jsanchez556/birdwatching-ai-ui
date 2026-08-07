import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { clearMediaUrlCache } from '../../../api/mediaApi'
import FeaturedTours from '../FeaturedTours'

const northZoneTours = [
  {
    id: 1,
    zone: 'North Zone',
    zoneRank: 1,
    rank: 1,
    name: 'Miravalles Highland Birding Tour',
    title: 'First North Tour',
    description: 'Rainforest birding.',
    location: 'Sarapiqui',
    node: 'Miravalles',
    subnode: 'Bijagua',
    duration: '4 hours',
    difficulty: 'Moderate',
    pricePerPerson: 120,
    portraitUrl: '/files/tours/1.png',
    start_date: null,
    end_date: null,
    birds: [{ species_code: 'quetz1', name: 'Resplendent Quetzal' }],
  },
  {
    id: 2,
    zone: 'North Zone',
    zoneRank: 1,
    rank: 2,
    name: 'Cano Negro Wetlands Tour',
    title: 'Second North Tour',
    description: 'Wetland birding.',
    location: 'Cano Negro',
    node: 'Cano Negro',
    duration: '5 hours',
    difficulty: 'Easy',
    pricePerPerson: 140,
    start_date: '2026-01-10',
    end_date: '2026-01-12',
    birds: [],
  },
  {
    id: 3,
    zone: 'North Zone',
    zoneRank: 1,
    rank: 3,
    name: 'Arenal Foothill Birding Tour',
    title: 'Third North Tour',
    description: 'Foothill birding.',
    location: 'Arenal',
    node: 'Arenal',
    duration: '6 hours',
    difficulty: 'Moderate',
    pricePerPerson: 160,
    start_date: null,
    end_date: null,
    birds: [],
  },
  {
    id: 4,
    zone: 'North Zone',
    zoneRank: 1,
    rank: 4,
    name: 'Boca Tapada Lowland Tour',
    title: 'Fourth North Tour',
    description: 'Lowland birding.',
    location: 'Boca Tapada',
    node: 'Boca Tapada',
    duration: '3 hours',
    difficulty: 'Easy',
    pricePerPerson: 100,
    start_date: null,
    end_date: null,
    birds: [],
  },
]

function futureDate(days = 30) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

beforeEach(() => {
  clearMediaUrlCache()
  global.fetch = jest.fn().mockImplementation((url) => {
    if (String(url).startsWith('/birds/profile')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            bird: {
              speciesCode: 'quetz1',
              commonName: 'Resplendent Quetzal',
              scientificName: 'Pharomachrus mocinno',
              family: 'Trogons',
              description: 'A cloud forest icon.',
              locations: 'Monteverde',
              media: {},
            },
          },
          meta: {},
        }),
      })
    }

    return Promise.resolve({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          url: 'https://bucket.example.test/tours/1.png?signature=abc',
        },
        meta: {},
      }),
    })
  })
})

test('uses the updated image version without changing unrelated tour image references', async () => {
  global.fetch = jest.fn().mockImplementation((url) => Promise.resolve({
    ok: true,
    json: async () => ({
      success: true,
      data: {
        url: `https://cdn.example.test/${String(url).replace(/^\/files\//, '')}`,
      },
      meta: {},
    }),
  }))

  render(
    <FeaturedTours
      tours={[
        { ...northZoneTours[0], portraitVersion: '1725379200000' },
        { ...northZoneTours[1], portraitUrl: '/files/tours/2.png' },
      ]}
      isLoading={false}
      error={null}
    />
  )

  const updatedShell = screen.getByLabelText('First North Tour image and summary')
  const unchangedShell = screen.getByLabelText('Second North Tour image and summary')
  await waitFor(() => expect(updatedShell.querySelector('img')).toHaveAttribute(
    'src',
    'https://cdn.example.test/tours/1.png?v=1725379200000',
  ))
  expect(unchangedShell.querySelector('img')).toHaveAttribute(
    'src',
    'https://cdn.example.test/tours/2.png',
  )
})

test('uses each persisted tour image path instead of a mismatched stale portrait URL', async () => {
  const currentImagePath = 'tours/11111111-1111-4111-8111-111111111111.png'
  global.fetch = jest.fn().mockImplementation((url) => Promise.resolve({
    ok: true,
    json: async () => ({
      success: true,
      data: { url: `https://cdn.example.test/${String(url).replace(/^\/files\//, '')}` },
      meta: {},
    }),
  }))

  render(<FeaturedTours tours={[{
    ...northZoneTours[0],
    imagePath: currentImagePath,
    imageVersion: '1788564000000',
    portraitUrl: '/files/tours/1.png?v=stale',
  }]} isLoading={false} error={null} />)

  const shell = screen.getByLabelText('First North Tour image and summary')
  await waitFor(() => expect(shell.querySelector('img')).toHaveAttribute(
    'src',
    `https://cdn.example.test/${currentImagePath}?v=1788564000000`,
  ))
  expect(global.fetch).toHaveBeenCalledWith(`/files/${currentImagePath}`)
  expect(global.fetch).not.toHaveBeenCalledWith('/files/tours/1.png')
})

test('displays legacy extensionless numeric tour image paths', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      success: true,
      data: { url: 'https://cdn.example.test/tours/11.png' },
      meta: {},
    }),
  })

  render(<FeaturedTours tours={[{
    ...northZoneTours[0],
    id: 11,
    imagePath: 'tours/11',
    imageVersion: '1788480238110',
    portraitUrl: null,
  }]} isLoading={false} error={null} />)

  const shell = screen.getByLabelText('First North Tour image and summary')
  await waitFor(() => expect(shell.querySelector('img')).toHaveAttribute(
    'src',
    'https://cdn.example.test/tours/11.png?v=1788480238110',
  ))
  expect(global.fetch).toHaveBeenCalledWith('/files/tours/11.png')
})

test('does not render a stale portrait URL when the persisted image path is invalid', () => {
  render(<FeaturedTours tours={[{
    ...northZoneTours[0],
    imagePath: 'tours/not-this-tour.jpg',
    portraitUrl: '/files/tours/1.png?v=stale',
  }]} isLoading={false} error={null} />)

  const shell = screen.getByLabelText('First North Tour image and summary')
  expect(shell.querySelector('img.home-card-image')).not.toBeInTheDocument()
  expect(global.fetch).not.toHaveBeenCalledWith('/files/tours/1.png')
})

test('shows the image fallback after a portrait load error without retrying in a loop', async () => {
  render(<FeaturedTours tours={[northZoneTours[0]]} isLoading={false} error={null} />)

  const shell = screen.getByLabelText('First North Tour image and summary')
  const image = await waitFor(() => {
    const candidate = shell.querySelector('img.home-card-image')
    expect(candidate).toBeInTheDocument()
    return candidate
  })
  const mediaRequestsBeforeFailure = global.fetch.mock.calls.filter(([url]) => (
    String(url).startsWith('/files/tours/')
  )).length

  fireEvent.error(image)

  expect(shell.querySelector('img.home-card-image')).not.toBeInTheDocument()
  expect(within(shell).getByText('Miravalles Highland Birding Tour')).toBeInTheDocument()
  expect(global.fetch.mock.calls.filter(([url]) => (
    String(url).startsWith('/files/tours/')
  ))).toHaveLength(mediaRequestsBeforeFailure)
})

test('groups tours by zone and advances each zone carousel by one tour', async () => {
  render(
    <FeaturedTours
      tours={[
        ...northZoneTours,
        {
          id: 5,
          zone: 'Guanacaste',
          zoneRank: 2,
          rank: 1,
          name: 'Palo Verde Dry Forest Tour',
          title: 'Guanacaste Dry Forest Tour',
          description: 'Dry forest birding.',
          location: 'Palo Verde',
          node: 'Palo Verde',
          duration: '4 hours',
          difficulty: 'Easy',
          pricePerPerson: 115,
          start_date: null,
          end_date: null,
          birds: [],
        },
      ]}
      isLoading={false}
      error={null}
    />
  )

  expect(screen.getByRole('heading', { name: 'North Zone' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Guanacaste' })).toBeInTheDocument()
  expect(screen.getByText('Miravalles Highland Birding Tour')).toBeInTheDocument()
  expect(screen.queryByText('Boca Tapada Lowland Tour')).not.toBeInTheDocument()
  expect(screen.queryByText('Jan 10, 2026 to Jan 12, 2026')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /open resplendent quetzal details/i }))
  expect(await screen.findByRole('dialog', { name: /resplendent quetzal details/i })).toBeInTheDocument()
  expect(await screen.findByText('Pharomachrus mocinno')).toBeInTheDocument()
  expect(await screen.findByText('A cloud forest icon.')).toBeInTheDocument()
  expect(global.fetch).toHaveBeenCalledWith(
    '/birds/profile?speciesCode=quetz1&name=Resplendent+Quetzal'
  )
  fireEvent.click(screen.getByRole('button', { name: /close bird details/i }))
  expect(screen.queryByRole('dialog', { name: /resplendent quetzal details/i })).not.toBeInTheDocument()

  const firstTourSummary = screen.getAllByLabelText('Tour summary')[0]
  expect(within(firstTourSummary).getByText('Miravalles Highland Birding Tour')).toBeInTheDocument()
  expect(within(firstTourSummary).getByText('Bijagua')).toBeInTheDocument()
  expect(within(firstTourSummary).getByText('4 hours')).toBeInTheDocument()
  expect(within(firstTourSummary).getByText('Moderate')).toBeInTheDocument()
  expect(within(firstTourSummary).getByText('From $120')).toBeInTheDocument()
  await waitFor(() => {
    expect(document.querySelector('img.home-card-image')).toHaveAttribute(
      'src',
      'https://bucket.example.test/tours/1.png?signature=abc'
    )
  })
  expect(global.fetch).toHaveBeenCalledWith('/files/tours/1.png')

  fireEvent.click(screen.getByRole('button', { name: /show next north zone tours/i }))

  expect(screen.queryByText('Miravalles Highland Birding Tour')).not.toBeInTheDocument()
  expect(screen.getByText('Boca Tapada Lowland Tour')).toBeInTheDocument()
})

test('starts add-to-cart from a featured tour', () => {
  const onAddToCart = jest.fn()
  const cartTour = {
    ...northZoneTours[0],
    portraitUrl: null,
  }

  render(
    <FeaturedTours
      tours={[cartTour]}
      isLoading={false}
      error={null}
      onAddToCart={onAddToCart}
    />
  )

  fireEvent.click(screen.getByRole('button', { name: /add first north tour to tour cart/i }))

  expect(onAddToCart).toHaveBeenCalledWith(cartTour)
})

test('renders Book Tour action for a featured tour', () => {
  const onReserveTour = jest.fn()
  const cartTour = {
    ...northZoneTours[0],
    portraitUrl: null,
  }

  render(
    <FeaturedTours
      tours={[cartTour]}
      isLoading={false}
      error={null}
      onReserveTour={onReserveTour}
    />
  )

  fireEvent.click(screen.getByRole('button', { name: /book tour: first north tour/i }))

  expect(onReserveTour).toHaveBeenCalledWith(cartTour)
})

test('shows add-to-cart loading state and prevents duplicate clicks', () => {
  const onAddToCart = jest.fn()
  const cartTour = {
    ...northZoneTours[0],
    portraitUrl: null,
  }

  render(
    <FeaturedTours
      addingTourIds={[1]}
      tours={[cartTour]}
      isLoading={false}
      error={null}
      onAddToCart={onAddToCart}
    />
  )

  const addButton = screen.getByRole('button', { name: /adding first north tour to tour cart/i })
  expect(addButton).toBeDisabled()
  expect(addButton).toHaveTextContent(/adding/i)

  fireEvent.click(addButton)

  expect(onAddToCart).not.toHaveBeenCalled()
})

test('shows remove action for an added tour', () => {
  const onRemoveFromCart = jest.fn()
  const cartTour = {
    ...northZoneTours[0],
    portraitUrl: null,
  }

  render(
    <FeaturedTours
      addedTourIds={[1]}
      isCartEnabled
      tours={[cartTour]}
      isLoading={false}
      error={null}
      onRemoveFromCart={onRemoveFromCart}
    />
  )

  const removeButton = screen.getByRole('button', { name: /remove first north tour from tour cart/i })
  expect(removeButton).toBeEnabled()

  fireEvent.click(removeButton)

  expect(onRemoveFromCart).toHaveBeenCalledWith(cartTour)
})

test('supports approximate and accent-insensitive tour search without structured filters', () => {
  render(
    <FeaturedTours
      tours={[
        {
          ...northZoneTours[0],
          id: 1,
          title: 'Río Celeste Motmot Walk',
          name: 'Río Celeste Motmot Walk',
          zone: 'Guanacaste',
          tourType: 'scheduled',
          maxParticipants: 5,
          availableSlots: 5,
          startDate: futureDate(),
          endDate: futureDate(1),
          occurrenceDates: [{ date: futureDate(), status: 'scheduled', remainingSpaces: 5 }],
        },
        {
          ...northZoneTours[0],
          id: 2,
          title: 'Carara Macaw Walk',
          name: 'Carara Macaw Walk',
          zone: 'Central Pacific',
          tourType: 'unscheduled',
          maxParticipants: 2,
          availableSlots: 2,
        },
      ]}
      isLoading={false}
      error={null}
    />
  )

  fireEvent.change(screen.getByRole('searchbox', { name: /search tours/i }), { target: { value: 'Guanacste' } })
  expect(screen.getByText('Río Celeste Motmot Walk')).toBeInTheDocument()
  expect(screen.queryByText('Carara Macaw Walk')).not.toBeInTheDocument()

  fireEvent.change(screen.getByRole('searchbox', { name: /search tours/i }), { target: { value: 'Rio Celeste' } })
  expect(screen.getByText('Río Celeste Motmot Walk')).toBeInTheDocument()
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  expect(document.querySelector('input[type="date"]')).not.toBeInTheDocument()
})

test('presents and filters the supported nature-tour categories', () => {
  render(<FeaturedTours tours={[
    { ...northZoneTours[0], id: 21, name: 'Quetzal Dawn', type: 'Birdwatching', availableSlots: 4 },
    { ...northZoneTours[0], id: 22, name: 'Forest After Dark', type: 'Night walk', availableSlots: 4 },
  ]} isLoading={false} error={null} />)

  expect(screen.getByRole('group', { name: /filter tours by activity type/i })).toBeInTheDocument()
  const allToursFilter = screen.getByRole('button', { name: 'All' })
  const nightWalkFilter = screen.getByRole('button', { name: 'Night walk' })

  expect(allToursFilter).toHaveAttribute('aria-pressed', 'true')
  expect(nightWalkFilter).toHaveAttribute('aria-pressed', 'false')

  fireEvent.click(nightWalkFilter)

  expect(allToursFilter).toHaveAttribute('aria-pressed', 'false')
  expect(nightWalkFilter).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByText('Forest After Dark')).toBeInTheDocument()
  expect(screen.queryByText('Quetzal Dawn')).not.toBeInTheDocument()
})

test('shows a clearable empty state for an unmatched search', () => {
  const filterTour = { ...northZoneTours[0], portraitUrl: null, maxParticipants: 2, availableSlots: 2 }
  render(<FeaturedTours tours={[filterTour]} isLoading={false} error={null} />)

  fireEvent.change(screen.getByRole('searchbox', { name: /search tours/i }), { target: { value: 'nonexistent destination' } })
  expect(screen.getByRole('status')).toHaveTextContent(/no eligible tours match/i)
  fireEvent.click(screen.getByRole('button', { name: /clear search/i }))
  expect(screen.getByText(filterTour.name)).toBeInTheDocument()
})

test('does not render inactive, full, or completed tours as bookable', () => {
  render(<FeaturedTours tours={[
    { ...northZoneTours[0], id: 11, name: 'Inactive Tour', isActive: false },
    { ...northZoneTours[0], id: 12, name: 'Full Tour', availableSlots: 0 },
    { ...northZoneTours[0], id: 13, name: 'Completed Tour', tourType: 'scheduled', availableSlots: 4, occurrenceDates: [{ date: '2026-01-01', status: 'completed', remainingSpaces: 4 }] },
  ]} isLoading={false} error={null} />)

  expect(screen.getByRole('status')).toHaveTextContent(/no eligible tours/i)
  expect(screen.queryByRole('button', { name: /book tour/i })).not.toBeInTheDocument()
})

test('orders zones by zoneRank and uses stable fallbacks', () => {
  render(<FeaturedTours tours={[
    { ...northZoneTours[0], id: 30, zone: 'Unranked', zoneRank: null, rank: null },
    { ...northZoneTours[0], id: 20, zone: 'Second', zoneRank: 2, rank: 2 },
    { ...northZoneTours[0], id: 10, zone: 'First B', zoneRank: 1, rank: 2 },
    { ...northZoneTours[0], id: 9, zone: 'First A', zoneRank: 1, rank: 1 },
  ]} isLoading={false} error={null} />)

  expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent))
    .toEqual(['First A', 'First B', 'Second', 'Unranked'])
})

test('shows scheduled facts, hides flexible facts, and formats day durations', () => {
  const startDate = futureDate(20)
  const endDate = futureDate(22)
  render(<FeaturedTours tours={[
    { ...northZoneTours[0], id: 40, zone: 'Flexible', duration: null, durationValue: 1, durationUnit: 'days', maxParticipants: 4 },
    { ...northZoneTours[0], id: 41, zone: 'Scheduled', tourType: 'scheduled', duration: null,
      durationValue: 2, durationUnit: 'days', availableSlots: 3, startDate, endDate,
      occurrenceDates: [{ date: startDate, status: 'scheduled', remainingSpaces: 3 }] },
  ]} isLoading={false} error={null} />)

  expect(screen.getByText('1 day')).toBeInTheDocument()
  expect(screen.getByText('2 days')).toBeInTheDocument()
  expect(screen.getByText('3 places available')).toBeInTheDocument()
  expect(screen.getAllByText('Availability')).toHaveLength(1)
  expect(screen.getAllByText('Dates')).toHaveLength(1)
})

test('hides a scheduled tour on and after its start date', () => {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const parts = Object.fromEntries(today.map((part) => [part.type, part.value]))
  const startDate = `${parts.year}-${parts.month}-${parts.day}`
  render(<FeaturedTours tours={[{
    ...northZoneTours[0], tourType: 'scheduled', startDate, endDate: futureDate(),
    availableSlots: 3,
    occurrenceDates: [{ date: futureDate(), status: 'scheduled', remainingSpaces: 3 }],
  }]} isLoading={false} error={null} />)

  expect(screen.getByRole('status')).toHaveTextContent(/no eligible tours/i)
})

test('allows a failed tour request to be retried', () => {
  const onRetry = jest.fn()
  render(<FeaturedTours tours={[]} isLoading={false} error="Unavailable" onRetry={onRetry} />)

  fireEvent.click(screen.getByRole('button', { name: /retry tours/i }))
  expect(onRetry).toHaveBeenCalledTimes(1)
})

test('shows remove loading state and prevents duplicate clicks', () => {
  const onRemoveFromCart = jest.fn()
  const cartTour = {
    ...northZoneTours[0],
    portraitUrl: null,
  }

  render(
    <FeaturedTours
      addedTourIds={[1]}
      removingTourIds={[1]}
      tours={[cartTour]}
      isLoading={false}
      error={null}
      onRemoveFromCart={onRemoveFromCart}
    />
  )

  const removeButton = screen.getByRole('button', { name: /removing first north tour from tour cart/i })
  expect(removeButton).toBeDisabled()
  expect(removeButton).toHaveTextContent(/removing/i)

  fireEvent.click(removeButton)

  expect(onRemoveFromCart).not.toHaveBeenCalled()
})

test('returns to add-to-cart action after removal state clears', () => {
  const cartTour = {
    ...northZoneTours[0],
    portraitUrl: null,
  }

  const { rerender } = render(
    <FeaturedTours
      addedTourIds={[1]}
      tours={[cartTour]}
      isLoading={false}
      error={null}
    />
  )

  expect(screen.getByRole('button', { name: /remove first north tour from tour cart/i })).toBeInTheDocument()

  rerender(
    <FeaturedTours
      addedTourIds={[]}
      tours={[cartTour]}
      isLoading={false}
      error={null}
    />
  )

  expect(screen.getByRole('button', { name: /add first north tour to tour cart/i })).toBeInTheDocument()
})

test('defensively excludes a tour whose owner is suspended from the public carousel', () => {
  render(<FeaturedTours tours={[{
    ...northZoneTours[0], portraitUrl: null, ownerStatus: 'suspended',
  }]} isLoading={false} error={null} />)
  expect(screen.queryByText('First North Tour')).not.toBeInTheDocument()
  expect(screen.getByText(/No eligible tours match/i)).toBeInTheDocument()
})
