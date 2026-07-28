import { useState } from 'react'
import CustomerContextForm from '../CustomerContextForm'

const API_FALLBACK_ERROR_MESSAGE = 'Something went wrong. Please try again.'

function formatMoney(value) {
  const numberValue = Number(value)

  if (!Number.isFinite(numberValue)) return null

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(numberValue)
}

function getTourName(item) {
  return item.tour?.name || item.tourName || 'Selected tour'
}

function TourCartDrawer({
  agentBookingEnabled = true,
  authUser,
  cart,
  error,
  isLoading,
  onClose,
  onRemoveItem,
  onReserveCart,
  onReserveItem,
  onSaveItinerary,
  onUpdateItem,
}) {
  const [status, setStatus] = useState(null)
  const scheduledDates = cart.items.map((item) => item.scheduledDate).filter(Boolean)
  const duplicateDates = scheduledDates.filter((date, index) => scheduledDates.indexOf(date) !== index)
  const hasDuplicateDates = duplicateDates.length > 0
  const visibleError = cart.items.length === 0 && error === API_FALLBACK_ERROR_MESSAGE ? null : error

  const handleSaveItinerary = async (customerContext) => {
    setStatus(null)

    try {
      await onSaveItinerary({
        itineraryStartDate: customerContext.itineraryStartDate,
        itineraryEndDate: customerContext.itineraryEndDate,
      })
      setStatus('Itinerary dates updated.')
    } catch (requestError) {
      setStatus(requestError.message)
    }
  }

  const handleReserveCart = () => {
    if (!agentBookingEnabled) return

    setStatus(null)

    if (hasDuplicateDates) {
      setStatus('The assistant will help resolve tours assigned to the same day.')
      onReserveCart?.(cart.items)
      return
    }

    onReserveCart?.(cart.items)
  }

  const handleReserveItem = (item) => {
    if (!agentBookingEnabled) return

    setStatus(null)
    onReserveItem?.(item)
  }

  return (
    <div className="cart-drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className="cart-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-cart-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="cart-drawer-header">
          <div>
            <p className="home-kicker">Birding cart</p>
            <h2 id="tour-cart-title">Your selected tours</h2>
          </div>
          <button type="button" className="auth-modal-close" aria-label="Close cart" onClick={onClose}>
            x
          </button>
        </header>

        <CustomerContextForm
          authUser={authUser}
          initialValues={{
            customerName: authUser?.name || '',
            customerEmail: authUser?.email || '',
            itineraryStartDate: cart.itineraryStartDate || undefined,
            itineraryEndDate: cart.itineraryEndDate || undefined,
          }}
          onSubmit={handleSaveItinerary}
          showHeader={false}
          submitLabel="Save itinerary"
          title="Reservation contact and itinerary"
          description="Use these dates to keep cart tours assigned to the right travel days."
        />

        {(visibleError || status) && (
          <p className="cart-status" role="status">{status || visibleError}</p>
        )}

        {hasDuplicateDates && (
          <p className="cart-status is-error" role="status">
            Only one tour can be assigned to each itinerary day.
          </p>
        )}

        {cart.items.length === 0 ? (
          <div className="cart-empty-state">
            <p>Your cart is ready for a route.</p>
          </div>
        ) : (
          <ul className="cart-item-list">
            {cart.items.map((item) => (
              <li className="cart-item" key={item.id}>
                <div>
                  <h3>{getTourName(item)}</h3>
                  <p>{item.tour?.location}</p>
                  <p>{formatMoney(item.tour?.pricePerPerson)} per person</p>
                </div>
                <label>
                  <span>Date</span>
                  <input
                    type="date"
                    value={item.scheduledDate || ''}
                    min={cart.itineraryStartDate || undefined}
                    max={cart.itineraryEndDate || undefined}
                    onChange={(event) => onUpdateItem(item.id, { scheduledDate: event.target.value })}
                  />
                </label>
                <label className="cart-checkbox">
                  <input
                    type="checkbox"
                    checked={item.needsTransportation === true}
                    onChange={(event) => onUpdateItem(item.id, { needsTransportation: event.target.checked })}
                  />
                  <span>Transportation</span>
                </label>
                <button type="button" className="cart-secondary-action" onClick={() => onRemoveItem(item.id)}>
                  Remove
                </button>
                {agentBookingEnabled && (
                  <button
                    type="button"
                    className="cart-secondary-action"
                    disabled={isLoading}
                    onClick={() => handleReserveItem(item)}
                  >
                    Reserve this tour
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {agentBookingEnabled && (
          <footer className="cart-drawer-footer">
            <button
              type="button"
              className="cart-primary-action"
              disabled={isLoading || cart.items.length === 0}
              onClick={handleReserveCart}
            >
              Reserve cart
            </button>
          </footer>
        )}
      </aside>
    </div>
  )
}

export default TourCartDrawer
