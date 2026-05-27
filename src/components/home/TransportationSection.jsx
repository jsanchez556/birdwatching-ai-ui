function TransportationSection({ options, isLoading, error }) {
  return (
    <section className="home-section" aria-labelledby="transportation-title">
      <div className="home-section-heading">
        <p className="home-kicker">Optional transfers</p>
        <h2 id="transportation-title">Smooth arrivals for early departures</h2>
      </div>
      {isLoading && <p className="home-status" role="status">Loading transportation options...</p>}
      {error && <p className="home-status" role="status">Transportation options are temporarily unavailable.</p>}
      <div className="transportation-list">
        {options.map((option) => (
          <article className="transportation-item" key={option.id || option.title}>
            <div>
              <p className="home-card-eyebrow">{option.coverage}</p>
              <h3>{option.title}</h3>
              <p>{option.description}</p>
            </div>
            <strong>{option.startingPrice}</strong>
          </article>
        ))}
      </div>
    </section>
  )
}

export default TransportationSection
