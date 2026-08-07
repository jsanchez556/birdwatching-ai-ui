import { useState } from 'react'

function stringifyActionValue(value) {
  if (typeof value === 'string') {
    return value
  }

  if (value?.transportationOption) {
    const optionName = value.transportationOption.replaceAll('_', ' ')
    const route = value.origin && value.destination
      ? ` from ${value.origin} to ${value.destination}`
      : ''

    return `I choose ${optionName}${route}`
  }

  if (value?.tourId) {
    return `I choose tour ${value.tourId}${value.tourName ? `: ${value.tourName}` : ''}`
  }

  return JSON.stringify(value)
}

function actionMessage(action, option) {
  if (action.type === 'choice' || action.type === 'reservation_confirmation') {
    if (option.value === 'show_details') return 'Show me details'
    if (option.value === 'proceed_booking') return 'Proceed with booking'
    if (option.value === 'confirm_reservation') return 'Confirm reservation'
    if (option.value === 'cancel_reservation') return 'Cancel reservation'
    if (option.value === 'show_transportation') return 'Show transportation'
    if (option.value === 'decline_transportation') return 'No, I have my own transportation'
    if (option.value === 'contact_agent') return 'I would like a human agent to contact me'
    if (option.value === 'decline') return 'No thanks'
  }

  return stringifyActionValue(option.value)
}

function isReservationAction(action, option) {
  if (['reservation_confirmation', 'reservation_details', 'participant_count', 'date_picker', 'transportation_selection'].includes(action.type)) {
    return true
  }

  if (action.type === 'tour_selection') {
    return true
  }

  return [
    'proceed_booking',
    'confirm_reservation',
    'show_transportation',
  ].includes(option?.value)
}

function isVisibleReservationField(field, values) {
  if (!field.requiredWhen) return true
  return values[field.requiredWhen.field] === String(field.requiredWhen.equals)
}

function reservationDetailsMessage(fields, values) {
  const parts = ['I want to complete the reservation.']
  fields.forEach((field) => {
    const value = values[field.name]
    if (!value || !isVisibleReservationField(field, values)) return
    if (field.name === 'date') parts.push(`Date: ${value}.`)
    else if (field.name === 'participants') parts.push(`Participants: ${value}.`)
    else if (field.name === 'transportationRequired') {
      parts.push(value === 'true'
        ? 'Transportation required: yes.'
        : 'Transportation required: no; I have my own transportation.')
    } else if (field.name === 'pickupLocation') parts.push(`Pickup location: ${value}.`)
    else if (field.name === 'customerName') parts.push(`My name is ${value}.`)
    else if (field.name === 'customerEmail') parts.push(`My email is ${value}.`)
    else if (field.name === 'itineraryStartDate') parts.push(`Itinerary start date: ${value}.`)
    else if (field.name === 'itineraryEndDate') parts.push(`Itinerary end date: ${value}.`)
  })
  return parts.join(' ')
}

function ReservationDetailsAction({ action, onAction, viewerRole }) {
  const fields = Array.isArray(action.fields) ? action.fields : []
  const [values, setValues] = useState({})
  const [errors, setErrors] = useState({})
  const isBlocked = viewerRole === 'visitor'

  if (!fields.length) return null

  const updateValue = (name, value) => {
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
  }

  const submit = () => {
    const nextErrors = {}
    fields.forEach((field) => {
      if (!isVisibleReservationField(field, values)) return
      const value = String(values[field.name] || '').trim()
      if (!value) nextErrors[field.name] = 'This field is required.'
      else if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        nextErrors[field.name] = 'Enter a valid email address.'
      } else if (field.name === 'date' && Array.isArray(field.availableDates)
        && field.availableDates.length > 0 && !field.availableDates.includes(value)) {
        nextErrors[field.name] = 'That date is not available for this tour.'
      }
    })
    const startDate = values.itineraryStartDate
    const endDate = values.itineraryEndDate
    if (startDate && endDate && startDate > endDate) {
      nextErrors.itineraryEndDate = 'End date must be on or after the start date.'
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length === 0) {
      onAction(reservationDetailsMessage(fields, values))
    }
  }

  return (
    <fieldset className="message-actions reservation-details-action" disabled={isBlocked}>
      <legend className="action-prompt">{action.prompt || 'Provide the remaining reservation details.'}</legend>
      <div className="reservation-details-fields">
        {fields.filter((field) => isVisibleReservationField(field, values)).map((field) => {
          const controlId = `reservation-${field.name}`
          const options = Array.isArray(field.options) ? field.options : []
          return (
            <label key={field.name} htmlFor={controlId}>
              <span>{field.label}</span>
              {field.type === 'select' ? (
                <select
                  id={controlId}
                  value={values[field.name] || ''}
                  onChange={(event) => updateValue(field.name, event.target.value)}
                  aria-invalid={Boolean(errors[field.name])}
                >
                  <option value="">Select</option>
                  {options.map((option) => (
                    <option key={`${field.name}-${String(option.value)}`} value={String(option.value)}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={controlId}
                  type={field.type || 'text'}
                  min={field.availableDates?.[0]}
                  max={field.availableDates?.[field.availableDates.length - 1]}
                  value={values[field.name] || ''}
                  onChange={(event) => updateValue(field.name, event.target.value)}
                  aria-invalid={Boolean(errors[field.name])}
                />
              )}
              {errors[field.name] && <span className="field-error" role="alert">{errors[field.name]}</span>}
            </label>
          )
        })}
      </div>
      <button type="button" className="action-button compact" onClick={submit}>Send reservation details</button>
      {isBlocked && <div className="action-note">Log in to use booking actions.</div>}
    </fieldset>
  )
}

function ChoiceAction({ action, onAction, viewerRole }) {
  return (
    <div className="message-actions" aria-label={action.prompt}>
      {action.prompt && <div className="action-prompt">{action.prompt}</div>}
      <div className="action-buttons">
        {action.options.map((option) => {
          const isBlocked = viewerRole === 'visitor' && isReservationAction(action, option)

          return (
            <button
              key={`${action.type}-${option.label}`}
              type="button"
              className={`action-button${option.recommended ? ' recommended' : ''}`}
              onClick={() => onAction(actionMessage(action, option))}
              disabled={isBlocked}
              title={isBlocked ? 'Visitors can ask about birds only.' : undefined}
            >
              <span>
                {option.label}
                {option.recommended && <strong>Recommended</strong>}
              </span>
              {isBlocked ? (
                <small>Log in to use booking actions.</small>
              ) : option.description && <small>{option.description}</small>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DatePickerAction({ action, onAction, viewerRole }) {
  const availableDates = Array.isArray(action.availableDates) ? action.availableDates : []
  const [selectedDate, setSelectedDate] = useState('')
  const [dateError, setDateError] = useState('')
  const min = availableDates[0]
  const max = availableDates[availableDates.length - 1]
  const isBlocked = viewerRole === 'visitor'

  return (
    <div className="message-actions" aria-label={action.prompt}>
      {action.prompt && <label className="action-prompt" htmlFor={`date-${action.tourId || 'tour'}`}>{action.prompt}</label>}
      <input
        id={`date-${action.tourId || 'tour'}`}
        type="date"
        min={min}
        max={max}
        disabled={isBlocked}
        value={selectedDate}
        onChange={(event) => {
          setSelectedDate(event.target.value)
          setDateError('')
        }}
      />
      <button
        type="button"
        className="action-button compact"
        disabled={!selectedDate || isBlocked}
        onClick={() => {
          if (availableDates.length > 0 && !availableDates.includes(selectedDate)) {
            setDateError('That date is not available for this tour.')
            return
          }
          onAction(`Use ${selectedDate} for tour ${action.tourId || ''}`.trim())
        }}
      >Choose date</button>
      {dateError && <div className="action-note" role="alert">{dateError}</div>}
      {isBlocked && <div className="action-note">Log in to use booking actions.</div>}
    </div>
  )
}

function ParticipantCountAction({ action, onAction, viewerRole }) {
  const [selectedValue, setSelectedValue] = useState('')
  const isBlocked = viewerRole === 'visitor'
  const options = Array.isArray(action.options) && action.options.length > 0
    ? action.options
    : Array.from({ length: Math.max(0, Number(action.max || 0)) }, (_, index) => {
      const value = index + 1
      return { label: String(value), value }
    })
  const controlId = `participants-${action.max || options.length || 'count'}`

  if (!options.length) {
    return null
  }

  return (
    <div className="message-actions participant-count-action">
      {action.prompt && <label className="action-prompt" htmlFor={controlId}>{action.prompt}</label>}
      <div className="action-select-row">
        <select
          id={controlId}
          value={selectedValue}
          disabled={isBlocked}
          onChange={(event) => setSelectedValue(event.target.value)}
        >
          <option value="">Select</option>
          {options.map((option) => (
            <option key={`${action.type}-${option.value}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="action-button compact"
          disabled={!selectedValue || isBlocked}
          onClick={() => onAction(selectedValue)}
        >
          Send
        </button>
      </div>
      {isBlocked && <div className="action-note">Log in to use booking actions.</div>}
    </div>
  )
}

function MessageActions({ actions = [], onAction, viewerRole }) {
  if (!actions.length || !onAction) {
    return null
  }

  return (
    <div className="message-action-list">
      {actions.map((action, index) => {
        if (action.type === 'reservation_details') {
          return <ReservationDetailsAction key={`${action.type}-${index}`} action={action} onAction={onAction} viewerRole={viewerRole} />
        }

        if (action.type === 'date_picker') {
          return <DatePickerAction key={`${action.type}-${index}`} action={action} onAction={onAction} viewerRole={viewerRole} />
        }

        if (action.type === 'participant_count') {
          return <ParticipantCountAction key={`${action.type}-${index}`} action={action} onAction={onAction} viewerRole={viewerRole} />
        }

        if (Array.isArray(action.options)) {
          return <ChoiceAction key={`${action.type}-${index}`} action={action} onAction={onAction} viewerRole={viewerRole} />
        }

        return null
      })}
    </div>
  )
}

export default MessageActions
