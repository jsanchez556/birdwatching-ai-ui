const percentFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const pointFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: 'always',
})

function deltaState(delta) {
  if (delta === null) {
    return {
      className: 'is-unavailable',
      label: 'Comparison unavailable',
      detail: 'A percentage-point change needs evaluation data in both periods.',
    }
  }

  if (delta > 0) {
    return {
      className: 'is-positive',
      label: `${pointFormatter.format(delta * 100)} pp`,
      detail: `Improved by ${Math.abs(delta * 100).toFixed(1)} percentage points from the previous period.`,
    }
  }

  if (delta < 0) {
    return {
      className: 'is-negative',
      label: `${pointFormatter.format(delta * 100)} pp`,
      detail: `Decreased by ${Math.abs(delta * 100).toFixed(1)} percentage points from the previous period.`,
    }
  }

  return {
    className: 'is-unchanged',
    label: '0.0 pp',
    detail: 'Unchanged from the previous period.',
  }
}

function QualityMetric({ label, metric }) {
  const change = deltaState(metric.delta)
  const hasCurrent = metric.current !== null

  return (
    <article className="admin-quality-metric" aria-label={`${label} quality metric`}>
      <p>{label}</p>
      {hasCurrent ? (
        <strong>{percentFormatter.format(metric.current)}</strong>
      ) : (
        <strong className="admin-quality-unavailable">No evaluation data</strong>
      )}
      <span className={`admin-quality-delta ${change.className}`}>
        {change.label}
      </span>
      <span className="admin-quality-change-detail">{change.detail}</span>
      <dl>
        <div>
          <dt>Previous</dt>
          <dd>
            {metric.previous === null
              ? 'No evaluation data'
              : percentFormatter.format(metric.previous)}
          </dd>
        </div>
        <div>
          <dt>Samples</dt>
          <dd>{metric.currentSampleSize} current · {metric.previousSampleSize} previous</dd>
        </div>
      </dl>
    </article>
  )
}

function AiQualitySummary({ data }) {
  const metrics = data.metrics
  const available = data.qualityStatus === 'available'
  const model = data.provenance?.modelIdentifier || 'unknown model'
  const prompt = data.provenance?.promptVersion || 'unknown prompt version'

  return (
    <section className="admin-panel admin-quality-panel" aria-labelledby="admin-quality-title">
      <header className="admin-panel-header">
        <div>
          <p className="admin-eyebrow">Offline evaluations</p>
          <h3 id="admin-quality-title">Portfolio regression quality</h3>
        </div>
      </header>
      {!available && (
        <p role="status" className="admin-panel-note">
          Quality unavailable: {data.unavailableReason}
        </p>
      )}
      {available && <div className="admin-quality-groups">
        <section aria-labelledby="admin-answer-quality-title">
          <h4 id="admin-answer-quality-title">Quality</h4>
          <div className="admin-quality-grid">
            <QualityMetric label="Grounding score" metric={metrics.groundingScore} />
            <QualityMetric label="Answer relevance" metric={metrics.answerRelevance} />
          </div>
        </section>
        <section aria-labelledby="admin-retrieval-quality-title">
          <h4 id="admin-retrieval-quality-title">Retrieval</h4>
          <QualityMetric label="Retrieval quality" metric={metrics.retrievalQuality} />
        </section>
        <section aria-labelledby="admin-tools-quality-title">
          <h4 id="admin-tools-quality-title">Tools</h4>
          <QualityMetric label="Tool success rate" metric={metrics.toolSuccessRate} />
        </section>
      </div>}
      <p className="admin-panel-note">
        {available
          ? `Validated real-pipeline outputs · ${model} · ${prompt}. Current and previous periods use UTC half-open intervals.`
          : 'No model, RAG, or production quality score is shown without validated real-pipeline outputs.'}
      </p>
      <p className="admin-panel-note">
        Synthetic scorer self-test — not model or RAG quality. Excluded from these metrics.
      </p>
    </section>
  )
}

export { QualityMetric, deltaState }
export default AiQualitySummary
