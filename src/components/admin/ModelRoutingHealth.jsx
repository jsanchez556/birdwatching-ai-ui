const countFormatter = new Intl.NumberFormat('en-US')
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
})
const percentFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

function latency(value) {
  return value === null ? 'Unavailable' : `${countFormatter.format(value)} ms`
}

function Breakdown({ label, rows }) {
  return (
    <section className="admin-routing-breakdown" aria-label={`${label} routing breakdown`}>
      <h4>{label}</h4>
      {rows.length === 0 ? (
        <p className="admin-empty-copy">No executions in this range.</p>
      ) : (
        <div className="admin-table-wrap">
          <table aria-label={`${label} routing breakdown`}>
            <thead>
              <tr>
                <th scope="col">{label}</th>
                <th scope="col">Executions</th>
                <th scope="col">Usable</th>
                <th scope="col">Avg latency</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <th scope="row">{row.key}</th>
                  <td>{countFormatter.format(row.executions)}</td>
                  <td>{percentFormatter.format(row.userVisibleSuccessRate)}</td>
                  <td>{latency(row.averageLatencyMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default function ModelRoutingHealth({ data }) {
  const metrics = [
    ['Execution success', percentFormatter.format(data.executionSuccessRate)],
    ['User-visible success', percentFormatter.format(data.userVisibleSuccessRate)],
    ['P50 latency', latency(data.latencyMs.p50)],
    ['P95 latency', latency(data.latencyMs.p95)],
    ['Retry rate', percentFormatter.format(data.retryRate)],
    ['Fallback rate', percentFormatter.format(data.fallbackRate)],
    ['Schema failures', percentFormatter.format(data.schemaValidationFailureRate)],
    ['Degraded mode', percentFormatter.format(data.degradedModeRate)],
  ]

  return (
    <section className="admin-panel admin-routing-health" aria-labelledby="admin-routing-health-title">
      <header className="admin-panel-header">
        <div>
          <p className="admin-eyebrow">Operational health</p>
          <h3 id="admin-routing-health-title">Model routing</h3>
        </div>
        <span>{countFormatter.format(data.executions)} executions · current replica</span>
      </header>
      <dl className="admin-routing-metrics">
        {metrics.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="admin-routing-usage">
        <p>
          <strong>{countFormatter.format(data.tokens.total)}</strong> tokens
          {' · '}
          <strong>{currencyFormatter.format(data.estimatedCost.total)}</strong> estimated cost
        </p>
        {(data.tokens.unavailableExecutions > 0
          || data.estimatedCost.unavailableExecutions > 0) && (
          <p className="admin-muted">
            Missing token data for {countFormatter.format(data.tokens.unavailableExecutions)}
            {' '}and pricing for {countFormatter.format(data.estimatedCost.unavailableExecutions)}
            {' '}executions.
          </p>
        )}
      </div>
      <div className="admin-routing-breakdowns">
        <Breakdown label="Task category" rows={data.breakdowns.taskCategory} />
        <Breakdown label="Routing tier" rows={data.breakdowns.routingTier} />
        <Breakdown label="Selected model" rows={data.breakdowns.selectedModel} />
        <Breakdown label="Final model" rows={data.breakdowns.finalModel} />
      </div>
    </section>
  )
}
