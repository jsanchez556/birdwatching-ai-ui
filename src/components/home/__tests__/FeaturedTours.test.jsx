import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { clearMediaUrlCache } from '../../../api/mediaApi'
import FeaturedTours from '../FeaturedTours'

const northZoneTours = [
  {
    id: 1,
    zone: 'North Zone',
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

test('groups tours by zone and advances each zone carousel by one tour', async () => {
  render(
    <FeaturedTours
      tours={[
        ...northZoneTours,
        {
          id: 5,
          zone: 'Guanacaste',
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
  expect(screen.getByText('Jan 10, 2026 to Jan 12, 2026')).toBeInTheDocument()
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

test('renders reserve tour action for a featured tour', () => {
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

  fireEvent.click(screen.getByRole('button', { name: /reserve first north tour/i }))

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
