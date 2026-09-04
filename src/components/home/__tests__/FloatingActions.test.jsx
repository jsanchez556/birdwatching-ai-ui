import { render, screen } from '@testing-library/react'
import { getSiteConfig } from '../../../config/site'
import { useResolvedMedia } from '../../../hooks/useResolvedMediaUrl'
import FloatingActions from '../FloatingActions'

jest.mock('../../../hooks/useResolvedMediaUrl', () => ({
  __esModule: true,
  useResolvedMedia: jest.fn(() => ({
    error: null,
    isResolving: false,
    url: 'https://cdn.example.test/resources/wtsapp.png',
  })),
}))

describe('FloatingActions', () => {
  test('renders nothing and does not resolve an icon without WhatsApp configuration', () => {
    const { container } = render(<FloatingActions siteConfig={getSiteConfig({})} />)

    expect(container).toBeEmptyDOMElement()
    expect(useResolvedMedia).not.toHaveBeenCalled()
  })

  test('renders a safely configured WhatsApp action', () => {
    render(<FloatingActions siteConfig={getSiteConfig({ VITE_WHATSAPP_NUMBER: '+506 8888-9999' })} />)

    expect(screen.getByRole('link', { name: 'Contact us on WhatsApp' })).toHaveAttribute(
      'href',
      'https://wa.me/50688889999',
    )
    expect(screen.getByRole('link', { name: 'Contact us on WhatsApp' })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    )
    expect(useResolvedMedia).toHaveBeenCalledWith('resources/wtsapp.png')
  })
})
