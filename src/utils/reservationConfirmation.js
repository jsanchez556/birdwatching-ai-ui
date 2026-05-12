function cleanValue(value) {
  return value
    ?.replace(/\s+/g, ' ')
    .replace(/^[#:\-\s]+/, '')
    .replace(/[,.!?;]+$/, '')
    .trim()
}

function matchFirst(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern)

    if (match?.[1]) {
      return cleanValue(match[1])
    }
  }

  return null
}

function formatCurrency(value) {
  if (value === undefined || value === null || value === '') {
    return null
  }

  const normalized = String(value).replace(/,/g, '')
  const amount = Number(normalized)

  if (!Number.isFinite(amount)) {
    return cleanValue(value)
  }

  return `$${amount.toFixed(2)}`
}

export function normalizeReservationConfirmation(reservation) {
  if (!reservation || typeof reservation !== 'object') {
    return null
  }

  const confirmationCode = reservation.confirmationCode || reservation.confirmation_code

  if (!confirmationCode) {
    return null
  }

  return {
    confirmationCode,
    reservationId: reservation.reservationId ?? reservation.id ?? null,
    customerName: reservation.customerName || reservation.customer_name || null,
    customerEmail: reservation.customerEmail || null,
    conversationId: reservation.conversationId || null,
    tourId: reservation.tourId ?? reservation.tour_id ?? null,
    tourName: reservation.tourName || null,
    participants: reservation.participants ?? null,
    createdAt: reservation.createdAt || reservation.created_at || null,
    totalPrice: formatCurrency(reservation.totalPrice ?? reservation.total_price),
    remainingSlots: reservation.remainingSlots ?? null,
    discount: reservation.discountReason || reservation.discount || (
      reservation.discountRate ? `${Number(reservation.discountRate) * 100}% discount` : null
    ),
  }
}

export function extractReservationConfirmation(content) {
  if (typeof content !== 'string') {
    return null
  }

  const hasReservationLanguage = /reservation/i.test(content)
  const hasConfirmationLanguage = /confirm(?:ation|ed)?/i.test(content)
  const confirmationCode = matchFirst(content, [
    /\bconfirmation\s+code\s*(?:is|:|-)?\s*([A-Z0-9]+(?:-[A-Z0-9]+)+)\b/i,
    /\bconfirmation\s*(?:is|:|-)?\s*([A-Z0-9]+(?:-[A-Z0-9]+)+)\b/i,
    /\b(BW-[A-Z0-9-]+)\b/i,
  ])

  if (!confirmationCode || !hasReservationLanguage || !hasConfirmationLanguage) {
    return null
  }

  const rawTotalPrice = matchFirst(content, [
    /\btotal\s+price\s*(?:is|:|-)?\s*(?:USD\s*)?\$?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
    /\btotal\s*(?:is|:|-)?\s*(?:USD\s*)?\$?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
  ])

  return normalizeReservationConfirmation({
    confirmationCode,
    reservationId: matchFirst(content, [
      /\breservation\s+id\s*(?:is|:|#|-)?\s*([A-Z0-9-]+)/i,
      /\breservation\s*#\s*([A-Z0-9-]+)/i,
    ]),
    customerName: matchFirst(content, [
      /\bcustomer\s+name\s*(?:is|:|-)?\s*([^\n,.]+)/i,
      /\bcustomer\s*(?:is|:|-)\s*([^\n,.]+)/i,
    ]),
    tourId: matchFirst(content, [
      /\btour\s+id\s*(?:is|:|#|-)?\s*([0-9]+)/i,
    ]),
    tourName: matchFirst(content, [
      /\btour\s+name\s*(?:is|:|-)?\s*([^\n,.]+)/i,
    ]),
    participants: matchFirst(content, [
      /\bparticipant\s+count\s*(?:is|:|-)?\s*([0-9]+)/i,
      /\bparticipants\s*(?:is|:|-)?\s*([0-9]+)/i,
    ]),
    createdAt: matchFirst(content, [
      /\bcreated\s+time\s*(?:is|:|-)?\s*([^\n.]+)/i,
      /\bcreated\s+at\s*(?:is|:|-)?\s*([^\n.]+)/i,
    ]),
    totalPrice: formatCurrency(rawTotalPrice),
    discount: matchFirst(content, [
      /\bdiscount\s+reason\s*(?:is|:|-)?\s*([^\n.]+)/i,
      /\bdiscount\s*(?:is|:|-)\s*([^\n.]+)/i,
    ]),
  })
}
