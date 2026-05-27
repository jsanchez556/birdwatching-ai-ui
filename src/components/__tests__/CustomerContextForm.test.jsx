import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import CustomerContextForm from '../CustomerContextForm'

describe('CustomerContextForm', () => {
  test('displays authenticated contact details without editable fields by default', () => {
    render(
      <CustomerContextForm
        onSubmit={jest.fn()}
        authUser={{
          name: 'Ana Gomez',
          email: 'ana@example.com',
        }}
      />
    )

    expect(screen.getByText(/Ana Gomez - ana@example.com\./i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /edit\.\.\./i })).toBeInTheDocument()
    expect(screen.queryByLabelText(/^name$/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^email$/i)).not.toBeInTheDocument()
    expect(screen.getByText(/itinerary dates from/i)).toBeInTheDocument()
  })

  test('reveals prefilled reservation contact fields from the link-style action', () => {
    render(
      <CustomerContextForm
        onSubmit={jest.fn()}
        authUser={{
          name: 'Ana Gomez',
          email: 'ana@example.com',
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /edit\.\.\./i }))

    expect(screen.getByLabelText(/^name$/i)).toHaveValue('Ana Gomez')
    expect(screen.getByLabelText(/^email$/i)).toHaveValue('ana@example.com')
  })

  test('exits contact editing from the done action', () => {
    render(
      <CustomerContextForm
        onSubmit={jest.fn()}
        authUser={{
          name: 'Ana Gomez',
          email: 'ana@example.com',
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /edit\.\.\./i }))
    fireEvent.click(screen.getByRole('button', { name: /done/i }))

    expect(screen.queryByLabelText(/^name$/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /edit\.\.\./i })).toBeInTheDocument()
  })

  test('renders itinerary dates as a compact summary with date buttons', () => {
    render(
      <CustomerContextForm
        onSubmit={jest.fn()}
        authUser={{
          name: 'Ana Gomez',
          email: 'ana@example.com',
        }}
        initialValues={{
          itineraryStartDate: '2026-06-20',
          itineraryEndDate: '2026-06-22',
        }}
      />
    )

    expect(screen.getByText(/itinerary dates from/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '20/06/2026' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '22/06/2026' })).toBeInTheDocument()
  })

  test('focuses the native date input when a date button is clicked', () => {
    render(
      <CustomerContextForm
        onSubmit={jest.fn()}
        authUser={{
          name: 'Ana Gomez',
          email: 'ana@example.com',
        }}
        initialValues={{
          itineraryStartDate: '2026-06-20',
          itineraryEndDate: '2026-06-22',
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '20/06/2026' }))
    expect(screen.getByLabelText(/start date/i)).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: '22/06/2026' }))
    expect(screen.getByLabelText(/end date/i)).toHaveFocus()
  })

  test('submits authenticated contact details when no override is made', () => {
    const onSubmit = jest.fn()

    render(
      <CustomerContextForm
        onSubmit={onSubmit}
        authUser={{
          name: 'Ana Gomez',
          email: 'ana@example.com',
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /start chat/i }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      customerName: 'Ana Gomez',
      customerEmail: 'ana@example.com',
      itineraryStartDate: expect.any(String),
      itineraryEndDate: expect.any(String),
    }))
  })

  test('blocks submission when reservation contact details are missing', () => {
    const onSubmit = jest.fn()

    render(
      <CustomerContextForm
        onSubmit={onSubmit}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /start chat/i }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(/enter a name for this reservation/i)).toBeInTheDocument()
    expect(screen.getByText(/enter an email for this reservation/i)).toBeInTheDocument()
  })

  test('blocks submission when reservation email is invalid', () => {
    const onSubmit = jest.fn()

    render(
      <CustomerContextForm
        onSubmit={onSubmit}
        authUser={{
          name: 'Ana Gomez',
          email: 'ana@example.com',
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /edit\.\.\./i }))
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: 'not-an-email' },
    })
    fireEvent.click(screen.getByRole('button', { name: /start chat/i }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(/enter a valid email address/i)).toBeInTheDocument()
  })

  test('submits modified reservation-only contact details', () => {
    const onSubmit = jest.fn()

    render(
      <CustomerContextForm
        onSubmit={onSubmit}
        authUser={{
          name: 'Ana Gomez',
          email: 'ana@example.com',
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /edit\.\.\./i }))
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'Booking Name' },
    })
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'booking@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /start chat/i }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      customerName: 'Booking Name',
      customerEmail: 'booking@example.com',
    }))
  })
})
