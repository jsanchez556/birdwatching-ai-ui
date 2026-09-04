import { fireEvent, render, screen } from '@testing-library/react'
import TransportSurface from '../TransportSurface'
import useTransportBooking from '../../hooks/useTransportBooking'

jest.mock('../../hooks/useTransportBooking')
jest.mock('../../components/transport/TransportMap', () => function MapMock() { return <div aria-label="Pickup and drop-off map" /> })

const route = {
  origin: { label: 'San José, Costa Rica' }, destination: { label: 'Bijagua, Costa Rica' },
  distanceKm: 202.3, durationMinutes: 205,
}
const vehicle = {
  id: 1, name: 'Toyota Hiace', vehicleType: 'Minivan', description: 'Group vehicle', imagePath: null,
  passengerCapacity: 12, luggageCapacity: 8, currency: 'USD', pricePerKm: '2.50', minimumFare: '95.00',
  distanceCharge: '505.75', finalFare: '505.75', minimumFareApplied: false,
}

function state(overrides = {}) {
  return {
    step: 1, setStep: jest.fn(), places: { origin: null, destination: null }, setPlace: jest.fn(),
    ride: { date: '', time: '', passengers: 2 }, updateRide: jest.fn(), route: null, calculateRoute: jest.fn(),
    luggage: 0, refreshVehicles: jest.fn(), vehicles: [], vehicle: null, selectVehicle: jest.fn(),
    contact: { firstName: '', lastName: '', email: '', phone: '' }, setContact: jest.fn(), comments: '', setComments: jest.fn(),
    paymentMethod: { type: 'pay_on_arrival' }, setPaymentMethod: jest.fn(), status: { type: 'idle', message: '' },
    confirmation: null, contactValid: false, chooseVehicles: jest.fn(), continueToContact: jest.fn(), submit: jest.fn(),
    ...overrides,
  }
}

describe('TransportSurface', () => {
  test('renders the accessible four-step ride entry flow', () => {
    useTransportBooking.mockReturnValue(state())
    render(<TransportSurface auth={{}} onBack={jest.fn()} />)
    expect(screen.getByRole('list', { name: 'Booking progress' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Enter Ride Details/ })).toHaveAttribute('aria-current', 'step')
    expect(screen.getByLabelText('Pickup and drop-off map')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Choose a vehicle/ })).toBeDisabled()
    expect(screen.getByRole('heading', { name: /Travel comfortably between birding destinations/ })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Transportation booking' })).toHaveClass('transport-wizard')
  })

  test('shows authoritative vehicle pricing and ride summary', () => {
    useTransportBooking.mockReturnValue(state({ step: 2, route, vehicles: [vehicle], luggage: 1, ride: { date: '2030-02-03', time: '12:00', passengers: 2 } }))
    render(<TransportSurface auth={{}} onBack={jest.fn()} />)
    expect(screen.getAllByText('Toyota Hiace').length).toBeGreaterThan(0)
    expect(screen.getByText('USD 505.75')).toBeInTheDocument()
    expect(screen.getByText(/202.3 km/)).toBeInTheDocument()
  })

  test('exposes the selected vehicle state visually and semantically', () => {
    useTransportBooking.mockReturnValue(state({ step: 2, route, vehicles: [vehicle], vehicle }))
    render(<TransportSurface auth={{}} onBack={jest.fn()} />)
    expect(screen.getByRole('article')).toHaveClass('is-selected')
    expect(screen.getByRole('button', { name: /Selected/ })).toHaveAttribute('aria-pressed', 'true')
  })

  test('explains blocked actions and associates contact errors with their fields', () => {
    useTransportBooking.mockReturnValue(state({ step: 3, route, vehicle }))
    render(<TransportSurface auth={{}} onBack={jest.fn()} />)

    expect(screen.getByRole('button', { name: /Review booking/ })).toHaveAccessibleDescription('Complete all required contact fields to continue.')
    fireEvent.blur(screen.getByRole('textbox', { name: 'Email address' }))
    expect(screen.getByRole('textbox', { name: /Email address/ })).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Enter your email address.')).toBeInTheDocument()
  })

  test('reviews fare components, comments, and payment before confirmation', () => {
    useTransportBooking.mockReturnValue(state({ step: 4, route, vehicle, luggage: 1,
      ride: { date: '2030-02-03', time: '12:00', passengers: 2 }, comments: 'Bring binoculars',
      contact: { firstName: 'Ana', lastName: 'Mora', email: 'ana@example.com', phone: '+50688888888' } }))
    render(<TransportSurface auth={{}} onBack={jest.fn()} />)
    expect(screen.getByText(/distance charge USD 505.75/i)).toBeInTheDocument()
    expect(screen.getByText(/Comments: Bring binoculars/)).toBeInTheDocument()
    expect(screen.getByText(/Payment: Pay on arrival/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm booking' })).toBeEnabled()
  })
})
