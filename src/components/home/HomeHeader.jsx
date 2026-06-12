import { useEffect, useState } from 'react'

const brandMark =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 80 80%22%3E%3Crect width=%2280%22 height=%2280%22 rx=%2216%22 fill=%22%2328734d%22/%3E%3Cpath d=%22M18 50c14-24 30-30 48-22-15 4-25 14-30 30-5-5-11-7-18-8Z%22 fill=%22%23fff%22/%3E%3Ccircle cx=%2256%22 cy=%2228%22 r=%224%22 fill=%22%23f2c84b%22/%3E%3C/svg%3E'

const partnerMark =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 80 80%22%3E%3Crect width=%2280%22 height=%2280%22 rx=%2216%22 fill=%22%23f6f7f4%22/%3E%3Cpath d=%22M18 24h44v7H18zm0 14h34v7H18zm0 14h26v7H18z%22 fill=%22%2318201b%22/%3E%3Cpath d=%22M55 43l10 5-10 5z%22 fill=%22%23b3161c%22/%3E%3C/svg%3E'

const COLLAPSE_SCROLL_Y = 96
const EXPAND_SCROLL_Y = 24

function HomeHeader({
  authActionLabel = 'Login',
  cartCount = 0,
  isAuthenticated = false,
  onAuthAction,
  onOpenCart,
  onOpenBirdIdentification,
  onOpenMyTours,
}) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [activeItem, setActiveItem] = useState('home')

  useEffect(() => {
    const updateHeaderState = () => {
      const scrollY = window.scrollY || window.pageYOffset
      const featuredTours = document.getElementById('featured-tours')
      const exploreTop = featuredTours ? featuredTours.offsetTop - 120 : Number.POSITIVE_INFINITY

      setIsCollapsed((wasCollapsed) => {
        if (wasCollapsed) {
          return scrollY > EXPAND_SCROLL_Y
        }

        return scrollY > COLLAPSE_SCROLL_Y
      })
      setActiveItem(scrollY > COLLAPSE_SCROLL_Y && scrollY >= exploreTop ? 'explore' : 'home')
    }

    updateHeaderState()
    window.addEventListener('scroll', updateHeaderState, { passive: true })

    return () => {
      window.removeEventListener('scroll', updateHeaderState)
    }
  }, [])

  const closeMenu = () => {
    setIsMenuOpen(false)
  }

  const handleAuthAction = () => {
    closeMenu()
    onAuthAction?.()
  }

  const handleCartAction = () => {
    closeMenu()
    onOpenCart?.()
  }

  const handleMyToursAction = () => {
    closeMenu()
    onOpenMyTours?.()
  }

  const handleBirdIdentificationAction = () => {
    closeMenu()
    onOpenBirdIdentification?.()
  }

  const handleExploreClick = () => {
    setActiveItem('explore')
    closeMenu()
  }

  const handleHomeClick = () => {
    setActiveItem('home')
    closeMenu()
  }

  const navClassName = isMenuOpen ? 'home-header-nav is-open' : 'home-header-nav'

  return (
    <header className={isCollapsed ? 'home-header is-collapsed' : 'home-header'}>
      <div className="home-header-inner">
        <a
          className="home-header-brand"
          href="#home"
          aria-label="Birdwatching AI home"
          onClick={handleHomeClick}
        >
          <span className="home-brand-images" aria-hidden="true">
            <img src={brandMark} alt="" />
            {!isCollapsed && <img src={partnerMark} alt="" />}
          </span>
          <span className="home-brand-copy">
            <span className="home-brand-primary">Birdwatching AI</span>
            <span className="home-brand-secondary">Costa Rica Tours</span>
          </span>
        </a>

        {!isCollapsed && (
          <nav className="home-header-utility" aria-label="Task-oriented">
            <ul className="home-utility-list">
              <li>
                <a className="home-contact-link" href="https://wa.me/00000000000">
                  Contact Us
                </a>
              </li>
            </ul>
            <ul className="home-utility-list home-language-list" role="menubar">
              <li className="home-language-item" role="none">
                <a
                  className="home-language-link"
                  href="#language-switcher"
                  role="menuitem"
                  aria-haspopup="true"
                  aria-label="English"
                >
                  English
                </a>
                <ul className="home-language-submenu" role="menubar">
                  <li role="none">
                    <a
                      className="home-language-link"
                      href="#"
                      hrefLang="es-ES"
                      lang="es-ES"
                      role="menuitem"
                    >
                      Espa&ntilde;ol
                    </a>
                  </li>
                </ul>
              </li>
            </ul>
          </nav>
        )}

        <button
          type="button"
          className="home-menu-toggle"
          aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={isMenuOpen}
          aria-controls="home-primary-navigation"
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>

        <nav id="home-primary-navigation" className={navClassName} aria-label="Primary">
          {!isCollapsed && (
            <a
              className={activeItem === 'home' ? 'home-header-link is-active' : 'home-header-link'}
              href="#home"
              aria-current={activeItem === 'home' ? 'page' : undefined}
              onClick={handleHomeClick}
            >
              Home
            </a>
          )}
          <button type="button" className="home-header-link" onClick={handleAuthAction}>
            {authActionLabel}
          </button>
          <a
            className={activeItem === 'explore' ? 'home-header-link is-active' : 'home-header-link'}
            href="#featured-tours"
            aria-current={activeItem === 'explore' ? 'page' : undefined}
            onClick={handleExploreClick}
          >
            Explore Tours
          </a>
          {isAuthenticated && (
            <>
              <button type="button" className="home-header-link" onClick={handleBirdIdentificationAction}>
                Identify Bird
              </button>
              <button type="button" className="home-header-link" onClick={handleMyToursAction}>
                My Tours
              </button>
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
            </>
          )}
        </nav>
      </div>
    </header>
  )
}

export default HomeHeader
