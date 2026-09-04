function duration(minutes) { return `${Math.floor(minutes / 60)} h ${minutes % 60} m` }

export default function TransportSummary({ ride, route, luggage, vehicle }) {
  return <aside className="transport-summary" aria-label="Ride summary">
    <p className="transport-kicker">Your trip</p>
    <h2>Ride summary</h2>
    <dl>
      <div><dt>Service type</dt><dd>Distance · One way</dd></div>
      <div><dt>Pickup</dt><dd>{route?.origin?.label || 'Not selected'}</dd></div>
      <div><dt>Drop-off</dt><dd>{route?.destination?.label || 'Not selected'}</dd></div>
      <div><dt>Pickup date, time</dt><dd>{ride.date || '—'} {ride.time || ''}</dd></div>
      {route && <div><dt>Distance · Time</dt><dd>{route.distanceKm} km · {duration(route.durationMinutes)}</dd></div>}
      <div><dt>Travelers</dt><dd>{ride.passengers} passengers · {luggage} luggage</dd></div>
      {vehicle && <div><dt>Vehicle</dt><dd>{vehicle.name} · {vehicle.currency} {vehicle.finalFare}</dd></div>}
    </dl>
  </aside>
}
