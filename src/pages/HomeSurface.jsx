import { lazy, Suspense } from 'react'
import LoginModal from '../components/home/LoginModal'
import MyToursDrawer from '../components/home/MyToursDrawer'
import TourCartDrawer from '../components/home/TourCartDrawer'
import HomePage from './HomePage'

const BirdIdentificationModal = lazy(() => import('../components/BirdIdentificationModal'))
const HomeChatDrawer = lazy(() => import('./ChatSurface').then((module) => ({
  default: module.HomeChatDrawer,
})))

function OverlayLoading() {
  return (
    <div className="home-chat-drawer-backdrop">
      <div className="admin-loading" role="status" aria-label="Loading requested feature">
        Loading…
      </div>
    </div>
  )
}

export default function HomeSurface({ shell }) {
  const {
    auth,
    cart,
    chatEntry,
    openOverlay,
    authMode,
    featureAccess,
    home,
    actions,
  } = shell
  const isSignedInCustomer = auth.isAuthenticated && !auth.isVisitor

  return (
    <>
      <HomePage
        agentBookingEnabled={featureAccess.agentBookingEnabled}
        addedTourIds={home.addedTourIds}
        addingTourIds={home.addingTourIds}
        authActionLabel={home.authActionLabel}
        cartCount={cart.cart.count}
        cartItemsByTourId={home.cartItemsByTourId}
        isCartEnabled={isSignedInCustomer}
        isAuthenticated={auth.isAuthenticated}
        isBillingLoading={home.isBillingLoading}
        billingError={home.billingError}
        billingReturnStatus={home.billingReturnStatus}
        birdIdentificationEnabled={featureAccess.birdIdentificationEnabled}
        birdIdentificationUnavailableMessage={featureAccess.birdIdentificationUnavailableMessage}
        bookingUnavailableMessage={featureAccess.bookingUnavailableMessage}
        onAddTourToCart={actions.addTourToCart}
        onAuthAction={actions.authAction}
        onManageBilling={actions.manageBilling}
        onDismissBillingReturn={actions.dismissBillingReturn}
        onOpenBirdIdentification={actions.openBirdIdentification}
        onOpenCart={actions.openCart}
        onOpenAdmin={actions.openAdmin}
        onOpenMyTours={actions.openMyTours}
        onUpdateProfile={auth.updateProfile}
        onUpdateProfileImage={auth.updateProfileImage}
        onUpgradePlan={actions.upgradePlan}
        onRemoveTourFromCart={actions.removeTourFromCart}
        removingTourIds={home.removingTourIds}
        onReserveTour={actions.reserveTour}
        reservingTourIds={home.reservingTourIds}
        onStartChat={actions.startChat}
        onLogin={actions.openLogin}
        user={auth.user}
      />
      {openOverlay === 'chat' && (auth.isAuthenticated || auth.isVisitor) && (
        <Suspense fallback={<OverlayLoading />}>
          <HomeChatDrawer auth={auth} chatEntry={chatEntry} onClose={actions.closeOverlay} />
        </Suspense>
      )}
      {openOverlay === 'login' && (
        <LoginModal
          authMode={authMode}
          error={auth.error}
          isLoading={auth.isLoading}
          onClose={actions.closeOverlay}
          onLogin={actions.login}
          onSignup={actions.signup}
          onSwitchMode={() => actions.setAuthMode(authMode === 'login' ? 'signup' : 'login')}
          onEnterAsVisitor={actions.enterAsVisitor}
        />
      )}
      {openOverlay === 'cart' && isSignedInCustomer && (
        <TourCartDrawer
          agentBookingEnabled={featureAccess.agentBookingEnabled}
          bookingUnavailableMessage={featureAccess.bookingUnavailableMessage}
          authUser={auth.user}
          cart={cart.cart}
          error={cart.error}
          isLoading={cart.isLoading}
          onClose={actions.closeOverlay}
          onReserveCart={actions.reserveCartItems}
          onReserveItem={(item) => actions.reserveCartItems([item])}
          onRemoveItem={cart.removeItem}
          onSaveItinerary={cart.saveItinerary}
          onUpdateItem={cart.updateItem}
        />
      )}
      {openOverlay === 'bird-identification' && featureAccess.birdIdentificationEnabled && isSignedInCustomer && (
        <Suspense fallback={<OverlayLoading />}>
          <BirdIdentificationModal auth={auth} onClose={actions.closeOverlay} />
        </Suspense>
      )}
      {openOverlay === 'my-tours' && isSignedInCustomer && (
        <MyToursDrawer
          error={cart.error}
          isLoading={cart.isLoading}
          onClose={actions.closeOverlay}
          reservations={cart.reservations}
        />
      )}
    </>
  )
}
