import BirdHighlights from '../components/home/BirdHighlights'
import BillingReturnNotice from '../components/home/BillingReturnNotice'
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
  agentBookingEnabled = true,
  addedTourIds = [],
  addingTourIds = [],
  authActionLabel,
  cartCount = 0,
  cartItemsByTourId = {},
  billingError = null,
  billingReturnStatus = null,
  birdIdentificationEnabled = true,
  isCartEnabled = false,
  isAuthenticated = false,
  isBillingLoading = false,
  onAddTourToCart,
  onAuthAction,
  onOpenBirdIdentification,
  onOpenCart,
  onOpenMyTours,
  onLogin,
  onManageBilling,
  onDismissBillingReturn,
  onRemoveTourFromCart,
  onUpdateProfile,
  onUpdateProfileImage,
  onUpgradePlan,
  removingTourIds = [],
  onReserveTour,
  reservingTourIds = [],
  onStartChat,
  user,
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
      <BillingReturnNotice
        status={billingReturnStatus}
        onDismiss={onDismissBillingReturn}
      />
      <HomeHeader
        authActionLabel={authActionLabel}
        birdIdentificationEnabled={birdIdentificationEnabled}
        billingError={billingError}
        cartCount={cartCount}
        isAuthenticated={isAuthenticated}
        isBillingLoading={isBillingLoading}
        onAuthAction={onAuthAction || onLogin}
        onOpenBirdIdentification={onOpenBirdIdentification}
        onOpenCart={onOpenCart}
        onOpenMyTours={onOpenMyTours}
        onStartChat={onStartChat}
        onManageBilling={onManageBilling}
        onUpdateProfile={onUpdateProfile}
        onUpdateProfileImage={onUpdateProfileImage}
        onUpgradePlan={onUpgradePlan}
        user={user}
      />
      <HeroSection
        heroVideo={hero?.heroVideo}
        onAuthAction={onAuthAction || onLogin}
        onStartChat={onStartChat}
        showLoginCta={!isAuthenticated}
      />
      <FeaturedTours
        agentBookingEnabled={agentBookingEnabled}
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
