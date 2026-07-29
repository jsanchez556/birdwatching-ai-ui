const countFormatter = new Intl.NumberFormat('en-US')
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

function SubscriptionSummary({
  activeSubscriptions = 0,
  mrr = 0,
  subscriptions,
  showTotals = true,
}) {
  const rows = Array.isArray(subscriptions?.data) ? subscriptions.data : []
  const statuses = rows.reduce((summary, subscription) => {
    const status = subscription.status || 'unknown'
    summary[status] = (summary[status] || 0) + 1
    return summary
  }, {})

  return (
    <section className="admin-panel" aria-labelledby="admin-subscriptions-title">
      <header className="admin-panel-header">
        <div>
          <p className="admin-eyebrow">Billing</p>
          <h3 id="admin-subscriptions-title">Subscriptions</h3>
        </div>
      </header>
      {showTotals && (
        <div className="admin-summary-pair">
          <div>
            <span>Active</span>
            <strong>{countFormatter.format(activeSubscriptions)}</strong>
          </div>
          <div>
            <span>MRR</span>
            <strong>{currencyFormatter.format(mrr)}</strong>
          </div>
        </div>
      )}
      <ul className="admin-status-list">
        {Object.entries(statuses).map(([status, count]) => (
          <li key={status}>
            <span className={`admin-status-dot is-${status}`} aria-hidden="true" />
            <span>{status.replaceAll('_', ' ')}</span>
            <strong>{countFormatter.format(count)}</strong>
          </li>
        ))}
      </ul>
      {rows.length === 0 && <p className="admin-empty-state">No subscriptions found.</p>}
      {Number(subscriptions?.meta?.total || 0) > rows.length && (
        <p className="admin-panel-note">Status mix reflects the first {rows.length} subscriptions.</p>
      )}
    </section>
  )
}

export default SubscriptionSummary
