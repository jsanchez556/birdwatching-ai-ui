import MetricBarChart from './MetricBarChart'

const countFormatter = new Intl.NumberFormat('en-US')

function UsageChart({ data }) {
  const rows = Array.isArray(data?.byFeature) ? data.byFeature : []

  return (
    <section className="admin-panel" aria-labelledby="admin-usage-title">
      <header className="admin-panel-header">
        <div>
          <p className="admin-eyebrow">AI operations</p>
          <h3 id="admin-usage-title">AI usage</h3>
        </div>
        <strong>{countFormatter.format(Number(data?.totals?.requests || 0))} requests</strong>
      </header>
      <MetricBarChart
        ariaLabel="AI requests by feature"
        emptyMessage="No AI usage was recorded in this range."
        formatValue={(value) => countFormatter.format(value)}
        rows={rows}
        valueKey="requests"
      />
    </section>
  )
}

export default UsageChart
