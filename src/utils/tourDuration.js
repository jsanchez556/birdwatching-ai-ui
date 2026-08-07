export const TOUR_DURATION_UNITS = Object.freeze(['hours', 'days'])

export function formatTourDuration(tour = {}) {
  const unit = TOUR_DURATION_UNITS.includes(tour.durationUnit) ? tour.durationUnit : 'hours'
  const value = Number(tour.durationValue ?? tour.durationHours)

  if (!Number.isFinite(value) || value <= 0) return tour.duration || null
  const singular = unit === 'days' ? 'day' : 'hour'
  return `${value} ${value === 1 ? singular : unit}`
}
