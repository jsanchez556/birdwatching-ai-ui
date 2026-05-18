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
  if (['reservation_confirmation', 'participant_count', 'date_picker', 'transportation_selection'].includes(action.type)) {
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
        onChange={(event) => {
          if (event.target.value) {
            onAction(`Use ${event.target.value} for tour ${action.tourId || ''}`.trim())
          }
        }}
      />
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
