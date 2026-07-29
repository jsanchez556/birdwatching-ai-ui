const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

function formatOccurredAt(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Time unavailable' : dateFormatter.format(date)
}

function RecentErrors({ failures }) {
  const rows = Array.isArray(failures?.data) ? failures.data : []

  return (
    <section className="admin-panel admin-errors-panel" aria-labelledby="admin-errors-title">
      <header className="admin-panel-header">
        <div>
          <p className="admin-eyebrow">Attention needed</p>
          <h2 id="admin-errors-title">Recent errors</h2>
        </div>
        <strong>{Number(failures?.meta?.total || rows.length)} total</strong>
      </header>
      {rows.length > 0 ? (
        <ul className="admin-error-list">
          {rows.map((failure) => (
            <li key={failure.id}>
              <span className={`admin-error-mark is-${failure.category}`} aria-hidden="true">!</span>
              <div>
                <strong>{failure.error?.message || 'Operational failure'}</strong>
                <p>{failure.type || failure.category || 'Unknown category'}</p>
              </div>
              <time dateTime={failure.occurredAt}>
                {formatOccurredAt(failure.occurredAt)}
              </time>
            </li>
          ))}
        </ul>
      ) : (
        <p className="admin-empty-state">No recent failures.</p>
      )}
    </section>
  )
}

export default RecentErrors
