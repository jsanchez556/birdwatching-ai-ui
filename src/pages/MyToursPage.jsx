import AdminMaintenance from '../components/admin/AdminMaintenance'

export default function MyToursPage({ getAccessToken, isAdmin, onBack }) {
  return (
    <main className="app-shell my-tours-management">
      <AdminMaintenance
        resource="tours"
        getAccessToken={getAccessToken}
        scope="my-tours"
        showOwner={isAdmin}
        onBack={onBack}
      />
    </main>
  )
}
