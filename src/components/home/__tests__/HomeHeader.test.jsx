import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import HomeHeader from '../HomeHeader'

describe('HomeHeader cart and My Tours actions', () => {
  test('hides cart and My Tours actions for logged-out users', () => {
    render(<HomeHeader isAuthenticated={false} />)

    expect(screen.queryByRole('button', { name: /open tour cart/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /my tours/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /identify bird/i })).not.toBeInTheDocument()
  })

  test('shows authenticated cart count, bird identification, and My Tours actions', async () => {
    const onOpenBirdIdentification = jest.fn()
    const onOpenCart = jest.fn()
    const onOpenMyTours = jest.fn()
    const onAuthAction = jest.fn()
    const onUpgradePlan = jest.fn()
    const onUpdateProfile = jest.fn().mockResolvedValue({
      user: {
        email: 'ana@example.com',
        name: 'Ana Maria',
        imageUrl: '/files/user-profile-images/user-1.png',
      },
    })
    const onUpdateProfileImage = jest.fn().mockResolvedValue({
      user: {
        email: 'ana@example.com',
        name: 'Ana Gomez',
        imageUrl: '/files/user-profile-images/user-1.png',
      },
    })
    const inputClick = jest.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})

    const { container } = render(
      <HomeHeader
        cartCount={2}
        isAuthenticated
        onAuthAction={onAuthAction}
        onOpenBirdIdentification={onOpenBirdIdentification}
        onOpenCart={onOpenCart}
        onOpenMyTours={onOpenMyTours}
        onUpdateProfile={onUpdateProfile}
        onUpdateProfileImage={onUpdateProfileImage}
        onUpgradePlan={onUpgradePlan}
        user={{
          email: 'ana@example.com',
          name: 'Ana Gomez',
          plan: 'FREE',
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /identify bird/i }))
    fireEvent.click(screen.getByRole('button', { name: /open tour cart, 2 selected tours/i }))
    fireEvent.click(screen.getByRole('button', { name: /my tours/i }))
    fireEvent.click(screen.getByRole('button', { name: /manage account for ana gomez, ana@example.com/i }))

    expect(onOpenBirdIdentification).toHaveBeenCalledTimes(1)
    expect(onOpenCart).toHaveBeenCalledTimes(1)
    expect(onOpenMyTours).toHaveBeenCalledTimes(1)
    const accountDialog = screen.getByRole('dialog', { name: /manage account/i })

    expect(accountDialog).toBeInTheDocument()
    expect(within(accountDialog).getByText('Ana Gomez')).toBeInTheDocument()
    expect(within(accountDialog).getByText('ana@example.com')).toBeInTheDocument()
    expect(within(accountDialog).getAllByText('FREE').length).toBeGreaterThan(0)
    expect(within(accountDialog).getByText('20 chats/day')).toBeInTheDocument()
    expect(within(accountDialog).getByText('100 bird identifications/day')).toBeInTheDocument()
    expect(within(accountDialog).queryByRole('button', { name: /account settings/i })).not.toBeInTheDocument()

    fireEvent.click(within(accountDialog).getByRole('button', { name: /choose profile image/i }))
    expect(inputClick).toHaveBeenCalledTimes(1)

    const nameInput = screen.getByLabelText(/display name/i)
    fireEvent.change(nameInput, { target: { value: 'Ana Maria' } })
    fireEvent.click(within(accountDialog).getByRole('button', { name: /save profile/i }))

    await waitFor(() => {
      expect(onUpdateProfile).toHaveBeenCalledWith({ name: 'Ana Maria' })
    })

    const fileInput = container.querySelector('input[type="file"]')
    const imageFile = new File(['profile'], 'profile.png', { type: 'image/png' })
    fireEvent.change(fileInput, { target: { files: [imageFile] } })

    await waitFor(() => {
      expect(onUpdateProfileImage).toHaveBeenCalledWith({ file: imageFile })
    })

    fireEvent.click(within(accountDialog).getByRole('button', { name: /upgrade to pro/i }))
    fireEvent.click(within(accountDialog).getByRole('button', { name: /logout/i }))

    expect(onUpgradePlan).toHaveBeenCalledTimes(1)
    expect(onAuthAction).toHaveBeenCalledTimes(1)

    inputClick.mockRestore()
  })

  test('shows a friendly error for invalid profile image types', async () => {
    const { container } = render(
      <HomeHeader
        isAuthenticated
        user={{
          email: 'ana@example.com',
          name: 'Ana Gomez',
          plan: 'FREE',
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /manage account for ana gomez, ana@example.com/i }))

    const fileInput = container.querySelector('input[type="file"]')
    const textFile = new File(['not image'], 'notes.txt', { type: 'text/plain' })
    fireEvent.change(fileInput, { target: { files: [textFile] } })

    expect(await screen.findByText(/choose a jpeg, png, or webp image/i)).toBeInTheDocument()
  })

  test('hides upgrade action for PRO users', () => {
    const onManageBilling = jest.fn()

    render(
      <HomeHeader
        isAuthenticated
        onManageBilling={onManageBilling}
        user={{
          email: 'ana@example.com',
          name: 'Ana Gomez',
          plan: 'PRO',
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /manage account for ana gomez, ana@example.com/i }))

    expect(screen.getByText('Current plan')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /upgrade to pro/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /manage billing/i }))

    expect(onManageBilling).toHaveBeenCalledTimes(1)
  })
})
