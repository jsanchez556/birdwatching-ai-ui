function BillingReturnNotice({ status, onDismiss }) {
  if (status !== 'success' && status !== 'cancelled') {
    return null
  }

  const isSuccess = status === 'success'

  return (
    <div
      className={`billing-return-notice ${isSuccess ? 'is-success' : 'is-cancelled'}`}
      role="status"
      aria-live="polite"
    >
      <div>
        <strong>{isSuccess ? 'Subscription confirmed' : 'Checkout cancelled'}</strong>
        <p>
          {isSuccess
            ? 'Your account plan is being updated.'
            : 'No changes were made to your subscription.'}
        </p>
      </div>
      <button type="button" onClick={onDismiss} aria-label="Dismiss billing notification">
        &times;
      </button>
    </div>
  )
}

export default BillingReturnNotice
