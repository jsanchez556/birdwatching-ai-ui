import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import CustomerContextForm from '../CustomerContextForm'

describe('CustomerContextForm', () => {
  test('prefills customer context from authenticated user', () => {
    render(
      <CustomerContextForm
        onSubmit={jest.fn()}
        authUser={{
          name: 'Ana Gomez',
          email: 'ana@example.com',
        }}
      />
    )

    expect(screen.getByLabelText(/name/i)).toHaveValue('Ana Gomez')
    expect(screen.getByLabelText(/email/i)).toHaveValue('ana@example.com')
    expect(screen.getByLabelText(/email/i)).toHaveAttribute('readOnly')
  })

  test('submits authenticated email instead of editable customer email', () => {
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

  test('allows name entry when auth profile has no name', () => {
    const onSubmit = jest.fn()

    render(
      <CustomerContextForm
        onSubmit={onSubmit}
        authUser={{
          email: 'ana@example.com',
        }}
      />
    )

    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'Booking Name' },
    })
    fireEvent.click(screen.getByRole('button', { name: /start chat/i }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      customerName: 'Booking Name',
      customerEmail: 'ana@example.com',
    }))
  })
})
