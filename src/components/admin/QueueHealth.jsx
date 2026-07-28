const queueLabels = {
  waiting: 'Waiting',
  active: 'Running',
  completed: 'Completed',
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
          <h3 id="admin-queues-title">Queues</h3>
        </div>
      </header>
      <div className="admin-queue-list">
        {queues.map((queue) => (
          <article className="admin-queue-item" key={queue.id}>
            <div className="admin-queue-name">
              <strong>{queue.name}</strong>
            </div>
            <dl>
              {Object.entries(queueLabels).map(([key, label]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>{queue[key]}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
      {queues.length === 0 && <p className="admin-empty-state">No queue statistics are available.</p>}
    </section>
  )
}

export default QueueHealth
