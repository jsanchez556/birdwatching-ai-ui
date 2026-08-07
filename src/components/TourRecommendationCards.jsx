import { displayTourType } from '../constants/tourTypes'

const AVAILABILITY_LABELS = {
  available: 'Available',
  limited: 'Limited availability',
  unavailable: 'Unavailable',
  unknown: 'Availability unknown',
}

function formatConfidence(confidence) {
  return new Intl.NumberFormat(undefined, {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(confidence)
}

function formatPrice({ amount, currency }) {
  if (amount === null || currency === null) return 'Price unavailable'

  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * @param {{recommendation?: import('../api/tourRecommendationContract').TourRecommendation|null}} props
 */
function TourRecommendationCards({ recommendation }) {
  if (!recommendation?.recommendations?.length) return null

  return (
    <section
      className="tour-recommendations"
      aria-label="Tour recommendations"
    >
      <div className="tour-recommendation-list" role="list">
        {recommendation.recommendations.map((tour) => (
          <article
            className="tour-recommendation-card"
            key={tour.tourId}
            role="listitem"
            aria-labelledby={`tour-recommendation-${tour.tourId}`}
          >
            <div className="tour-recommendation-header">
              <div>
                <div className="tour-recommendation-eyebrow">{displayTourType(tour.type)}</div>
                <h3 id={`tour-recommendation-${tour.tourId}`}>{tour.tourName}</h3>
                <p className="tour-recommendation-location">{tour.location}</p>
              </div>
              <span className={`tour-availability is-${tour.availabilityStatus}`}>
                {AVAILABILITY_LABELS[tour.availabilityStatus]}
              </span>
            </div>
            <dl className="tour-recommendation-facts">
              <div>
                <dt>Match</dt>
                <dd>{formatConfidence(tour.confidence)}</dd>
              </div>
              <div>
                <dt>Price</dt>
                <dd>{formatPrice(tour.estimatedPrice)}</dd>
              </div>
            </dl>
            <div className="tour-match-reasons">
              <h4>Why it matches</h4>
              <ul>
                {tour.matchReasons.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export {
  AVAILABILITY_LABELS,
  formatConfidence,
  formatPrice,
}
export default TourRecommendationCards
