function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== '')
  )
}

export function getTourId(tour) {
  return tour?.tourId || tour?.id
}

export function summarizeTour(tour) {
  if (!tour || typeof tour !== 'object') {
    return null
  }

  const tourId = getTourId(tour)

  return compactObject({
    tourId: tourId ? Number(tourId) : undefined,
    name: tour.name || tour.title || tour.tourName || 'Selected tour',
    location: tour.location,
    node: tour.node,
    subnode: tour.subnode,
    zone: tour.zone,
    pricePerPerson: tour.pricePerPerson,
    duration: tour.duration,
    durationHours: tour.durationHours,
    difficulty: tour.difficulty,
    startDate: tour.startDate || tour.start_date,
    endDate: tour.endDate || tour.end_date,
  })
}

export function summarizeCartItem(item) {
  const tour = summarizeTour({
    ...(item?.tour || {}),
    tourId: item?.tourId || item?.tour?.tourId || item?.tour?.id,
    tourName: item?.tourName,
  })

  return compactObject({
    itemId: item?.id,
    ...(tour || {}),
    scheduledDate: item?.scheduledDate,
    participants: item?.participants,
    needsTransportation: item?.needsTransportation,
  })
}

export function buildReservationChatEntry({
  source,
  tours = [],
  cart,
  authUser,
  now = Date.now,
}) {
  const selectedTours = tours
    .filter((tour) => tour && typeof tour === 'object')
    .map((tour) => compactObject(tour))
    .filter((tour) => tour.tourId || tour.name)
  const tourNames = selectedTours.map((tour) => tour.name).filter(Boolean)
  const isCart = source === 'tour_cart'
  const label = isCart
    ? `${selectedTours.length} tour${selectedTours.length === 1 ? '' : 's'} from my cart`
    : tourNames[0] || 'this tour'
  const entryId = [
    source,
    now(),
    ...selectedTours.map((tour) => tour.itemId || tour.tourId || tour.name),
  ].join(':')
  const customerContext = compactObject({
    customerName: authUser?.name,
    customerEmail: authUser?.email,
    itineraryStartDate: cart?.itineraryStartDate,
    itineraryEndDate: cart?.itineraryEndDate,
  })
  const reservationEntry = compactObject({
    source,
    tours: selectedTours,
    cart: isCart
      ? compactObject({
        itineraryStartDate: cart?.itineraryStartDate,
        itineraryEndDate: cart?.itineraryEndDate,
        count: selectedTours.length,
      })
      : undefined,
  })
  const conversationContext = compactObject({
    conversationType: 'reservation_entry',
    conversationSource: source,
    entrySource: source,
    reservationEntry,
    tours: selectedTours,
    selectedTour: !isCart && selectedTours.length === 1 ? selectedTours[0] : undefined,
    selectedTourId: !isCart && selectedTours.length === 1 ? selectedTours[0].tourId : undefined,
    participants: selectedTours.length === 1 ? selectedTours[0].participants : undefined,
  })

  return {
    id: entryId,
    source,
    title: isCart ? 'Reserve selected tours' : 'Reserve this tour',
    initialMessage: `I would like to reserve ${label}.`,
    customerContext,
    conversationContext,
  }
}
