import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import useResolvedMediaUrl from '../../../hooks/useResolvedMediaUrl'
import HomeHeader from '../HomeHeader'

jest.mock('../../../hooks/useResolvedMediaUrl', () => ({
  __esModule: true,
  default: jest.fn(),
  useResolvedMedia: jest.fn(() => ({ error: null, isResolving: false, url: '' })),
}))

describe('HomeHeader cart and My Tours actions', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
    useResolvedMediaUrl.mockReturnValue('https://cdn.example.test/resources/logo.png')
  })

  test('renders the CloudFront-backed logo and keeps the subscription CTA functional', () => {
    const onAuthAction = jest.fn()

    const { container } = render(
      <HomeHeader isAuthenticated={false} onAuthAction={onAuthAction} />,
    )

    expect(screen.getByRole('banner')).not.toHaveClass('is-scrolled')
    expect(screen.getByRole('link', { name: /rcn home/i })).toBeInTheDocument()
    expect(useResolvedMediaUrl).toHaveBeenCalledWith('resources/logo.png')
    expect(container.querySelector('.home-header-logo')).toHaveAttribute(
      'src',
      'https://cdn.example.test/resources/logo.png',
    )
    expect(screen.getByRole('link', { name: /^home$/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /explore tours/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /our services/i })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('link', { name: /^tours$/i })).toHaveAttribute('href', '#featured-tours')
    expect(screen.getByRole('link', { name: /transportation/i })).toHaveAttribute('href', '#transport')
    expect(screen.getByRole('button', { name: /identify species/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /about us/i })).toHaveAttribute('href', '#about-us')
    expect(screen.queryByRole('link', { name: /contact us/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /english/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /premium experience/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /book now/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /subscribe/i }))
    expect(onAuthAction).toHaveBeenCalledTimes(1)
  })

  test('uses configured WhatsApp contact and never exposes a placeholder URL', () => {
    render(
      <HomeHeader
        siteConfig={{ whatsapp: { href: 'https://wa.me/50688889999' }, phone: null, email: null }}
      />,
    )

    const contact = screen.getByRole('link', { name: /contact us/i })
    expect(contact).toHaveAttribute('href', 'https://wa.me/50688889999')
    expect(contact).toHaveAttribute('target', '_blank')
    expect(contact).toHaveAttribute('rel', 'noopener noreferrer')
    expect(contact).not.toHaveAttribute('href', expect.stringContaining('00000000000'))
  })

  test('points configured non-WhatsApp contact methods to the footer', () => {
    render(
      <HomeHeader
        siteConfig={{ whatsapp: null, phone: null, email: { href: 'mailto:hello@example.test' } }}
      />,
    )

    expect(screen.getByRole('link', { name: /contact us/i })).toHaveAttribute(
      'href',
      '#site-footer-contact',
    )
  })

  test('starts the existing upgrade flow from Subscribe for authenticated users', () => {
    const onUpgradePlan = jest.fn()

    render(
      <HomeHeader
        isAuthenticated
        onUpgradePlan={onUpgradePlan}
        user={{ email: 'ana@example.com', plan: 'FREE', role: 'customer' }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /subscribe/i }))
    expect(onUpgradePlan).toHaveBeenCalledTimes(1)
  })

  test('uses a stable hysteresis boundary for the first downward scroll', async () => {
    const featuredTours = document.createElement('section')
    featuredTours.id = 'featured-tours'
    Object.defineProperty(featuredTours, 'offsetTop', { configurable: true, value: 500 })
    document.body.appendChild(featuredTours)

    render(<HomeHeader />)
    const header = screen.getByRole('banner')

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 40 })
    fireEvent.scroll(window)
    await waitFor(() => expect(header).toHaveClass('is-scrolled'))

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 16 })
    fireEvent.scroll(window)
    await waitFor(() => expect(header).toHaveClass('is-scrolled'))
    expect(screen.getByRole('link', { name: /^home$/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /english/i })).toBeInTheDocument()

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
    fireEvent.scroll(window)
    await waitFor(() => expect(header).not.toHaveClass('is-scrolled'))

    featuredTours.remove()
  })

  test('exposes a keyboard-accessible responsive navigation toggle', () => {
    render(<HomeHeader />)

    const toggle = screen.getByRole('button', { name: /open navigation menu/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveAttribute(
      'aria-controls',
      'home-primary-navigation home-header-controls',
    )
    expect(screen.getByRole('navigation', { name: /primary/i })).not.toHaveClass('is-open')
    expect(document.getElementById('home-header-controls')).not.toHaveClass('is-open')

    fireEvent.click(toggle)

    expect(screen.getByRole('button', { name: /close navigation menu/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(screen.getByRole('navigation', { name: /primary/i })).toHaveClass('is-open')
    expect(document.getElementById('home-header-controls')).toHaveClass('is-open')
  })

  test('opens the services submenu by click and closes it after a selection', () => {
    render(<HomeHeader />)

    const services = screen.getByRole('button', { name: /our services/i })
    expect(services).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(services)
    expect(services).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById('home-services-submenu')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: /^tours$/i }))
    expect(services).toHaveAttribute('aria-expanded', 'false')
  })

  test('opens the services submenu on hover', () => {
    render(<HomeHeader />)

    const services = screen.getByRole('button', { name: /our services/i })
    const menu = services.closest('.home-services-menu')

    fireEvent.mouseEnter(menu)
    expect(services).toHaveAttribute('aria-expanded', 'true')

    fireEvent.mouseLeave(menu)
    expect(services).toHaveAttribute('aria-expanded', 'false')
  })

  test('hides account-only controls while retaining the identification service entry', () => {
    render(<HomeHeader isAuthenticated={false} />)

    expect(screen.queryByRole('button', { name: /open tour cart/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /my tours/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /identify species/i })).toBeInTheDocument()
  })

  test('shows authenticated cart count, bird identification, and My Tours actions', async () => {
    const onOpenBirdIdentification = jest.fn()
    const onOpenCart = jest.fn()
    const onOpenMyTours = jest.fn()
    const onOpenBookings = jest.fn()
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
        onOpenBookings={onOpenBookings}
        onUpdateProfile={onUpdateProfile}
        onUpdateProfileImage={onUpdateProfileImage}
        onUpgradePlan={onUpgradePlan}
        user={{
          email: 'ana@example.com',
          name: 'Ana Gomez',
          plan: 'FREE',
          role: 'tour guide',
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /identify species/i }))
    fireEvent.click(screen.getByRole('button', { name: /open tour cart, 2 selected tours/i }))
    expect(screen.queryByRole('button', { name: /^my tours$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /my bookings/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /manage account for ana gomez, ana@example.com/i }))

    expect(onOpenBirdIdentification).toHaveBeenCalledTimes(1)
    expect(onOpenCart).toHaveBeenCalledTimes(1)
    const accountDialog = screen.getByRole('dialog', { name: /manage account/i })

    expect(accountDialog).toBeInTheDocument()
    expect(within(accountDialog).getByText('Ana Gomez')).toBeInTheDocument()
    expect(within(accountDialog).getByText('ana@example.com')).toBeInTheDocument()
    expect(within(accountDialog).getAllByText('FREE').length).toBeGreaterThan(0)
    expect(within(accountDialog).getByText('20 chats/day')).toBeInTheDocument()
    expect(within(accountDialog).getByText('100 bird identifications/day')).toBeInTheDocument()
    expect(within(accountDialog).getByRole('button', { name: /^my tours$/i })).toBeInTheDocument()
    expect(within(accountDialog).getByRole('button', { name: /my bookings/i })).toBeInTheDocument()
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
    fireEvent.click(within(accountDialog).getByRole('button', { name: /^my tours$/i }))

    expect(onUpgradePlan).toHaveBeenCalledTimes(1)
    expect(onOpenMyTours).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog', { name: /manage account/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /manage account for ana gomez, ana@example.com/i }))
    fireEvent.click(screen.getByRole('button', { name: /logout/i }))

    expect(onAuthAction).toHaveBeenCalledTimes(1)

    inputClick.mockRestore()
  })

  test('hides tour management from customers while retaining booking history', () => {
    const onOpenBookings = jest.fn()
    render(<HomeHeader isAuthenticated onOpenBookings={onOpenBookings} user={{ email: 'c@example.com', role: 'customer' }} />)

    expect(screen.queryByRole('button', { name: /^my tours$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /my bookings/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /manage account/i }))
    const accountDialog = screen.getByRole('dialog', { name: /manage account/i })

    expect(within(accountDialog).queryByRole('button', { name: /^my tours$/i })).not.toBeInTheDocument()
    fireEvent.click(within(accountDialog).getByRole('button', { name: /my bookings/i }))

    expect(onOpenBookings).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog', { name: /manage account/i })).not.toBeInTheDocument()
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
    expect(screen.queryByRole('button', { name: /downgrade to free/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /manage billing/i }))

    expect(onManageBilling).toHaveBeenCalledTimes(1)
  })

  test('shows the admin dashboard action only to administrators', () => {
    const onOpenAdmin = jest.fn()
    const { rerender } = render(
      <HomeHeader
        isAuthenticated
        onOpenAdmin={onOpenAdmin}
        user={{
          email: 'admin@example.com',
          name: 'Operations Admin',
          plan: 'PRO',
          role: 'admin',
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', {
      name: /manage account for operations admin, admin@example.com/i,
    }))
    fireEvent.click(screen.getByRole('button', { name: /admin dashboard/i }))

    expect(onOpenAdmin).toHaveBeenCalledTimes(1)

    rerender(
      <HomeHeader
        isAuthenticated
        onOpenAdmin={onOpenAdmin}
        user={{
          email: 'customer@example.com',
          name: 'Customer',
          plan: 'PRO',
          role: 'customer',
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', {
      name: /manage account for customer, customer@example.com/i,
    }))

    expect(screen.queryByRole('button', { name: /admin dashboard/i })).not.toBeInTheDocument()
  })
})
