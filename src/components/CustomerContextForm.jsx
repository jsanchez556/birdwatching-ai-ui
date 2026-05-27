import { useRef, useState } from 'react'
import { normalizeText } from '../utils/normalizers'

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function formatDisplayDate(dateValue) {
  const [year, month, day] = String(dateValue || '').split('-')

  if (!year || !month || !day) {
    return 'Choose date'
  }

  return `${day}/${month}/${year}`
}

function CustomerContextForm({
  authUser,
  initialValues = {},
  onSubmit,
  showHeader = true,
  submitLabel = 'Start chat',
  title = 'Plan your birding chat',
  description = 'Start with your contact details and itinerary dates so bookings stay accurate.',
}) {
  const profileName = normalizeText(authUser?.name || '')
  const profileEmail = normalizeText(authUser?.email || '')
  const initialName = profileName || initialValues.customerName || ''
  const initialEmail = profileEmail || initialValues.customerEmail || ''
  const hasProfileContact = profileName && profileEmail
  const [form, setForm] = useState({
    customerName: initialName,
    customerEmail: initialEmail,
    itineraryStartDate: initialValues.itineraryStartDate || todayIsoDate(),
    itineraryEndDate: initialValues.itineraryEndDate || initialValues.itineraryStartDate || todayIsoDate(),
  })
  const [isEditingContact, setIsEditingContact] = useState(!hasProfileContact)
  const [errors, setErrors] = useState({})
  const startDateRef = useRef(null)
  const endDateRef = useRef(null)

  const displayName = normalizeText(form.customerName) || profileName
  const displayEmail = normalizeText(form.customerEmail) || profileEmail

  const updateField = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'itineraryStartDate' && prev.itineraryEndDate < value
        ? { itineraryEndDate: value }
        : {}),
    }))

    setErrors((prev) => {
      if (!prev[field]) {
        return prev
      }

      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const openDatePicker = (dateInputRef) => {
    const dateInput = dateInputRef.current

    if (!dateInput) {
      return
    }

    dateInput.focus()

    if (typeof dateInput.showPicker === 'function') {
      dateInput.showPicker()
    }
  }

  const validate = () => {
    const nextErrors = {}
    const customerName = normalizeText(form.customerName)
    const customerEmail = normalizeText(form.customerEmail)

    if (!customerName) {
      nextErrors.customerName = 'Enter a name for this reservation.'
    }

    if (!customerEmail) {
      nextErrors.customerEmail = 'Enter an email for this reservation.'
    } else if (!isValidEmail(customerEmail)) {
      nextErrors.customerEmail = 'Enter a valid email address.'
    }

    if (!form.itineraryStartDate) {
      nextErrors.itineraryStartDate = 'Choose a start date.'
    }

    if (!form.itineraryEndDate) {
      nextErrors.itineraryEndDate = 'Choose an end date.'
    } else if (form.itineraryStartDate && form.itineraryEndDate < form.itineraryStartDate) {
      nextErrors.itineraryEndDate = 'Choose an end date after the start date.'
    }

    return nextErrors
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const nextErrors = validate()
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    onSubmit({
      customerName: normalizeText(form.customerName),
      customerEmail: normalizeText(form.customerEmail),
      itineraryStartDate: form.itineraryStartDate,
      itineraryEndDate: form.itineraryEndDate,
    })
  }

  const isComplete = form.itineraryStartDate
    && form.itineraryEndDate
    && form.itineraryEndDate >= form.itineraryStartDate

  return (
    <section
      className="customer-context"
      {...(showHeader ? { 'aria-labelledby': 'customer-context-title' } : { 'aria-label': title })}
    >
      <form className="customer-context-form" onSubmit={handleSubmit} noValidate>
        {showHeader ? (
          <div>
            <h2 id="customer-context-title">{title}</h2>
            <p>{description}</p>
          </div>
        ) : null}
        <div className="reservation-contact">
          {displayName && displayEmail && !isEditingContact ? (
            <p className="reservation-contact-value reservation-contact-line">
              <span>{displayName} - {displayEmail}.</span>
              <button
                type="button"
                className="link-action"
                onClick={() => setIsEditingContact(true)}
              >
                Edit...
              </button>
            </p>
          ) : null}
          {(!displayName || !displayEmail) && !isEditingContact ? (
            <>
              <p className="reservation-contact-value">
                Add a name and email before saving this itinerary.
              </p>
              <button
                type="button"
                className="link-action"
                onClick={() => setIsEditingContact(true)}
              >
                Add reservation contact
              </button>
            </>
          ) : null}
        </div>
        {isEditingContact ? (
          <>
            <label>
              Name
              <input
                value={form.customerName}
                onChange={(event) => updateField('customerName', event.target.value)}
                autoComplete="name"
                aria-invalid={errors.customerName ? 'true' : undefined}
                aria-describedby={errors.customerName ? 'customer-name-error' : undefined}
              />
              {errors.customerName ? (
                <span className="field-error" id="customer-name-error">{errors.customerName}</span>
              ) : null}
            </label>
            <label>
              Email
              <input
                type="email"
                value={form.customerEmail}
                onChange={(event) => updateField('customerEmail', event.target.value)}
                autoComplete="email"
                aria-invalid={errors.customerEmail ? 'true' : undefined}
                aria-describedby={errors.customerEmail ? 'customer-email-error' : undefined}
              />
              {errors.customerEmail ? (
                <span className="field-error" id="customer-email-error">{errors.customerEmail}</span>
              ) : null}
            </label>
            <button
              type="button"
              className="link-action"
              onClick={() => setIsEditingContact(false)}
            >
              Done
            </button>
          </>
        ) : (
          <>
            <input
              type="hidden"
              name="customerName"
              value={form.customerName}
              readOnly
            />
            <input
              type="hidden"
              name="customerEmail"
              value={form.customerEmail}
              readOnly
            />
          </>
        )}
        <div className="itinerary-date-summary">
          <span>Itinerary dates from</span>
          <button
            type="button"
            className="link-action date-link-action"
            onClick={() => openDatePicker(startDateRef)}
          >
            {formatDisplayDate(form.itineraryStartDate)}
          </button>
          <span>to</span>
          <button
            type="button"
            className="link-action date-link-action"
            onClick={() => openDatePicker(endDateRef)}
          >
            {formatDisplayDate(form.itineraryEndDate)}
          </button>
          <input
            ref={startDateRef}
            className="date-picker-input"
            type="date"
            aria-label="Start date"
            value={form.itineraryStartDate}
            min={todayIsoDate()}
            onChange={(event) => updateField('itineraryStartDate', event.target.value)}
            aria-invalid={errors.itineraryStartDate ? 'true' : undefined}
            aria-describedby={errors.itineraryStartDate ? 'itinerary-start-date-error' : undefined}
            required
          />
          <input
            ref={endDateRef}
            className="date-picker-input"
            type="date"
            aria-label="End date"
            value={form.itineraryEndDate}
            min={form.itineraryStartDate}
            onChange={(event) => updateField('itineraryEndDate', event.target.value)}
            aria-invalid={errors.itineraryEndDate ? 'true' : undefined}
            aria-describedby={errors.itineraryEndDate ? 'itinerary-end-date-error' : undefined}
            required
          />
          {errors.itineraryStartDate ? (
            <span className="field-error" id="itinerary-start-date-error">{errors.itineraryStartDate}</span>
          ) : null}
          {errors.itineraryEndDate ? (
            <span className="field-error" id="itinerary-end-date-error">{errors.itineraryEndDate}</span>
          ) : null}
        </div>
        <button type="submit" className="primary-action" disabled={!isComplete}>
          {submitLabel}
        </button>
      </form>
    </section>
  )
}

export default CustomerContextForm
