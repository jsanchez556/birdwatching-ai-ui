import CostChart from '../components/admin/CostChart'
import KpiCard from '../components/admin/KpiCard'
import QueueHealth from '../components/admin/QueueHealth'
import RecentErrors from '../components/admin/RecentErrors'
import SubscriptionSummary from '../components/admin/SubscriptionSummary'
import UsageChart from '../components/admin/UsageChart'
import useAdminDashboard from '../hooks/useAdminDashboard'

const countFormatter = new Intl.NumberFormat('en-US')
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
})
const percentFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

function DashboardLoading() {
  return (
    <div className="admin-loading" role="status" aria-label="Loading admin dashboard">
      <div className="admin-kpi-grid">
        {Array.from({ length: 8 }, (_, index) => (
          <div className="admin-skeleton admin-kpi-skeleton" key={index} />
        ))}
      </div>
      <div className="admin-dashboard-grid">
        <div className="admin-skeleton admin-panel-skeleton" />
        <div className="admin-skeleton admin-panel-skeleton" />
      </div>
    </div>
  )
}

function AdminDashboard({ getAccessToken, onBack }) {
  const {
    data,
    error,
    isLoading,
    isRefreshing,
    range,
    rangeOptions,
    refresh,
    setRange,
  } = useAdminDashboard({ getAccessToken })
  const overview = data?.overview

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <button type="button" className="admin-back-action" onClick={onBack}>
            <span aria-hidden="true">←</span> Back to site
          </button>
          <p className="admin-eyebrow">Birdwatching AI</p>
          <h1>Operations dashboard</h1>
          <p>Platform health, usage, billing, and background work.</p>
        </div>
        <div className="admin-toolbar">
          <label>
            <span>Reporting range</span>
            <select value={range} onChange={(event) => setRange(event.target.value)}>
              {rangeOptions.map((option) => (
                <option value={option.value} key={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={refresh} disabled={isRefreshing}>
            {isRefreshing ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
      </header>

      {error && (
        <div className="admin-alert" role="alert">
          <div>
            <strong>Dashboard data is unavailable</strong>
            <p>{error}</p>
          </div>
          <button type="button" onClick={refresh}>Try again</button>
        </div>
      )}

      {isLoading && !data ? (
        <DashboardLoading />
      ) : data ? (
        <>
          {isRefreshing && <p className="admin-refresh-status" role="status">Refreshing dashboard data</p>}
          <section className="admin-kpi-grid" aria-label="Platform overview">
            <KpiCard label="Active users" value={countFormatter.format(overview.activeUsers)} />
            <KpiCard label="Active subscriptions" value={countFormatter.format(overview.activeSubscriptions)} />
            <KpiCard label="Monthly recurring revenue" value={currencyFormatter.format(overview.mrr)} />
            <KpiCard label="Reservations" value={countFormatter.format(overview.reservations)} />
            <KpiCard label="AI requests" value={countFormatter.format(overview.aiRequestsToday)} />
            <KpiCard label="Estimated AI cost" value={currencyFormatter.format(overview.aiCostToday)} />
            <KpiCard label="Average AI latency" value={`${countFormatter.format(overview.averageLatencyMs)} ms`} />
            <KpiCard
              label="AI error rate"
              value={percentFormatter.format(overview.errorRate)}
              tone={overview.errorRate > 0.05 ? 'warning' : 'default'}
            />
          </section>

          <div className="admin-dashboard-grid">
            <UsageChart data={data.usage} />
            <CostChart data={data.costs} />
            <SubscriptionSummary
              activeSubscriptions={overview.activeSubscriptions}
              mrr={overview.mrr}
              subscriptions={data.subscriptions}
            />
            <QueueHealth data={data.queueHealth} />
            <RecentErrors failures={data.failures} />
          </div>
        </>
      ) : null}
    </main>
  )
}

export { DashboardLoading }
export default AdminDashboard
