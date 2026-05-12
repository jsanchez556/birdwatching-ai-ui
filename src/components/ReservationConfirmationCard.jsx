function DetailItem({ label, value }) {
  if (value === undefined || value === null || value === '') {
    return null
  }

  return (
    <div className="reservation-detail">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function ReservationConfirmationCard({ reservation }) {
  const details = [
    ['Reservation ID', reservation.reservationId],
    ['Customer', reservation.customerName],
    ['Tour ID', reservation.tourId],
    ['Participants', reservation.participants],
    ['Total', reservation.totalPrice],
    ['Created', reservation.createdAt],
    ['Discount', reservation.discount],
  ].filter(([, value]) => value !== undefined && value !== null && value !== '')

  return (
    <aside className="reservation-card" aria-label="Reservation confirmation">
      <div className="reservation-card-header">
        <div>
          <p className="reservation-eyebrow">Reservation confirmed</p>
          <h3>{reservation.tourName || 'Birdwatching tour'}</h3>
        </div>
        <span className="reservation-status">Confirmed</span>
      </div>

      <div className="confirmation-code-block">
        <span>Confirmation code</span>
        <strong>{reservation.confirmationCode}</strong>
      </div>

      {details.length > 0 && (
        <dl className="reservation-details">
          {details.map(([label, value]) => (
            <DetailItem key={label} label={label} value={value} />
          ))}
        </dl>
      )}
    </aside>
  )
}

export default ReservationConfirmationCard
