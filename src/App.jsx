import { lazy, Suspense } from 'react'
import useProductShell from './hooks/useProductShell'
import HomeSurface from './pages/HomeSurface'

const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const MyToursPage = lazy(() => import('./pages/MyToursPage'))
const AuthenticatedChatSurface = lazy(() => (
  import('./pages/ChatSurface').then((module) => ({
    default: module.AuthenticatedChatSurface,
  }))
))

function SurfaceLoading() {
  return (
    <main className="app-shell" aria-busy="true">
      <div className="admin-loading" role="status" aria-label="Loading application">
        Loading…
      </div>
    </main>
  )
}

export default function App() {
  const shell = useProductShell()

  if (shell.activeSurface === 'chat' && (shell.auth.isAuthenticated || shell.auth.isVisitor)) {
    return (
      <Suspense fallback={<SurfaceLoading />}>
        <AuthenticatedChatSurface auth={shell.auth} chatEntry={shell.chatEntry} onHome={shell.actions.showHome} />
      </Suspense>
    )
  }

  if (shell.activeSurface === 'admin') {
    return (
      <Suspense fallback={<SurfaceLoading />}>
        <AdminDashboard
          currentUserId={shell.auth.user?.id}
          getAccessToken={shell.auth.getValidToken}
          onBack={shell.actions.showHome}
          onTourImageUpdated={shell.actions.recordTourImageUpdate}
        />
      </Suspense>
    )
  }

  if (shell.activeSurface === 'my-tours') {
    return (
      <Suspense fallback={<SurfaceLoading />}>
        <MyToursPage
          getAccessToken={shell.auth.getValidToken}
          isAdmin={shell.auth.user?.role === 'admin'}
          onBack={shell.actions.showHome}
        />
      </Suspense>
    )
  }

  return <HomeSurface shell={shell} />
}

export { SurfaceLoading }
