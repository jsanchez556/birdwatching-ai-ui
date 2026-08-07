import { useEffect, useRef, useState } from 'react'

const CONFIRM_LABELS = {
  retry: 'Retry job',
  suspend: 'Suspend user',
  disable: 'Disable feature',
  enable: 'Enable feature',
  unsuspend: 'Reactivate user',
  role: 'Change role',
}

const TITLES = {
  retry: 'Retry failed job',
  suspend: 'Suspend user',
  disable: 'Temporarily disable AI feature',
  enable: 'Enable AI feature',
  unsuspend: 'Reactivate user',
  role: 'Change user role',
}

const REASONS = [
  ['abuse', 'Abuse'],
  ['spam', 'Spam'],
  ['security', 'Security'],
  ['policy_violation', 'Policy violation'],
]

const DURATIONS = [
  ['15', '15 minutes'],
  ['60', '1 hour'],
  ['240', '4 hours'],
  ['1440', '24 hours'],
  ['custom', 'Custom duration'],
]

const localDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function AdminOperationDialog({
  operation,
  operationState,
  onCancel,
  onConfirm,
  returnFocusRef,
}) {
  const cancelRef = useRef(null)
  const pendingRef = useRef(false)
  const [reasonCode, setReasonCode] = useState('')
  const [durationChoice, setDurationChoice] = useState('')
  const [customDuration, setCustomDuration] = useState('')
  const [validationError, setValidationError] = useState(null)
  const isPending = operationState.status === 'pending'
  const isSuccess = operationState.status === 'success'
  pendingRef.current = isPending

  useEffect(() => {
    cancelRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !pendingRef.current) {
        event.preventDefault()
        onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      returnFocusRef.current?.focus()
    }
  }, [onCancel, returnFocusRef])

  const handleSubmit = (event) => {
    event.preventDefault()
    setValidationError(null)

    if (operation.type === 'suspend' && !reasonCode) {
      setValidationError('Select a suspension reason.')
      return
    }

    let durationMinutes
    if (operation.type === 'disable') {
      durationMinutes = Number(
        durationChoice === 'custom' ? customDuration : durationChoice
      )
      if (
        !Number.isInteger(durationMinutes)
        || durationMinutes < 1
        || durationMinutes > 1440
      ) {
        setValidationError('Enter a duration from 1 to 1440 minutes.')
        return
      }
    }

    onConfirm({
      reasonCode,
      durationMinutes,
    })
  }

  const result = operationState.result
  const disabledUntil = result?.feature?.disabledUntil

  return (
    <div className="admin-operation-backdrop" role="presentation">
      <section
        className="admin-operation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-operation-title"
        aria-describedby="admin-operation-impact"
      >
        <header>
          <p className="admin-eyebrow">Confirmation required</p>
          <h2 id="admin-operation-title">{TITLES[operation.type]}</h2>
        </header>

        <dl className="admin-operation-summary">
          <div>
            <dt>Target</dt>
            <dd>{operation.targetLabel}</dd>
          </div>
          <div>
            <dt>Expected impact</dt>
            <dd id="admin-operation-impact">{operation.impact}</dd>
          </div>
        </dl>

        {isSuccess ? (
          <div className="admin-operation-success" role="status" aria-live="polite">
            <strong>{operation.successMessage}</strong>
            {disabledUntil && (
              <p>
                Normal operation resumes at{' '}
                <time dateTime={disabledUntil}>
                  {localDateFormatter.format(new Date(disabledUntil))}
                </time>.
              </p>
            )}
            <p>Audit reference: <code>{result.auditId}</code></p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            {operation.type === 'suspend' && (
              <label className="admin-operation-field">
                <span>Suspension reason</span>
                <select
                  value={reasonCode}
                  onChange={(event) => setReasonCode(event.target.value)}
                  disabled={isPending}
                  required
                >
                  <option value="">Select a reason</option>
                  {REASONS.map(([value, label]) => (
                    <option value={value} key={value}>{label}</option>
                  ))}
                </select>
              </label>
            )}

            {operation.type === 'disable' && (
              <>
                <label className="admin-operation-field">
                  <span>Disable duration</span>
                  <select
                    value={durationChoice}
                    onChange={(event) => setDurationChoice(event.target.value)}
                    disabled={isPending}
                    required
                  >
                    <option value="">Select a duration</option>
                    {DURATIONS.map(([value, label]) => (
                      <option value={value} key={value}>{label}</option>
                    ))}
                  </select>
                </label>
                {durationChoice === 'custom' && (
                  <label className="admin-operation-field">
                    <span>Custom duration in minutes</span>
                    <input
                      type="number"
                      min="1"
                      max="1440"
                      step="1"
                      value={customDuration}
                      onChange={(event) => setCustomDuration(event.target.value)}
                      disabled={isPending}
                      required
                    />
                  </label>
                )}
              </>
            )}

            {(validationError || operationState.error) && (
              <div className="admin-operation-error" role="alert">
                <strong>Action not completed</strong>
                <p>{validationError || operationState.error}</p>
                {operationState.retryable && (
                  <p>Check the current status, then use the confirmation button to retry.</p>
                )}
              </div>
            )}

            {isPending && (
              <p className="admin-operation-pending" role="status" aria-live="polite">
                {CONFIRM_LABELS[operation.type]} in progress. Do not close this dialog.
              </p>
            )}

            <div className="admin-operation-actions">
              <button
                type="button"
                className="admin-operation-cancel"
                onClick={onCancel}
                disabled={isPending}
                ref={cancelRef}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="admin-operation-confirm"
                disabled={isPending || operationState.authorizationFailure}
              >
                {isPending ? 'Working…' : CONFIRM_LABELS[operation.type]}
              </button>
            </div>
          </form>
        )}

        {isSuccess && (
          <div className="admin-operation-actions">
            <button
              type="button"
              className="admin-operation-cancel"
              onClick={onCancel}
              ref={cancelRef}
            >
              Close
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

export { CONFIRM_LABELS, DURATIONS, REASONS }
export default AdminOperationDialog
