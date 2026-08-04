import KpiCard from './KpiCard'

const countFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 4,
  maximumFractionDigits: 6,
})
const percentFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

function metricDetail(metric) {
  if (metric.status === 'unavailable') return 'No eligible requests in this reporting window.'
  return `${countFormatter.format(metric.numerator)} of ${countFormatter.format(metric.denominator)}`
}

function metricValue(metric, formatter) {
  return metric.status === 'available' ? formatter(metric.value) : 'Unavailable'
}

function ContextEngineeringSummary({ data }) {
  const { metrics, aggregation } = data
  const rateValue = (value) => percentFormatter.format(value)

  return (
    <section className="admin-panel admin-context-engineering" aria-labelledby="admin-context-engineering-title">
      <header className="admin-panel-header">
        <div>
          <p className="admin-eyebrow">Privacy-safe telemetry</p>
          <h3 id="admin-context-engineering-title">Context selection health</h3>
        </div>
      </header>
      <div className="admin-kpi-grid admin-context-kpis">
        <KpiCard
          label="Average input tokens"
          value={metricValue(metrics.averageInputTokens, countFormatter.format)}
          detail={metricDetail(metrics.averageInputTokens)}
        />
        <KpiCard
          label="Context cost per request"
          value={metricValue(metrics.contextCostPerRequest, currencyFormatter.format)}
          detail={metricDetail(metrics.contextCostPerRequest)}
        />
        <KpiCard
          label="RAG context utilization"
          value={metricValue(metrics.ragContextUtilization, rateValue)}
          detail={metricDetail(metrics.ragContextUtilization)}
        />
        <KpiCard
          label="Memory retrieval rate"
          value={metricValue(metrics.memoryRetrievalRate, rateValue)}
          detail={metricDetail(metrics.memoryRetrievalRate)}
        />
        <KpiCard
          label="Compaction frequency"
          value={metricValue(metrics.compactionFrequency, rateValue)}
          detail={metricDetail(metrics.compactionFrequency)}
        />
        <KpiCard
          label="Context-related failure rate"
          value={metricValue(metrics.contextRelatedFailureRate, rateValue)}
          detail={metricDetail(metrics.contextRelatedFailureRate)}
          tone={metrics.contextRelatedFailureRate.value > 0 ? 'warning' : 'default'}
        />
      </div>
      <p className="admin-panel-note">
        {aggregation.tokenSemantics === 'actual'
          ? 'Input-token values are provider-reported.'
          : aggregation.tokenSemantics === 'actual_with_estimated_fallback'
            ? 'Input-token values combine provider-reported usage with estimates when usage is unavailable.'
            : 'Input-token values are estimates.'}
        {' '}Cost is an estimate based on the configured model pricing registry.
      </p>
      <p className="admin-panel-note">
        Planning and generation traces are correlated per request; only final-generation context contributes to input-token and utilization metrics.
      </p>
    </section>
  )
}

export default ContextEngineeringSummary
