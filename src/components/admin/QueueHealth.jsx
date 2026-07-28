const queueLabels = {
  waiting: 'Waiting',
  active: 'Active',
  failed: 'Failed',
  delayed: 'Delayed',
}

function QueueHealth({ data }) {
  const queues = Array.isArray(data?.queues) ? data.queues : []

  return (
    <section className="admin-panel" aria-labelledby="admin-queues-title">
      <header className="admin-panel-header">
        <div>
          <p className="admin-eyebrow">Background work</p>
          <h2 id="admin-queues-title">Queue status</h2>
        </div>
        <span className={`admin-health-badge is-${data?.status || 'degraded'}`}>
          {data?.status || 'Unavailable'}
        </span>
      </header>
      <div className="admin-queue-list">
        {queues.map((queue) => (
          <article className="admin-queue-item" key={queue.name}>
            <div className="admin-queue-name">
              <strong>{queue.name}</strong>
              <span className={`admin-status-dot is-${queue.status}`} aria-label={queue.status} />
            </div>
            {queue.counts ? (
              <dl>
                {Object.entries(queueLabels).map(([key, label]) => (
                  <div key={key}>
                    <dt>{label}</dt>
                    <dd>{Number(queue.counts[key] || 0)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p>Counts unavailable</p>
            )}
          </article>
        ))}
      </div>
      {queues.length === 0 && <p className="admin-empty-state">No queues are registered.</p>}
    </section>
  )
}

export default QueueHealth
