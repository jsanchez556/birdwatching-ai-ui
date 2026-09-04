import { getSiteConfig } from '../../config/site'
import useResolvedMediaUrl from '../../hooks/useResolvedMediaUrl'

const HOME_LOGO_MEDIA_KEY = 'resources/logo.png'

const EXPLORE_LINKS = [
  { href: '#home', label: 'Home' },
  { href: '#featured-tours', label: 'Featured Tours' },
  { href: '#bird-highlights', label: 'Bird Highlights' },
  { href: '#transport', label: 'Transportation' },
  { href: '#about-us', label: 'About Us' },
]

function ExternalLink({ children, href }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )
}

function SocialIcon({ name }) {
  const commonProps = {
    'aria-hidden': true,
    className: 'site-footer-social-icon',
    focusable: 'false',
    viewBox: '0 0 24 24',
  }

  if (name === 'Facebook') {
    return (
      <svg {...commonProps}>
        <path d="M13.7 22v-8h2.7l.4-3.1h-3.1v-2c0-.9.3-1.5 1.6-1.5H17V4.6c-.8-.1-1.6-.2-2.4-.2-2.4 0-4.1 1.5-4.1 4.2v2.3H7.8V14h2.7v8h3.2Z" />
      </svg>
    )
  }

  if (name === 'Instagram') {
    return (
      <svg {...commonProps}>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4.1" />
        <circle className="site-footer-social-icon-fill" cx="17.4" cy="6.7" r="1.1" />
      </svg>
    )
  }

  if (name === 'TripAdvisor') {
    return (
      <svg {...commonProps}>
        <path d="M4.2 9.1C6.1 7.7 8.8 7 12 7s5.9.7 7.8 2.1" />
        <path d="m7.1 7.8-2-2.1M16.9 7.8l2-2.1" />
        <circle cx="7.4" cy="13" r="4" />
        <circle cx="16.6" cy="13" r="4" />
        <circle className="site-footer-social-icon-fill" cx="7.4" cy="13" r="1.4" />
        <circle className="site-footer-social-icon-fill" cx="16.6" cy="13" r="1.4" />
        <path d="m10.8 16.3 1.2 1.8 1.2-1.8" />
      </svg>
    )
  }

  if (name === 'Google Reviews') {
    return (
      <svg {...commonProps}>
        <path d="M12 2.8 14.7 8l5.8.8-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8-4.2-4.1L9.3 8 12 2.8Z" />
      </svg>
    )
  }

  return (
    <svg {...commonProps}>
      <rect x="2.5" y="5" width="19" height="14" rx="4" />
      <path className="site-footer-social-icon-fill" d="m10 9 5 3-5 3V9Z" />
    </svg>
  )
}

function SiteFooter({ siteConfig = getSiteConfig() }) {
  const logoUrl = useResolvedMediaUrl(HOME_LOGO_MEDIA_KEY)
  const currentYear = new Date().getFullYear()

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-grid">
          <section className="site-footer-brand" aria-labelledby="footer-brand-title">
            <a className="site-footer-logo-link" href="#home" aria-label={`${siteConfig.companyName} home`}>
              {logoUrl && <img className="site-footer-logo" src={logoUrl} alt="" />}
            </a>
            <h2 id="footer-brand-title" className="sr-only">{siteConfig.companyName}</h2>
            <p>
              Small-group birdwatching, nature walks, national parks, and trip
              planning across Costa Rica.
            </p>
          </section>

          <nav className="site-footer-section" aria-label="Explore">
            <h2>Explore</h2>
            <ul>
              {EXPLORE_LINKS.map((link) => (
                <li key={link.href}><a href={link.href}>{link.label}</a></li>
              ))}
            </ul>
          </nav>

          <section
            id="site-footer-contact"
            className="site-footer-section"
            aria-labelledby="site-footer-contact-title"
          >
            <h2 id="site-footer-contact-title">Contact</h2>
            <address>
              <ul>
                {siteConfig.whatsapp && (
                  <li>
                    <span>WhatsApp</span>
                    <ExternalLink href={siteConfig.whatsapp.href}>{siteConfig.whatsapp.display}</ExternalLink>
                  </li>
                )}
                {siteConfig.phone && (
                  <li>
                    <span>Phone</span>
                    <a href={siteConfig.phone.href}>{siteConfig.phone.display}</a>
                  </li>
                )}
                {siteConfig.email && (
                  <li>
                    <span>Email</span>
                    <a href={siteConfig.email.href}>{siteConfig.email.display}</a>
                  </li>
                )}
                {siteConfig.businessHours && (
                  <li><span>Hours</span><p>{siteConfig.businessHours}</p></li>
                )}
                {siteConfig.location && (
                  <li><span>Location</span><p>{siteConfig.location}</p></li>
                )}
              </ul>
            </address>
          </section>

          {siteConfig.socialLinks.length > 0 && (
            <nav className="site-footer-section" aria-label="Connect">
              <h2>Connect</h2>
              <ul className="site-footer-social-list">
                {siteConfig.socialLinks.map((link) => (
                  <li key={link.label}>
                    <a
                      className="site-footer-social-link"
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={link.label}
                      title={link.label}
                    >
                      <SocialIcon name={link.label} />
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>

        <div className="site-footer-bottom">
          <p>© {currentYear} {siteConfig.companyName}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}

export default SiteFooter
