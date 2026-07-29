import { useMemo, useState } from 'react'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
})
const averageCostFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
})
const countFormatter = new Intl.NumberFormat('en-US')

const BREAKDOWNS = [
  { id: 'feature', label: 'Feature', rowsKey: 'byFeature', valueKey: 'feature' },
  { id: 'model', label: 'Model', rowsKey: 'byModel', valueKey: 'model' },
  { id: 'plan', label: 'Plan', rowsKey: 'byPlan', valueKey: 'plan' },
  { id: 'user', label: 'User', rowsKey: 'byUser', valueKey: 'userId' },
]

const FEATURE_LABELS = {
  chat: 'Chat',
  embedding: 'RAG embeddings',
  identification: 'Bird identification',
  image_analysis: 'Vision analysis',
  voice: 'Voice',
}

function rowLabel(row, breakdown) {
  const value = String(row?.[breakdown.valueKey] || 'Unknown')

  if (breakdown.id === 'feature') {
    return FEATURE_LABELS[value] || value.replaceAll('_', ' ')
  }

  if (breakdown.id === 'user') {
    return `User ${value}`
  }

  return value.replaceAll('_', ' ')
}

function CostBreakdownTable({ breakdown, rows }) {
  const maximum = Math.max(...rows.map((row) => Number(row.estimatedCost || 0)), 0)

  if (rows.length === 0) {
    return <p className="admin-empty-state">No cost data is available for this breakdown.</p>
  }

  return (
    <div className="admin-cost-table-wrap">
      <table className="admin-cost-table">
        <caption className="sr-only">AI cost by {breakdown.label.toLowerCase()}</caption>
        <thead>
          <tr>
            <th scope="col">{breakdown.label}</th>
            <th scope="col">Requests</th>
            <th scope="col">Tokens</th>
            <th scope="col">Estimated cost</th>
            <th scope="col">Avg. / request</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const estimatedCost = Number(row.estimatedCost || 0)
            const width = maximum > 0
              ? Math.max((estimatedCost / maximum) * 100, estimatedCost > 0 ? 2 : 0)
              : 0
            const label = rowLabel(row, breakdown)

            return (
              <tr key={`${String(row?.[breakdown.valueKey] || 'unknown')}-${index}`}>
                <th scope="row">
                  <span>{label}</span>
                  {breakdown.id === 'user' && row.plan && <small>{row.plan}</small>}
                </th>
                <td>{countFormatter.format(Number(row.requests || 0))}</td>
                <td>{countFormatter.format(Number(row.tokens || 0))}</td>
                <td>
                  <span className="admin-cost-value">{currencyFormatter.format(estimatedCost)}</span>
                  <span className="admin-cost-track" aria-hidden="true">
                    <span style={{ width: `${width}%` }} />
                  </span>
                </td>
                <td>{averageCostFormatter.format(Number(row.averageCostPerRequest || 0))}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function CostChart({ data, showTotal = true }) {
  const availableBreakdowns = useMemo(
    () => BREAKDOWNS.filter(({ rowsKey }) => Array.isArray(data?.[rowsKey])),
    [data]
  )
  const [selectedId, setSelectedId] = useState('feature')
  const selectedBreakdown = availableBreakdowns.find(({ id }) => id === selectedId)
    || availableBreakdowns[0]
    || BREAKDOWNS[0]
  const rows = Array.isArray(data?.[selectedBreakdown.rowsKey])
    ? data[selectedBreakdown.rowsKey]
    : []
  const unpricedRequests = Number(data?.totals?.unpricedRequests || 0)

  return (
    <section className="admin-panel admin-cost-panel" aria-labelledby="admin-cost-title">
      <header className="admin-panel-header">
        <div>
          <p className="admin-eyebrow">Estimated spend</p>
          <h3 id="admin-cost-title">AI cost</h3>
        </div>
        {showTotal && (
          <strong>{currencyFormatter.format(Number(data?.totals?.estimatedCost || 0))}</strong>
        )}
      </header>

      <dl className="admin-cost-summary">
        <div>
          <dt>Requests</dt>
          <dd>{countFormatter.format(Number(data?.totals?.requests || 0))}</dd>
        </div>
        <div>
          <dt>Tokens</dt>
          <dd>{countFormatter.format(Number(data?.totals?.tokens || 0))}</dd>
        </div>
        <div>
          <dt>Avg. / request</dt>
          <dd>{averageCostFormatter.format(Number(data?.totals?.averageCostPerRequest || 0))}</dd>
        </div>
      </dl>

      <div className="admin-cost-tabs" role="tablist" aria-label="AI cost breakdown">
        {availableBreakdowns.map((breakdown) => (
          <button
            aria-controls="admin-cost-breakdown"
            aria-selected={selectedBreakdown.id === breakdown.id}
            key={breakdown.id}
            onClick={() => setSelectedId(breakdown.id)}
            role="tab"
            type="button"
          >
            {breakdown.label}
          </button>
        ))}
      </div>

      <div id="admin-cost-breakdown" role="tabpanel">
        <CostBreakdownTable breakdown={selectedBreakdown} rows={rows} />
      </div>

      {unpricedRequests > 0 && (
        <p className="admin-panel-note">
          {unpricedRequests} request{unpricedRequests === 1 ? '' : 's'} without pricing data
        </p>
      )}
    </section>
  )
}

export { CostBreakdownTable }
export default CostChart
