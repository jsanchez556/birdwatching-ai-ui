function formatDate(value) {
  if (!value) return 'Date pending'

  const match = typeof value === 'string' ? value.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function formatMoney(value) {
  const numberValue = Number(value)

  if (!Number.isFinite(numberValue)) return null

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(numberValue)
}

function getTourDate(reservation) {
  return reservation.itineraryStartDate
    || reservation.reservation?.metadata?.itineraryStartDate
    || reservation.createdAt
}

function isPastTour(dateValue) {
  if (!dateValue) return false

  const today = new Date()
  const todayValue = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const tourDate = new Date(`${dateValue.slice(0, 10)}T00:00:00`).getTime()

  return Number.isFinite(tourDate) && tourDate < todayValue
}

function getTourName(item) {
  return item.tourName || item.tour?.name || item.reservation?.tourName || 'Reserved tour'
}

function MyToursDrawer({ error, isLoading, onClose, reservations = [] }) {
  return (
    <div className="cart-drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className="cart-drawer my-tours-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="my-tours-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="cart-drawer-header">
          <div>
            <p className="home-kicker">My Tours</p>
            <h2 id="my-tours-title">Recent reservations</h2>
          </div>
          <button type="button" className="auth-modal-close" aria-label="Close My Tours" onClick={onClose}>
            x
          </button>
        </header>

        {isLoading && <p className="cart-status" role="status">Loading your reservations...</p>}
        {error && <p className="cart-status" role="status">{error}</p>}

        {!isLoading && reservations.length === 0 ? (
          <div className="cart-empty-state">
            <p>No reserved tours yet.</p>
          </div>
        ) : (
          <ul className="my-tours-list">
            {reservations.map((item) => {
              const date = getTourDate(item)
              const isPast = isPastTour(date)
              const total = formatMoney(item.totalPrice || item.reservation?.totalPrice)

              return (
                <li className={isPast ? 'my-tour-item is-past' : 'my-tour-item'} key={item.id || item.reservation?.id}>
                  <div>
                    <h3>{getTourName(item)}</h3>
                    <p>{item.tour?.location}</p>
                  </div>
                  <dl>
                    <div>
                      <dt>Date</dt>
                      <dd>{formatDate(date)}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{isPast ? 'Completed' : 'Upcoming'}</dd>
                    </div>
                    {item.confirmationCode || item.reservation?.confirmationCode ? (
                      <div>
                        <dt>Confirmation</dt>
                        <dd>{item.confirmationCode || item.reservation.confirmationCode}</dd>
                      </div>
                    ) : null}
                    {total && (
                      <div>
                        <dt>Total</dt>
                        <dd>{total}</dd>
                      </div>
                    )}
                  </dl>
                </li>
              )
            })}
          </ul>
        )}
      </aside>
    </div>
  )
}

export default MyToursDrawer
