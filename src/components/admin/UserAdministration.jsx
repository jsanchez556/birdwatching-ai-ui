function userLabel(user) {
  return user.name?.trim() || `User ${user.id}`
}

function UserAdministration({
  users,
  currentUserId,
  getOperationState,
  onSuspend,
  onUnsuspend,
  onChangeRole,
  getAccessToken,
}) {
  const directory = useAdminUsers({ getAccessToken, initialResult: users })
  const rows = Array.isArray(directory.result?.data) ? directory.result.data : []
  const [searchInput, setSearchInput] = useState('')
  const [roleSelections, setRoleSelections] = useState({})

  return (
    <section className="admin-panel admin-user-admin" aria-labelledby="admin-users-title">
      <header className="admin-panel-header">
        <div>
          <p className="admin-eyebrow">Account safety</p>
          <h3 id="admin-users-title">User administration</h3>
        </div>
        <strong>{Number(directory.result?.meta?.total || rows.length)} total</strong>
      </header>
      <form className="maintenance-search" role="search" onSubmit={(event) => { event.preventDefault(); directory.load({ page: 1, query: searchInput.trim() }) }}>
        <label><span>Search users</span><input type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /></label>
        <button type="submit">Search</button>
      </form>
      {directory.status === 'loading' && <p role="status">Loading users…</p>}
      {directory.status === 'error' && <div role="alert" className="admin-alert"><p>{directory.error}</p><button type="button" onClick={() => directory.load()}>Retry</button></div>}
      {rows.length ? (
        <ul className="admin-operation-list">
          {rows.map((user) => {
            const protectedUser = user.role === 'admin' || user.id === String(currentUserId)
            const suspended = user.status === 'suspended'
            const state = getOperationState(suspended ? 'unsuspend' : 'suspend', user.id)
            const roleState = getOperationState('role', user.id)
            const selectedRole = roleSelections[user.id] || user.role
            return (
              <li key={user.id}>
                <div>
                  <strong>{userLabel(user)}</strong>
                  <p>User {user.id} · {user.plan} · {user.role}</p>
                  <p>Account: {suspended ? 'Suspended' : 'Active'} · Authorization role: {userRoleLabel(user.role)}</p>
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
                <div className="admin-role-editor">
                  <label><span>Role for {userLabel(user)}</span><select value={selectedRole} disabled={user.id === String(currentUserId) || roleState.status === 'pending'} onChange={(event) => setRoleSelections((current) => ({ ...current, [user.id]: event.target.value }))}>{USER_ROLE_VALUES.map((role) => <option value={role} key={role}>{userRoleLabel(role)}</option>)}</select></label>
                  <button type="button" disabled={selectedRole === user.role || user.id === String(currentUserId) || roleState.status === 'pending'} onClick={(event) => onChangeRole(user, selectedRole, event.currentTarget)}>{roleState.status === 'pending' ? 'Changing…' : 'Change role'}</button>
                  {user.id === String(currentUserId) && <small>Your own administrator role is protected.</small>}
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
        directory.status === 'success' && <p className="admin-empty-state">No users match this search.</p>
      )}
      {Number(directory.result?.meta?.totalPages || 0) > 1 && <nav className="maintenance-pagination" aria-label="User pages"><button type="button" disabled={directory.result.meta.page <= 1} onClick={() => directory.load({ page: directory.result.meta.page - 1 })}>Previous</button><span>Page {directory.result.meta.page} of {directory.result.meta.totalPages}</span><button type="button" disabled={directory.result.meta.page >= directory.result.meta.totalPages} onClick={() => directory.load({ page: directory.result.meta.page + 1 })}>Next</button></nav>}
    </section>
  )
}

export { userLabel }
export default UserAdministration
import { useState } from 'react'
import useAdminUsers from '../../hooks/useAdminUsers'
import { USER_ROLE_VALUES, userRoleLabel } from '../../constants/userRoles'
