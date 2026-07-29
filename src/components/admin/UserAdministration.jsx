function userLabel(user) {
  return user.name?.trim() || `User ${user.id}`
}

function UserAdministration({
  users,
  currentUserId,
  getOperationState,
  onSuspend,
  onUnsuspend,
}) {
  const rows = Array.isArray(users?.data) ? users.data : []

  return (
    <section className="admin-panel admin-user-admin" aria-labelledby="admin-users-title">
      <header className="admin-panel-header">
        <div>
          <p className="admin-eyebrow">Account safety</p>
          <h3 id="admin-users-title">User administration</h3>
        </div>
        <strong>{Number(users?.meta?.total || rows.length)} total</strong>
      </header>
      {rows.length ? (
        <ul className="admin-operation-list">
          {rows.map((user) => {
            const protectedUser = user.role === 'admin' || user.id === String(currentUserId)
            const suspended = user.status === 'suspended'
            const state = getOperationState(suspended ? 'unsuspend' : 'suspend', user.id)
            return (
              <li key={user.id}>
                <div>
                  <strong>{userLabel(user)}</strong>
                  <p>User {user.id} · {user.plan} · {user.role}</p>
                  {suspended && (
                    <p role="status">
                      Suspended
                      {user.suspendedAt && (
                        <> since <time dateTime={user.suspendedAt}>
                          {new Intl.DateTimeFormat(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          }).format(new Date(user.suspendedAt))}
                        </time></>
                      )}
                    </p>
                  )}
                </div>
                {protectedUser ? (
                  <span className="admin-protected-label">Protected administrator</span>
                ) : (
                  <button
                    type="button"
                    className={suspended ? 'admin-operation-confirm' : 'admin-danger-action'}
                    disabled={state.status === 'pending'}
                    onClick={(event) => (
                      suspended ? onUnsuspend(user, event.currentTarget) : onSuspend(user, event.currentTarget)
                    )}
                    aria-label={`${suspended ? 'Reactivate' : 'Suspend'} user ${user.id}`}
                  >
                    {state.status === 'pending'
                      ? suspended ? 'Reactivating…' : 'Suspending…'
                      : suspended ? 'Reactivate user' : 'Suspend user'}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="admin-empty-state">No users are available.</p>
      )}
    </section>
  )
}

export { userLabel }
export default UserAdministration
