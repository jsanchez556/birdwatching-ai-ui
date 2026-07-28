import MetricBarChart from './MetricBarChart'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
})

function CostChart({ data }) {
  const rows = Array.isArray(data?.byFeature) ? data.byFeature : []
  const unpricedRequests = Number(data?.totals?.unpricedRequests || 0)

  return (
    <section className="admin-panel" aria-labelledby="admin-cost-title">
      <header className="admin-panel-header">
        <div>
          <p className="admin-eyebrow">Estimated spend</p>
          <h2 id="admin-cost-title">AI cost</h2>
        </div>
        <strong>{currencyFormatter.format(Number(data?.totals?.estimatedCost || 0))}</strong>
      </header>
      <MetricBarChart
        ariaLabel="Estimated AI cost by feature"
        emptyMessage="No estimated AI cost was recorded in this range."
        formatValue={(value) => currencyFormatter.format(value)}
        rows={rows}
        valueKey="estimatedCost"
      />
      {unpricedRequests > 0 && (
        <p className="admin-panel-note">
          {unpricedRequests} request{unpricedRequests === 1 ? '' : 's'} without pricing data
        </p>
      )}
    </section>
  )
}

export default CostChart
