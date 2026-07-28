function KpiCard({ label, value, detail, tone = 'default' }) {
  return (
    <article className={`admin-kpi-card admin-kpi-${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
      {detail && <span>{detail}</span>}
    </article>
  )
}

export default KpiCard
