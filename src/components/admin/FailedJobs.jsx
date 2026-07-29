const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function FailedJobs({
  failures,
  getOperationState,
  onRetry,
}) {
  const jobs = Array.isArray(failures?.data)
    ? failures.data.filter((failure) => (
      failure.category === 'background_job' && failure.status === 'failed'
    ))
    : []

  return (
    <section className="admin-panel admin-failed-jobs" aria-labelledby="admin-failed-jobs-title">
      <header className="admin-panel-header">
        <div>
          <p className="admin-eyebrow">Recovery actions</p>
          <h3 id="admin-failed-jobs-title">Failed jobs</h3>
        </div>
        <strong>{jobs.length} shown</strong>
      </header>
      {jobs.length ? (
        <ul className="admin-operation-list">
          {jobs.map((job) => {
            const state = getOperationState('retry', job.id)
            const completed = state.status === 'success'
            return (
              <li key={job.id}>
                <div>
                  <strong>{job.type.replaceAll('-', ' ')}</strong>
                  <p>Job {job.id}</p>
                  <time dateTime={job.occurredAt}>
                    Failed {dateFormatter.format(new Date(job.occurredAt))}
                  </time>
                </div>
                <button
                  type="button"
                  className="admin-danger-action"
                  disabled={state.status === 'pending' || completed}
                  onClick={(event) => onRetry(job, event.currentTarget)}
                  aria-label={`Retry failed job ${job.id}`}
                >
                  {state.status === 'pending' ? 'Retrying…' : completed ? 'Retry requested' : 'Retry job'}
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="admin-empty-state">No retained failed jobs are available to retry.</p>
      )}
    </section>
  )
}

export default FailedJobs
