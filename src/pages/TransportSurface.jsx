import { useMemo, useState } from 'react'
import TransportMap from '../components/transport/TransportMap'
import TransportStepper from '../components/transport/TransportStepper'
import TransportSummary from '../components/transport/TransportSummary'
import TransportVehicleImage from '../components/transport/TransportVehicleImage'
import useTransportBooking from '../hooks/useTransportBooking'

const contactLabels = { firstName: 'First name', lastName: 'Last name', email: 'Email address', phone: 'Phone number' }

function formatDuration(minutes) { return `${Math.floor(minutes / 60)} h ${minutes % 60} m` }

function validateContact(contact) {
  const errors = {}
  if (!contact.firstName.trim()) errors.firstName = 'Enter your first name.'
  if (!contact.lastName.trim()) errors.lastName = 'Enter your last name.'
  if (!contact.email.trim()) errors.email = 'Enter your email address.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) errors.email = 'Enter a valid email address.'
  const phone = contact.phone.replace(/[\s()-]/g, '')
  if (!phone) errors.phone = 'Enter your phone number.'
  else if (!/^\+[1-9]\d{7,14}$/.test(phone)) errors.phone = 'Include the country code, for example +506 8888 8888.'
  return errors
}

export default function TransportSurface({ auth, onBack }) {
  const booking = useTransportBooking({ auth })
  const [contactTouched, setContactTouched] = useState({})
  const contactErrors = useMemo(() => validateContact(booking.contact), [booking.contact])
  const routeReady = Boolean(booking.places.origin && booking.places.destination)
  const rideReady = Boolean(booking.route && booking.ride.date && booking.ride.time && Number(booking.ride.passengers) > 0)

  return <main className="transport-page">
    <header className="transport-header">
      <button className="transport-back" type="button" onClick={onBack}>← Back</button>
      <div className="transport-brand" aria-label="RCN transportation">
        <span className="brand-mark" aria-hidden="true">BW</span>
        <span><strong>RCN</strong><small>Private transportation</small></span>
      </div>
      <p>Costa Rica</p>
    </header>

    <section className="transport-intro" aria-labelledby="transport-title">
      <p className="transport-kicker">Door-to-door transfers</p>
      <h1 id="transport-title">Travel comfortably between birding destinations</h1>
      <p>Plan a private ride, compare vehicles, and confirm your pickup in four simple steps.</p>
    </section>

    <section className="transport-wizard" aria-label="Transportation booking" aria-busy={booking.status.type === 'loading'}>
      <TransportStepper step={booking.step} onStep={booking.setStep} />
      <div className="transport-live-region" aria-live="polite" aria-atomic="true">
        {booking.status.message && <p className={`transport-notice ${booking.status.type}`} role={booking.status.type === 'error' ? 'alert' : 'status'}>{booking.status.message}</p>}
      </div>

      {booking.step === 1 && <form className="transport-step-panel" aria-labelledby="ride-details-heading" onSubmit={(event) => { event.preventDefault(); if (rideReady) booking.chooseVehicles() }}>
        <div className="transport-section-heading"><p className="transport-kicker">Step 1 of 4</p><h2 id="ride-details-heading">Enter ride details</h2><p>Choose your route and tell us when your group is traveling.</p></div>
        <TransportMap places={booking.places} route={booking.route} onPlaceChange={booking.setPlace} />
        <fieldset className="transport-ride-fields"><legend className="sr-only">Pickup details</legend>
          <label htmlFor="transport-date">Pickup date<input id="transport-date" type="date" value={booking.ride.date} min={new Date().toISOString().slice(0, 10)} onChange={(event) => booking.updateRide('date', event.target.value)} /></label>
          <label htmlFor="transport-time">Pickup time<input id="transport-time" type="time" value={booking.ride.time} onChange={(event) => booking.updateRide('time', event.target.value)} /></label>
          <label htmlFor="transport-passengers">Passengers<input id="transport-passengers" type="number" min="1" max="50" value={booking.ride.passengers} onChange={(event) => booking.updateRide('passengers', event.target.value)} /></label>
        </fieldset>
        {booking.route ? <div className="transport-route-metrics" aria-label="Route estimate"><div><small>Total distance</small><strong>{booking.route.distanceKm} km</strong></div><div><small>Estimated drive</small><strong>{formatDuration(booking.route.durationMinutes)}</strong></div></div> : <div className="transport-route-action"><button className="transport-secondary" type="button" disabled={!routeReady || booking.status.type === 'loading'} aria-describedby={!routeReady ? 'route-disabled-reason' : undefined} onClick={booking.calculateRoute}>Calculate route</button>{!routeReady && <p id="route-disabled-reason" className="transport-action-help">Choose both locations to calculate the route.</p>}</div>}
        <div className="transport-actions"><button className="transport-primary" type="submit" disabled={!rideReady || booking.status.type === 'loading'} aria-describedby={!rideReady ? 'vehicle-disabled-reason' : undefined}>Choose a vehicle <span aria-hidden="true">→</span></button></div>
        {!rideReady && <p id="vehicle-disabled-reason" className="transport-action-help transport-action-help-end">Calculate a route and add the pickup date and time to continue.</p>}
      </form>}

      {booking.step === 2 && <div className="transport-with-summary"><TransportSummary {...booking} />
        <section className="transport-content" aria-labelledby="vehicle-heading"><div className="transport-section-heading"><p className="transport-kicker">Step 2 of 4</p><h2 id="vehicle-heading">Choose a vehicle</h2><p>Only vehicles that can comfortably carry your group are shown.</p></div>
          <label className="transport-luggage" htmlFor="transport-luggage">Pieces of luggage<input id="transport-luggage" type="number" min="0" max="100" value={booking.luggage} onChange={(event) => booking.refreshVehicles(Number(event.target.value))} /></label>
          {booking.vehicles.length === 0 && <p className="transport-empty" role="status">No active vehicle can accommodate this party. Try reducing the group or luggage count.</p>}
          <ul className="transport-vehicles">{booking.vehicles.map((vehicle) => {
            const selected = booking.vehicle?.id === vehicle.id
            return <li key={vehicle.id}><article className={selected ? 'is-selected' : ''}>
              <TransportVehicleImage imagePath={vehicle.imagePath} name={vehicle.name} />
              <div className="transport-vehicle-copy"><p className="transport-kicker">{vehicle.vehicleType}</p><h3>{vehicle.name}</h3><p>{vehicle.description}</p><p className="transport-capacity">Up to {vehicle.passengerCapacity} passengers <span aria-hidden="true">·</span> {vehicle.luggageCapacity} bags</p><small>{vehicle.currency} {vehicle.pricePerKm}/km <span aria-hidden="true">·</span> minimum {vehicle.currency} {vehicle.minimumFare}</small><strong className="transport-price">{vehicle.currency} {vehicle.finalFare}</strong>{vehicle.minimumFareApplied && <small>Minimum fare applied</small>}</div>
              <button className={selected ? 'transport-secondary' : 'transport-primary'} type="button" aria-pressed={selected} onClick={() => booking.selectVehicle(vehicle)}>{selected ? 'Selected ✓' : 'Select vehicle'}</button>
            </article></li>
          })}</ul>
          <div className="transport-actions"><button className="transport-primary" type="button" disabled={!booking.vehicle} aria-describedby={!booking.vehicle ? 'contact-disabled-reason' : undefined} onClick={booking.continueToContact}>Enter contact details <span aria-hidden="true">→</span></button></div>
          {!booking.vehicle && <p id="contact-disabled-reason" className="transport-action-help transport-action-help-end">Select a vehicle to continue.</p>}
        </section></div>}

      {booking.step === 3 && <div className="transport-with-summary"><TransportSummary {...booking} />
        <form className="transport-content" aria-labelledby="contact-heading" onSubmit={(event) => { event.preventDefault(); if (booking.contactValid) booking.setStep(4) }}><div className="transport-section-heading"><p className="transport-kicker">Step 3 of 4</p><h2 id="contact-heading">Enter contact details</h2><p>We’ll use these details only to coordinate your pickup.</p></div><div className="transport-contact-grid">
          {Object.keys(contactLabels).map((field) => {
            const showError = contactTouched[field] && contactErrors[field]
            const errorId = `transport-${field}-error`
            return <label key={field} htmlFor={`transport-${field}`}>{contactLabels[field]}<input id={`transport-${field}`} type={field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text'} autoComplete={({ firstName: 'given-name', lastName: 'family-name', email: 'email', phone: 'tel' })[field]} value={booking.contact[field]} placeholder={field === 'phone' ? '+506 8888 8888' : ''} aria-invalid={showError ? 'true' : undefined} aria-describedby={showError ? errorId : undefined} onBlur={() => setContactTouched((current) => ({ ...current, [field]: true }))} onChange={(event) => booking.setContact((current) => ({ ...current, [field]: event.target.value }))} />{showError && <span id={errorId} className="transport-field-error">{contactErrors[field]}</span>}</label>
          })}
          <label className="wide" htmlFor="transport-comments">Comments <span className="transport-optional">Optional</span><textarea id="transport-comments" value={booking.comments} maxLength="1000" onChange={(event) => booking.setComments(event.target.value)} /><small>{booking.comments.length}/1000 characters</small></label>
        </div><fieldset className="transport-payment"><legend>Payment method</legend><label><input type="radio" checked={booking.paymentMethod.type === 'pay_on_arrival'} onChange={() => booking.setPaymentMethod({ type: 'pay_on_arrival' })} /> <span><strong>Pay on arrival</strong><small>Pay the driver when your trip begins.</small></span></label></fieldset>
          <div className="transport-actions"><button className="transport-primary" type="submit" disabled={!booking.contactValid} aria-describedby={!booking.contactValid ? 'review-disabled-reason' : undefined}>Review booking <span aria-hidden="true">→</span></button></div>
          {!booking.contactValid && <p id="review-disabled-reason" className="transport-action-help transport-action-help-end">Complete all required contact fields to continue.</p>}
        </form></div>}

      {booking.step === 4 && <div className="transport-with-summary"><TransportSummary {...booking} />
        <section className="transport-content" aria-labelledby="summary-heading"><div className="transport-section-heading"><p className="transport-kicker">Step 4 of 4</p><h2 id="summary-heading">Review your booking</h2><p>Check every detail before confirming your ride.</p></div>{booking.confirmation ? <div className="transport-confirmation" role="status"><span aria-hidden="true">✓</span><h3>Your ride is confirmed</h3><p>Booking reference <strong>{booking.confirmation.bookingReference}</strong></p><p>Payment: pay on arrival</p></div> : <>
          <div className="transport-review"><section><div><p className="transport-kicker">Ride</p><h3>Route and pickup</h3></div><p>{booking.route.origin.label} → {booking.route.destination.label}</p><p>{booking.ride.date} at {booking.ride.time} · {booking.route.distanceKm} km · {formatDuration(booking.route.durationMinutes)}</p><button type="button" onClick={() => booking.setStep(1)}>Edit ride</button></section>
          <section><div><p className="transport-kicker">Vehicle</p><h3>{booking.vehicle.name}</h3></div><p>Capacity {booking.vehicle.passengerCapacity} passengers / {booking.vehicle.luggageCapacity} luggage</p><p>{booking.vehicle.currency} {booking.vehicle.pricePerKm}/km · distance charge {booking.vehicle.currency} {booking.vehicle.distanceCharge}</p><p>Minimum fare {booking.vehicle.currency} {booking.vehicle.minimumFare}{booking.vehicle.minimumFareApplied ? ' (applied)' : ' (not applied)'}</p><p className="transport-price">{booking.vehicle.currency} {booking.vehicle.finalFare}</p><button type="button" onClick={() => booking.setStep(2)}>Edit vehicle</button></section>
          <section><div><p className="transport-kicker">Contact</p><h3>{booking.contact.firstName} {booking.contact.lastName}</h3></div><p>{booking.contact.email}<br />{booking.contact.phone}</p><p>Comments: {booking.comments || 'None'}</p><p>Payment: Pay on arrival</p><button type="button" onClick={() => booking.setStep(3)}>Edit contact</button></section></div>
          <div className="transport-actions"><button className="transport-primary" type="button" disabled={booking.status.type === 'loading'} onClick={booking.submit}>Confirm booking</button></div></>}
        </section></div>}
    </section>
  </main>
}
