import { useMemo } from 'react'
import BirdHighlights from '../components/home/BirdHighlights'
import BillingReturnNotice from '../components/home/BillingReturnNotice'
import CookieConsent from '../components/home/CookieConsent'
import FeaturedTours from '../components/home/FeaturedTours'
import FloatingActions from '../components/home/FloatingActions'
import FooterCTA from '../components/home/FooterCTA'
import HomeHeader from '../components/home/HomeHeader'
import HeroSection from '../components/home/HeroSection'
import LoginCTA from '../components/home/LoginCTA'
import SiteFooter from '../components/home/SiteFooter'
import TransportCTA from '../components/home/TransportCTA'
import useHomeContent from '../hooks/useHomeContent'

export function applyTourImageUpdates(tours, tourImageUpdates) {
  return tours.map((tour) => {
    const tourId = String(tour.id || tour.tourId || '')
    const imageUpdate = tourImageUpdates[tourId]
    if (!imageUpdate?.imagePath || !imageUpdate?.url) return tour
    return {
      ...tour,
      imagePath: imageUpdate.imagePath || tour.imagePath || null,
      portraitUrl: imageUpdate.url,
      portraitVersion: imageUpdate.version || null,
    }
  })
}

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
  birdIdentificationUnavailableMessage = '',
  bookingUnavailableMessage = '',
  isCartEnabled = false,
  isAuthenticated = false,
  isBillingLoading = false,
  onAddTourToCart,
  onAuthAction,
  onOpenBirdIdentification,
  onOpenCart,
  onOpenAdmin,
  onOpenMyTours,
  onOpenBookings,
  onOpenTransport,
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
  tourImageUpdates = {},
  user,
}) {
  const {
    tours,
    birds,
    isLoading,
    error,
    retry,
  } = useHomeContent()
  const toursWithCurrentImages = useMemo(
    () => applyTourImageUpdates(tours, tourImageUpdates),
    [tourImageUpdates, tours],
  )

  return (
    <main id="home" className="home-page">
      <BillingReturnNotice
        status={billingReturnStatus}
        onDismiss={onDismissBillingReturn}
      />
      <HomeHeader
        authActionLabel={authActionLabel}
        birdIdentificationEnabled={birdIdentificationEnabled}
        birdIdentificationUnavailableMessage={birdIdentificationUnavailableMessage}
        billingError={billingError}
        cartCount={cartCount}
        isAuthenticated={isAuthenticated}
        isBillingLoading={isBillingLoading}
        onAuthAction={onAuthAction || onLogin}
        onOpenBirdIdentification={onOpenBirdIdentification}
        onOpenCart={onOpenCart}
        onOpenAdmin={onOpenAdmin}
        onOpenMyTours={onOpenMyTours}
        onOpenBookings={onOpenBookings}
        onManageBilling={onManageBilling}
        onUpdateProfile={onUpdateProfile}
        onUpdateProfileImage={onUpdateProfileImage}
        onUpgradePlan={onUpgradePlan}
        user={user}
      />
      <HeroSection
        onAuthAction={onAuthAction || onLogin}
        showLoginCta={!isAuthenticated}
      />
      <FeaturedTours
        agentBookingEnabled={agentBookingEnabled}
        bookingUnavailableMessage={bookingUnavailableMessage}
        addedTourIds={addedTourIds}
        addingTourIds={addingTourIds}
        cartItemsByTourId={cartItemsByTourId}
        isCartEnabled={isCartEnabled}
        removingTourIds={removingTourIds}
        reservingTourIds={reservingTourIds}
        tours={toursWithCurrentImages}
        isLoading={isLoading}
        error={error}
        onRetry={retry}
        onAddToCart={onAddTourToCart}
        onRemoveFromCart={onRemoveTourFromCart}
        onReserveTour={onReserveTour}
      />
      <TransportCTA onOpen={onOpenTransport} />
      <BirdHighlights birds={birds} isLoading={isLoading} error={error} />
      {!isAuthenticated && <LoginCTA onLogin={onLogin} />}
      <FooterCTA />
      <SiteFooter />
      <FloatingActions />
      <CookieConsent />
    </main>
  )
}

export default HomePage
