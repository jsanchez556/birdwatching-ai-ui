import { useState } from 'react'
import { getSiteConfig } from '../../config/site'
import useHomeHeaderScroll from '../../hooks/useHomeHeaderScroll'
import useResolvedMediaUrl from '../../hooks/useResolvedMediaUrl'
import AccountMenu from './AccountMenu'

const HOME_LOGO_MEDIA_KEY = 'resources/logo.png'

function HomeHeader({
  authActionLabel = 'Login',
  birdIdentificationEnabled = true,
  birdIdentificationUnavailableMessage = '',
  billingError = null,
  cartCount = 0,
  isAuthenticated = false,
  isBillingLoading = false,
  onAuthAction,
  onOpenAdmin,
  onOpenCart,
  onOpenBirdIdentification,
  onOpenMyTours,
  onOpenBookings,
  onManageBilling,
  onUpdateProfile,
  onUpdateProfileImage,
  onUpgradePlan,
  siteConfig = getSiteConfig(),
  user,
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isServicesOpen, setIsServicesOpen] = useState(false)
  const { activeItem, isScrolled, setActiveItem } = useHomeHeaderScroll()
  const logoUrl = useResolvedMediaUrl(HOME_LOGO_MEDIA_KEY)
  const contactHref = siteConfig.whatsapp?.href
    || (siteConfig.phone || siteConfig.email ? '#site-footer-contact' : '')

  const closeMenu = () => {
    setIsMenuOpen(false)
    setIsServicesOpen(false)
  }

  const handleAuthAction = () => {
    closeMenu()
    onAuthAction?.()
  }

  const handleCartAction = () => {
    closeMenu()
    onOpenCart?.()
  }

  const handleAdminAction = () => {
    closeMenu()
    onOpenAdmin?.()
  }

  const handleManageBilling = () => {
    closeMenu()
    onManageBilling?.()
  }

  const handleBirdIdentificationAction = () => {
    closeMenu()
    onOpenBirdIdentification?.()
  }

  const handleUpgradePlan = () => {
    closeMenu()
    onUpgradePlan?.()
  }

  const handleSubscribeAction = () => {
    closeMenu()
    if (isAuthenticated) {
      onUpgradePlan?.()
      return
    }
    onAuthAction?.()
  }

  const handleExploreClick = () => {
    setActiveItem('explore')
    closeMenu()
  }

  const handleMenuToggle = () => {
    if (isMenuOpen) setIsServicesOpen(false)
    setIsMenuOpen((open) => !open)
  }

  const handleHomeClick = () => {
    setActiveItem('home')
    closeMenu()
  }

  const navClassName = isMenuOpen ? 'home-header-nav is-open' : 'home-header-nav'
  const controlsClassName = isMenuOpen
    ? 'home-header-controls is-open'
    : 'home-header-controls'

  return (
    <header className={isScrolled ? 'home-header is-scrolled' : 'home-header'}>
      <div className="home-header-inner">
        <a
          className="home-header-brand"
          href="#home"
          aria-label="RCN home"
          onClick={handleHomeClick}
        >
          <span className="home-header-logo-frame" aria-hidden="true">
            {logoUrl && <img className="home-header-logo" src={logoUrl} alt="" />}
          </span>
        </a>

        <button
          type="button"
          className="home-menu-toggle"
          aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={isMenuOpen}
          aria-controls="home-primary-navigation home-header-controls"
          onClick={handleMenuToggle}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>

        <nav id="home-primary-navigation" className={navClassName} aria-label="Primary">
          <a
            className={activeItem === 'home' ? 'home-header-link is-active' : 'home-header-link'}
            href="#home"
            aria-current={activeItem === 'home' ? 'page' : undefined}
            onClick={handleHomeClick}
          >
            Home
          </a>
          {!isAuthenticated && (
            <button type="button" className="home-header-link" onClick={handleAuthAction}>
              {authActionLabel}
            </button>
          )}
          <div
            className={isServicesOpen ? 'home-services-menu is-open' : 'home-services-menu'}
            onMouseEnter={() => setIsServicesOpen(true)}
            onMouseLeave={() => setIsServicesOpen(false)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setIsServicesOpen(false)
            }}
          >
            <button
              type="button"
              className={activeItem === 'explore'
                ? 'home-header-link home-header-services-trigger is-active'
                : 'home-header-link home-header-services-trigger'}
              aria-expanded={isServicesOpen}
              aria-controls="home-services-submenu"
              onClick={() => setIsServicesOpen((open) => !open)}
            >
              Our Services
              <span className="home-services-chevron" aria-hidden="true" />
            </button>
            <ul id="home-services-submenu" className="home-services-submenu">
              <li><a href="#featured-tours" onClick={handleExploreClick}>Tours</a></li>
              <li><a href="#transport" onClick={closeMenu}>Transportation</a></li>
              <li>
                <button
                  type="button"
                  onClick={handleBirdIdentificationAction}
                  disabled={!birdIdentificationEnabled}
                  title={birdIdentificationUnavailableMessage || undefined}
                >
                  Identify Species
                </button>
              </li>
            </ul>
          </div>
          <a className="home-header-link" href="#about-us" onClick={closeMenu}>
            About Us
          </a>
          {contactHref && (
            <a
              className="home-header-link"
              href={contactHref}
              onClick={closeMenu}
              {...(siteConfig.whatsapp ? {
                target: '_blank',
                rel: 'noopener noreferrer',
              } : {})}
            >
              Contact Us
            </a>
          )}
          <span className="home-header-cta-group">
            <button
              type="button"
              className="home-header-cta home-header-subscribe"
              onClick={handleSubscribeAction}
            >
              Subscribe
            </button>
          </span>
        </nav>

        <div id="home-header-controls" className={controlsClassName}>
          <div className="home-language-list">
            <a
              className="home-language-link"
              href="#language-switcher"
              aria-haspopup="true"
              aria-label="English"
            >
              <span aria-hidden="true">🇬🇧</span> English
            </a>
            <div className="home-language-submenu">
              <a className="home-language-link" href="#" hrefLang="es-ES" lang="es-ES">
                Espa&ntilde;ol
              </a>
            </div>
          </div>
          {isAuthenticated && (
            <>
              <button
                type="button"
                className="home-header-link home-header-icon-link"
                aria-label={`Open tour cart, ${cartCount} selected tour${cartCount === 1 ? '' : 's'}`}
                onClick={handleCartAction}
              >
                <span className="home-header-bird-cart" aria-hidden="true">
                  <span />
                </span>
                <span className="home-header-cart-count">{cartCount}</span>
              </button>
              <AccountMenu
                billingError={billingError}
                isBillingLoading={isBillingLoading}
                onLogout={handleAuthAction}
                onManageBilling={handleManageBilling}
                onOpenAdmin={handleAdminAction}
                onOpenBookings={onOpenBookings}
                onOpenMyTours={onOpenMyTours}
                onUpdateProfile={onUpdateProfile}
                onUpdateProfileImage={onUpdateProfileImage}
                onUpgradePlan={handleUpgradePlan}
                user={user}
              />
            </>
          )}
        </div>
      </div>
      {billingError && !isAuthenticated && (
        <div className="home-header-alert" role="status">
          {billingError}
        </div>
      )}
      {isAuthenticated && !birdIdentificationEnabled && birdIdentificationUnavailableMessage && (
        <div className="home-header-alert" role="status">
          {birdIdentificationUnavailableMessage}
        </div>
      )}
    </header>
  )
}

export default HomeHeader
