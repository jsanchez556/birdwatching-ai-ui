function KpiCard({ label, value, accessibleValue, detail, tone = 'default', compact = false }) {
  return (
    <article className={`admin-kpi-card admin-kpi-${tone}${compact ? ' is-compact' : ''}`}>
      <p>{label}</p>
      <strong aria-label={accessibleValue}>{value}</strong>
      {detail && <span>{detail}</span>}
    </article>
  )
}

export default KpiCard
