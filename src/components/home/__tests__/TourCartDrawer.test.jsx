import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import TourCartDrawer from '../TourCartDrawer'

const authUser = {
  email: 'ana@example.com',
  name: 'Ana Rivera',
}

function renderDrawer(props = {}) {
  const defaults = {
    authUser,
    cart: {
      itineraryStartDate: null,
      itineraryEndDate: null,
      items: [],
      count: 0,
    },
    error: null,
    isLoading: false,
    onClose: jest.fn(),
    onRemoveItem: jest.fn(),
    onReserveCart: jest.fn(),
    onReserveItem: jest.fn(),
    onSaveItinerary: jest.fn().mockResolvedValue({}),
    onUpdateItem: jest.fn(),
  }

  const mergedProps = {
    ...defaults,
    ...props,
    cart: {
      ...defaults.cart,
      ...(props.cart || {}),
    },
  }

  render(<TourCartDrawer {...mergedProps} />)
  return mergedProps
}

test('empty cart renders the empty state without the generic error message', () => {
  renderDrawer({ error: 'Something went wrong. Please try again.' })

  expect(screen.getByText(/your cart is ready for a route/i)).toBeInTheDocument()
  expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument()
})

test('renders CustomerContextForm inline instead of the old cart itinerary panel', () => {
  renderDrawer({
    cart: {
      itineraryStartDate: '2026-07-10',
      itineraryEndDate: '2026-07-12',
    },
  })

  const cartDialog = screen.getByRole('dialog', { name: /your selected tours/i })
  expect(within(cartDialog).queryByRole('region', { name: /cart itinerary/i })).not.toBeInTheDocument()
  expect(within(cartDialog).queryByRole('button', { name: /change itinerary/i })).not.toBeInTheDocument()
  expect(within(cartDialog).getByRole('region', { name: /reservation contact and itinerary/i })).toBeInTheDocument()
  expect(within(cartDialog).queryByRole('heading', { name: /reservation contact and itinerary/i })).not.toBeInTheDocument()
  expect(within(cartDialog).queryByText(/use these dates to keep cart tours/i)).not.toBeInTheDocument()
  expect(within(cartDialog).getByLabelText(/start date/i)).toHaveValue('2026-07-10')
  expect(within(cartDialog).getByLabelText(/end date/i)).toHaveValue('2026-07-12')
})

test('submitting itinerary dates saves through the drawer handler', async () => {
  const onSaveItinerary = jest.fn().mockResolvedValue({})

  renderDrawer({
    cart: {
      itineraryStartDate: '2026-07-10',
      itineraryEndDate: '2026-07-12',
    },
    onSaveItinerary,
  })

  fireEvent.change(screen.getByLabelText(/start date/i), {
    target: { value: '2026-07-14' },
  })
  fireEvent.change(screen.getByLabelText(/end date/i), {
    target: { value: '2026-07-16' },
  })
  fireEvent.click(screen.getByRole('button', { name: /save itinerary/i }))

  await waitFor(() => expect(onSaveItinerary).toHaveBeenCalledWith({
    itineraryStartDate: '2026-07-14',
    itineraryEndDate: '2026-07-16',
  }))
  expect(screen.getByRole('status')).toHaveTextContent(/itinerary dates updated/i)
})

test('reserve this tour starts chat reservation for the selected cart item even without a date', () => {
  const onReserveItem = jest.fn()
  const cartItem = {
    id: 12,
    tourId: 3,
    scheduledDate: null,
    participants: 2,
    needsTransfer: true,
    tour: {
      name: 'Monteverde Quetzal Tour',
      location: 'Monteverde',
      pricePerPerson: 120,
    },
  }

  renderDrawer({
    cart: {
      items: [cartItem],
      count: 1,
    },
    onReserveItem,
  })

  fireEvent.click(screen.getByRole('button', { name: /reserve this tour/i }))

  expect(onReserveItem).toHaveBeenCalledWith(cartItem)
})

test('reserve cart starts chat reservation with all cart items', () => {
  const onReserveCart = jest.fn()
  const cartItems = [
    {
      id: 12,
      tourId: 3,
      scheduledDate: '2026-07-10',
      tour: {
        name: 'Monteverde Quetzal Tour',
        location: 'Monteverde',
        pricePerPerson: 120,
      },
    },
    {
      id: 13,
      tourId: 4,
      scheduledDate: '2026-07-11',
      tour: {
        name: 'Sarapiqui Rainforest Tour',
        location: 'Sarapiqui',
        pricePerPerson: 140,
      },
    },
  ]

  renderDrawer({
    cart: {
      items: cartItems,
      count: 2,
    },
    onReserveCart,
  })

  fireEvent.click(screen.getByRole('button', { name: /reserve cart/i }))

  expect(onReserveCart).toHaveBeenCalledWith(cartItems)
})
