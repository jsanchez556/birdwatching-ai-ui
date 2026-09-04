export default function TransportCTA({ onOpen }) {
  return <section id="transport" className="home-section home-section-contrast transport-cta" aria-labelledby="transport-title">
    <div><p className="home-kicker">Door-to-door travel</p><h2 id="transport-title">Plan your ride across Costa Rica</h2><p>Choose your route, compare vehicles, and receive an authoritative distance-based quote.</p></div>
    <button type="button" className="home-primary-action" onClick={onOpen}>Book transportation</button>
  </section>
}
