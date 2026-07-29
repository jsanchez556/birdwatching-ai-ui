const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const TYPE_LABELS = {
  LLM_ERROR: 'LLM error',
  TOOL_ERROR: 'Tool error',
  RETRIEVAL_ERROR: 'Retrieval error',
  INVALID_OUTPUT: 'Invalid output',
  QUEUE_FAILURE: 'Queue failure',
  RATE_LIMIT: 'Rate limit',
  PAYMENT_FAILURE: 'Payment failure',
}

function formatTimestamp(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Time unavailable' : dateFormatter.format(date)
}

function formatStatus(value) {
  return String(value || 'failed').replaceAll('_', ' ')
}

function shortenTraceId(value) {
  if (!value) return null
  return value.length > 14 ? `${value.slice(0, 12)}…` : value
}

function OperationalErrors({ errors }) {
  const rows = Array.isArray(errors?.data?.errors) ? errors.data.errors : []

  return (
    <section className="admin-panel admin-errors-panel" aria-labelledby="operational-errors-title">
      <header className="admin-panel-header">
        <div>
          <p className="admin-eyebrow">Attention needed</p>
          <h3 id="operational-errors-title">Errors</h3>
        </div>
        <strong>{Number(errors?.meta?.total || rows.length)} total</strong>
      </header>
      {rows.length > 0 ? (
        <ul className="admin-operational-error-list">
          {rows.map((error) => (
            <li key={error.id}>
              <div className="admin-operational-error-heading">
                <strong>{TYPE_LABELS[error.type] || error.type}</strong>
                <span className={`admin-error-status is-${error.status}`}>
                  {formatStatus(error.status)}
                </span>
              </div>
              <p className="admin-operational-error-message">{error.message}</p>
              <div className="admin-operational-error-meta">
                <span>{error.user?.label || 'System'}</span>
                <time dateTime={error.timestamp}>{formatTimestamp(error.timestamp)}</time>
              </div>
              <div className="admin-trace-row">
                {error.traceId ? (
                  <span title={error.traceId}>Trace: {shortenTraceId(error.traceId)}</span>
                ) : (
                  <span>Trace unavailable</span>
                )}
                {error.traceUrl ? (
                  <a
                    href={error.traceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open trace ${error.traceId} in LangSmith`}
                  >
                    Open Trace
                  </a>
                ) : error.traceId ? (
                  <span>Trace unavailable</span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="admin-empty-state">No operational errors in this reporting range.</p>
      )}
    </section>
  )
}

export { TYPE_LABELS, formatTimestamp, shortenTraceId }
export default OperationalErrors
