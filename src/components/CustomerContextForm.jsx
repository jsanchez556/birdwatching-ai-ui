import { useState } from 'react'

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function CustomerContextForm({ onSubmit, authUser }) {
  const lockedEmail = authUser?.email || ''
  const [form, setForm] = useState({
    customerName: authUser?.name || '',
    customerEmail: lockedEmail,
    itineraryStartDate: todayIsoDate(),
    itineraryEndDate: todayIsoDate(),
  })

  const updateField = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'itineraryStartDate' && prev.itineraryEndDate < value
        ? { itineraryEndDate: value }
        : {}),
    }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    onSubmit({
      customerName: form.customerName.trim(),
      customerEmail: lockedEmail || form.customerEmail.trim(),
      itineraryStartDate: form.itineraryStartDate,
      itineraryEndDate: form.itineraryEndDate,
    })
  }

  const isComplete = form.customerName.trim()
    && (lockedEmail || form.customerEmail.trim())
    && form.itineraryStartDate
    && form.itineraryEndDate
    && form.itineraryEndDate >= form.itineraryStartDate

  return (
    <section className="customer-context" aria-labelledby="customer-context-title">
      <form className="customer-context-form" onSubmit={handleSubmit}>
        <div>
          <h2 id="customer-context-title">Plan your birding chat</h2>
          <p>Start with your contact details and itinerary dates so bookings stay accurate.</p>
        </div>
        <label>
          Name
          <input
            value={form.customerName}
            onChange={(event) => updateField('customerName', event.target.value)}
            autoComplete="name"
            required
          />
        </label>
        <label>
          Email
          {lockedEmail ? (
            <input
              type="email"
              value={lockedEmail}
              autoComplete="email"
              readOnly
            />
          ) : (
            <input
              type="email"
              value={form.customerEmail}
              onChange={(event) => updateField('customerEmail', event.target.value)}
              autoComplete="email"
              required
            />
          )}
        </label>
        <div className="date-grid">
          <label>
            Start date
            <input
              type="date"
              value={form.itineraryStartDate}
              min={todayIsoDate()}
              onChange={(event) => updateField('itineraryStartDate', event.target.value)}
              required
            />
          </label>
          <label>
            End date
            <input
              type="date"
              value={form.itineraryEndDate}
              min={form.itineraryStartDate}
              onChange={(event) => updateField('itineraryEndDate', event.target.value)}
              required
            />
          </label>
        </div>
        <button type="submit" className="primary-action" disabled={!isComplete}>
          Start chat
        </button>
      </form>
    </section>
  )
}

export default CustomerContextForm
