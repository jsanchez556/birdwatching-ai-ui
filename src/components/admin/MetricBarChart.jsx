function MetricBarChart({
  ariaLabel,
  emptyMessage,
  formatValue,
  rows,
  valueKey,
}) {
  const maximum = Math.max(...rows.map((row) => Number(row[valueKey] || 0)), 0)

  if (rows.length === 0) {
    return <p className="admin-empty-state">{emptyMessage}</p>
  }

  return (
    <div className="admin-bar-chart" role="img" aria-label={ariaLabel}>
      {rows.map((row) => {
        const value = Number(row[valueKey] || 0)
        const width = maximum > 0 ? Math.max((value / maximum) * 100, value > 0 ? 2 : 0) : 0

        return (
          <div className="admin-bar-row" key={row.feature}>
            <div className="admin-bar-label">
              <span>{String(row.feature || 'Unknown').replaceAll('_', ' ')}</span>
              <strong>{formatValue(value)}</strong>
            </div>
            <div className="admin-bar-track" aria-hidden="true">
              <span style={{ width: `${width}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default MetricBarChart
