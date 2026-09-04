import { render, screen, within } from '@testing-library/react'
import { getSiteConfig } from '../../../config/site'
import useResolvedMediaUrl from '../../../hooks/useResolvedMediaUrl'
import FooterCTA from '../FooterCTA'
import SiteFooter from '../SiteFooter'

jest.mock('../../../hooks/useResolvedMediaUrl', () => ({
  __esModule: true,
  default: jest.fn(),
}))

describe('SiteFooter', () => {
  beforeEach(() => {
    useResolvedMediaUrl.mockReturnValue('https://cdn.example.test/resources/logo.png')
  })

  test('renders the existing logo, supported anchors, safe defaults, and current year', () => {
    render(<SiteFooter siteConfig={getSiteConfig({})} />)

    const footer = screen.getByRole('contentinfo')
    const explore = within(footer).getByRole('navigation', { name: 'Explore' })

    expect(useResolvedMediaUrl).toHaveBeenCalledWith('resources/logo.png')
    expect(within(footer).getByRole('link', { name: 'RCN home' })).toContainElement(
      footer.querySelector('.site-footer-logo'),
    )
    expect(within(explore).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '#home')
    expect(within(explore).getByRole('link', { name: 'Featured Tours' })).toHaveAttribute('href', '#featured-tours')
    expect(within(explore).getByRole('link', { name: 'Bird Highlights' })).toHaveAttribute('href', '#bird-highlights')
    expect(within(explore).getByRole('link', { name: 'Transportation' })).toHaveAttribute('href', '#transport')
    expect(within(explore).getByRole('link', { name: 'About Us' })).toHaveAttribute('href', '#about-us')
    expect(within(footer).getByText(`© ${new Date().getFullYear()} RCN. All rights reserved.`)).toBeInTheDocument()
    expect(within(footer).getByText('Costa Rica')).toBeInTheDocument()
    expect(within(footer).queryByText('Phone')).not.toBeInTheDocument()
    expect(within(footer).queryByText('Email')).not.toBeInTheDocument()
    expect(within(footer).queryByText('WhatsApp')).not.toBeInTheDocument()
    expect(within(footer).queryByText('Hours')).not.toBeInTheDocument()
    expect(within(footer).queryByRole('navigation', { name: 'Connect' })).not.toBeInTheDocument()
  })

  test('renders configured contacts and only safe configured social links', () => {
    const siteConfig = getSiteConfig({
      VITE_COMPANY_NAME: 'RCN Tours',
      VITE_CONTACT_PHONE: '+506 2222-3333',
      VITE_CONTACT_EMAIL: 'hello@example.test',
      VITE_WHATSAPP_NUMBER: '+506 8888-9999',
      VITE_BUSINESS_HOURS: 'Daily, 6:00–18:00',
      VITE_INSTAGRAM_URL: 'https://instagram.com/rcn',
      VITE_FACEBOOK_URL: 'javascript:alert(1)',
    })

    render(<SiteFooter siteConfig={siteConfig} />)

    expect(screen.getByRole('link', { name: '+506 2222-3333' })).toHaveAttribute('href', 'tel:+50622223333')
    expect(screen.getByRole('link', { name: 'hello@example.test' })).toHaveAttribute('href', 'mailto:hello@example.test')
    expect(screen.getByRole('link', { name: '+506 8888-9999' })).toHaveAttribute('href', 'https://wa.me/50688889999')
    expect(screen.getByRole('link', { name: 'Instagram' })).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByRole('link', { name: 'Instagram' })).toHaveClass('site-footer-social-link')
    expect(screen.getByRole('link', { name: 'Instagram' }).querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByRole('link', { name: 'Instagram' })).not.toHaveTextContent('Instagram')
    expect(screen.queryByRole('link', { name: 'Facebook' })).not.toBeInTheDocument()
    expect(screen.getByText('Daily, 6:00–18:00')).toBeInTheDocument()
    expect(screen.getByText(`© ${new Date().getFullYear()} RCN Tours. All rights reserved.`)).toBeInTheDocument()
  })

  test('keeps the primary CTA and conditionally includes WhatsApp', () => {
    const { rerender } = render(<FooterCTA siteConfig={getSiteConfig({})} />)

    expect(screen.getByRole('link', { name: 'Explore Tours' })).toHaveAttribute('href', '#featured-tours')
    expect(screen.queryByRole('link', { name: 'WhatsApp Us' })).not.toBeInTheDocument()

    rerender(<FooterCTA siteConfig={getSiteConfig({ VITE_WHATSAPP_NUMBER: '50688889999' })} />)
    expect(screen.getByRole('link', { name: 'WhatsApp Us' })).toHaveAttribute('href', 'https://wa.me/50688889999')
  })
})
