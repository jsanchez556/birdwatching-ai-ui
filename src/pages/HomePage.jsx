import BirdHighlights from '../components/home/BirdHighlights'
import ChatbotCTA from '../components/home/ChatbotCTA'
import CookieConsent from '../components/home/CookieConsent'
import FeaturedTours from '../components/home/FeaturedTours'
import FloatingActions from '../components/home/FloatingActions'
import HomeHeader from '../components/home/HomeHeader'
import HeroSection from '../components/home/HeroSection'
import LoginCTA from '../components/home/LoginCTA'
import TransportationSection from '../components/home/TransportationSection'
import useHomeContent from '../hooks/useHomeContent'

function HomePage({
  addedTourIds = [],
  addingTourIds = [],
  authActionLabel,
  cartCount = 0,
  cartItemsByTourId = {},
  isCartEnabled = false,
  isAuthenticated = false,
  onAddTourToCart,
  onAuthAction,
  onOpenBirdIdentification,
  onOpenCart,
  onOpenMyTours,
  onLogin,
  onRemoveTourFromCart,
  removingTourIds = [],
  onReserveTour,
  reservingTourIds = [],
  onStartChat,
}) {
  const {
    tours,
    birds,
    transportation,
    hero,
    isLoading,
    error,
  } = useHomeContent()

  return (
    <main id="home" className="home-page">
      <HomeHeader
        authActionLabel={authActionLabel}
        cartCount={cartCount}
        isAuthenticated={isAuthenticated}
        onAuthAction={onAuthAction || onLogin}
        onOpenBirdIdentification={onOpenBirdIdentification}
        onOpenCart={onOpenCart}
        onOpenMyTours={onOpenMyTours}
        onStartChat={onStartChat}
      />
      <HeroSection
        heroVideo={hero?.heroVideo}
        onAuthAction={onAuthAction || onLogin}
        onStartChat={onStartChat}
        showLoginCta={!isAuthenticated}
      />
      <FeaturedTours
        addedTourIds={addedTourIds}
        addingTourIds={addingTourIds}
        cartItemsByTourId={cartItemsByTourId}
        isCartEnabled={isCartEnabled}
        removingTourIds={removingTourIds}
        reservingTourIds={reservingTourIds}
        tours={tours}
        isLoading={isLoading}
        error={error}
        onAddToCart={onAddTourToCart}
        onRemoveFromCart={onRemoveTourFromCart}
        onReserveTour={onReserveTour}
      />
      <BirdHighlights birds={birds} isLoading={isLoading} error={error} />
      <TransportationSection options={transportation} isLoading={isLoading} error={error} />
      <ChatbotCTA onStartChat={onStartChat} />
      {!isAuthenticated && <LoginCTA onLogin={onLogin} />}
      <FloatingActions onStartChat={onStartChat} />
      <CookieConsent />
    </main>
  )
}

export default HomePage
