import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import HomeHeader from '../HomeHeader'

describe('HomeHeader cart and My Tours actions', () => {
  test('hides cart and My Tours actions for logged-out users', () => {
    render(<HomeHeader isAuthenticated={false} />)

    expect(screen.queryByRole('button', { name: /open tour cart/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /my tours/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /identify bird/i })).not.toBeInTheDocument()
  })

  test('shows authenticated cart count, bird identification, and My Tours actions', () => {
    const onOpenBirdIdentification = jest.fn()
    const onOpenCart = jest.fn()
    const onOpenMyTours = jest.fn()

    render(
      <HomeHeader
        cartCount={2}
        isAuthenticated
        onOpenBirdIdentification={onOpenBirdIdentification}
        onOpenCart={onOpenCart}
        onOpenMyTours={onOpenMyTours}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /identify bird/i }))
    fireEvent.click(screen.getByRole('button', { name: /open tour cart, 2 selected tours/i }))
    fireEvent.click(screen.getByRole('button', { name: /my tours/i }))

    expect(onOpenBirdIdentification).toHaveBeenCalledTimes(1)
    expect(onOpenCart).toHaveBeenCalledTimes(1)
    expect(onOpenMyTours).toHaveBeenCalledTimes(1)
  })
})
