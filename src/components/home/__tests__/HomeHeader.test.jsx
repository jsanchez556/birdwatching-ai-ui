import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import HomeHeader from '../HomeHeader'

describe('HomeHeader cart and My Tours actions', () => {
  test('hides cart and My Tours actions for logged-out users', () => {
    render(<HomeHeader isAuthenticated={false} />)

    expect(screen.queryByRole('button', { name: /open tour cart/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /my tours/i })).not.toBeInTheDocument()
  })

  test('shows authenticated cart count and My Tours actions', () => {
    const onOpenCart = jest.fn()
    const onOpenMyTours = jest.fn()

    render(
      <HomeHeader
        cartCount={2}
        isAuthenticated
        onOpenCart={onOpenCart}
        onOpenMyTours={onOpenMyTours}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /open tour cart, 2 selected tours/i }))
    fireEvent.click(screen.getByRole('button', { name: /my tours/i }))

    expect(onOpenCart).toHaveBeenCalledTimes(1)
    expect(onOpenMyTours).toHaveBeenCalledTimes(1)
  })
})
