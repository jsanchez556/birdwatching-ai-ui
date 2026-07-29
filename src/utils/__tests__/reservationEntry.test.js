import {
  buildReservationChatEntry,
  summarizeCartItem,
  summarizeTour,
} from '../reservationEntry'

describe('reservation entry normalization', () => {
  test('normalizes a featured tour into a stable reservation chat entry', () => {
    const tour = summarizeTour({
      id: '12',
      title: 'Monteverde Dawn Chorus',
      location: 'Monteverde',
      start_date: '2026-08-10',
      pricePerPerson: 120,
    })
    const entry = buildReservationChatEntry({
      source: 'featured_tour',
      tours: [tour],
      cart: {},
      authUser: { name: 'Ana', email: 'ana@example.com' },
      now: () => 1234,
    })

    expect(tour).toEqual({
      tourId: 12,
      name: 'Monteverde Dawn Chorus',
      location: 'Monteverde',
      pricePerPerson: 120,
      startDate: '2026-08-10',
    })
    expect(entry).toMatchObject({
      id: 'featured_tour:1234:12',
      title: 'Reserve this tour',
      initialMessage: 'I would like to reserve Monteverde Dawn Chorus.',
      customerContext: {
        customerName: 'Ana',
        customerEmail: 'ana@example.com',
      },
      conversationContext: {
        conversationType: 'reservation_entry',
        conversationSource: 'featured_tour',
        selectedTourId: 12,
        selectedTour: tour,
      },
    })
  })

  test('normalizes cart item scheduling and itinerary context without empty fields', () => {
    const item = summarizeCartItem({
      id: 91,
      tourId: 17,
      tourName: 'Carara Morning',
      scheduledDate: '2026-09-02',
      participants: 3,
      needsTransportation: false,
    })
    const entry = buildReservationChatEntry({
      source: 'tour_cart',
      tours: [item],
      cart: {
        itineraryStartDate: '2026-09-01',
        itineraryEndDate: '2026-09-05',
      },
      authUser: { email: 'ana@example.com' },
      now: () => 5678,
    })

    expect(item).toEqual({
      itemId: 91,
      tourId: 17,
      name: 'Carara Morning',
      scheduledDate: '2026-09-02',
      participants: 3,
      needsTransportation: false,
    })
    expect(entry.id).toBe('tour_cart:5678:91')
    expect(entry.initialMessage).toBe('I would like to reserve 1 tour from my cart.')
    expect(entry.customerContext).toEqual({
      customerEmail: 'ana@example.com',
      itineraryStartDate: '2026-09-01',
      itineraryEndDate: '2026-09-05',
    })
    expect(entry.conversationContext.reservationEntry.cart).toEqual({
      itineraryStartDate: '2026-09-01',
      itineraryEndDate: '2026-09-05',
      count: 1,
    })
  })
})
