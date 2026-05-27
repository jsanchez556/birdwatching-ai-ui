import { useEffect, useState, useRef } from 'react'
import { readConsent, writeConsent } from '../../utils/cookies'

function CookieConsent() {
  const initial = readConsent()
  const [consent, setConsent] = useState(initial)
  const [showCustomize, setShowCustomize] = useState(false)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // don't show banner if a choice was already saved
  if (consent && consent.choice) return null

  function acceptAll() {
    const next = {
      choice: 'accepted',
      categories: {
        essential: true,
        analytics: true,
        personalization: true,
        marketing: true,
      },
    }
    const written = writeConsent(next)
    if (mounted.current) setConsent(written)
  }

  function declineNonEssential() {
    const next = {
      choice: 'declined',
      categories: {
        essential: true,
        analytics: false,
        personalization: false,
        marketing: false,
      },
    }
    const written = writeConsent(next)
    if (mounted.current) setConsent(written)
  }

  function openCustomize() {
    setShowCustomize(true)
  }

  function saveCustom(categories) {
    const next = {
      choice: 'customize',
      categories,
    }
    const written = writeConsent(next)
    if (mounted.current) {
      setConsent(written)
      setShowCustomize(false)
    }
  }

  return (
    <>
      <aside className="cookie-consent" aria-label="Cookie consent" role="region">
        <p>
          We use cookies on this site to enhance your user experience. Only essential
          cookies are used before you make a selection. Manage preferences below.
        </p>
        <div className="cookie-actions">
          <button
            type="button"
            className="home-secondary-action"
            onClick={openCustomize}
            aria-haspopup="dialog"
          >
            Customize
          </button>
          <button type="button" className="home-primary-action" onClick={acceptAll}>
            Accept all
          </button>
          <button type="button" className="home-secondary-action" onClick={declineNonEssential}>
            Decline non-essential
          </button>
        </div>
      </aside>

      {showCustomize && (
        <CustomizeDialog
          initialCategories={initial.categories}
          onSave={saveCustom}
          onClose={() => setShowCustomize(false)}
        />
      )}
    </>
  )
}

function CustomizeDialog({ initialCategories, onSave, onClose }) {
  const [categories, setCategories] = useState({ ...initialCategories })
  const dialogRef = useRef(null)

  useEffect(() => {
    const prevActive = document.activeElement
    dialogRef.current?.focus()
    return () => prevActive?.focus()
  }, [])

  function toggle(key) {
    if (key === 'essential') return
    setCategories((s) => ({ ...s, [key]: !s[key] }))
  }

  function handleSave() {
    onSave(categories)
  }

  return (
    <div
      className="cookie-customize-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Customize cookie preferences"
      tabIndex={-1}
      ref={dialogRef}
    >
      <div className="cookie-customize">
        <h2>Customize cookies</h2>
        <p>Choose which types of cookies you allow. Essential cookies are required.</p>
        <ul>
          <li>
            <label>
              <input type="checkbox" checked disabled /> Essential
            </label>
            <div className="muted">Required for core functionality</div>
          </li>
          <li>
            <label>
              <input
                type="checkbox"
                checked={!!categories.analytics}
                onChange={() => toggle('analytics')}
              />
              Analytics
            </label>
            <div className="muted">Helps us understand usage (optional)</div>
          </li>
          <li>
            <label>
              <input
                type="checkbox"
                checked={!!categories.personalization}
                onChange={() => toggle('personalization')}
              />
              Personalization
            </label>
            <div className="muted">Save UI preferences (optional)</div>
          </li>
          <li>
            <label>
              <input
                type="checkbox"
                checked={!!categories.marketing}
                onChange={() => toggle('marketing')}
              />
              Marketing
            </label>
            <div className="muted">Ads and third-party tracking (optional)</div>
          </li>
        </ul>

        <div className="cookie-actions">
          <button type="button" className="home-secondary-action" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="home-primary-action" onClick={handleSave}>
            Save preferences
          </button>
        </div>
      </div>
    </div>
  )
}

export default CookieConsent
