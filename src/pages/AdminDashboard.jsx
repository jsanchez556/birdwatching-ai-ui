import { useCallback, useEffect, useRef, useState } from 'react'
import AdminOperationDialog from '../components/admin/AdminOperationDialog'
import AdminSectionNavigation from '../components/admin/AdminSectionNavigation'
import AdminMaintenance from '../components/admin/AdminMaintenance'
import AiFeatureControls, { FEATURES } from '../components/admin/AiFeatureControls'
import AiQualitySummary from '../components/admin/AiQualitySummary'
import CostChart from '../components/admin/CostChart'
import ContextEngineeringSummary from '../components/admin/ContextEngineeringSummary'
import FailedJobs from '../components/admin/FailedJobs'
import KpiCard from '../components/admin/KpiCard'
import ModelRoutingHealth from '../components/admin/ModelRoutingHealth'
import OperationalErrors from '../components/admin/OperationalErrors'
import QueueHealth from '../components/admin/QueueHealth'
import SubscriptionSummary from '../components/admin/SubscriptionSummary'
import UsageChart from '../components/admin/UsageChart'
import UserAdministration, { userLabel } from '../components/admin/UserAdministration'
import useAdminDashboard, { ADMIN_SECTION_IDS } from '../hooks/useAdminDashboard'
import useAdminOperations from '../hooks/useAdminOperations'

const countFormatter = new Intl.NumberFormat('en-US')
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
})
const compactCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
})
const percentFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const SECTION_DESCRIPTIONS = {
  [ADMIN_SECTION_IDS.COUNTRIES]: 'Country reference records retained by the maintenance API.',
  [ADMIN_SECTION_IDS.ZONES]: 'Regional groupings within countries.',
  [ADMIN_SECTION_IDS.NODES]: 'Tour locations and their geographic hierarchy.',
  [ADMIN_SECTION_IDS.BIRDS]: 'Bird taxonomy and discovery metadata.',
  [ADMIN_SECTION_IDS.BIRDS_BY_NODE]: 'Bird occurrence assignments by location.',
  [ADMIN_SECTION_IDS.TOURS]: 'Nature-tour inventory, pricing, coordinates, and publication.',
  [ADMIN_SECTION_IDS.AI_OPERATIONS]: 'Usage, quality, queues, and recent failures for the selected reporting range.',
  [ADMIN_SECTION_IDS.CONTEXT_ENGINEERING]: 'Context selection, retrieval, compaction, cost, and failure telemetry for the selected reporting range.',
  [ADMIN_SECTION_IDS.COMMERCIAL]: 'Subscription status and customer account administration.',
  [ADMIN_SECTION_IDS.EMERGENCY]: 'Authoritative AI feature state and audited shutdown controls.',
}

function affectedSectionsForOperation(type) {
  if (type === 'retry') {
    return [ADMIN_SECTION_IDS.AI_OPERATIONS]
  }
  if (type === 'suspend' || type === 'unsuspend' || type === 'role') {
    return [ADMIN_SECTION_IDS.COMMERCIAL]
  }
  if (type === 'disable' || type === 'enable') {
    return [ADMIN_SECTION_IDS.EMERGENCY]
  }
  return []
}

function SectionLoading({ label }) {
  return (
    <div className="admin-loading admin-section-loading" role="status" aria-label={`Loading ${label}`}>
      <div className="admin-skeleton admin-panel-skeleton" />
      <span>Loading {label}…</span>
    </div>
  )
}

function AdminDashboard({ currentUserId, getAccessToken, onBack, onTourImageUpdated }) {
  const [selectedOperation, setSelectedOperation] = useState(null)
  const returnFocusRef = useRef(null)
  const sectionHeadingRef = useRef(null)
  const dashboard = useAdminDashboard({ getAccessToken })
  const {
    activeSection,
    activeState,
    now,
    range,
    rangeOptions,
    refresh,
    refreshSections,
    sections,
    setActiveSection,
    setRange,
  } = dashboard

  const handleOperationSuccess = useCallback(({ type }) => {
    const affectedSections = affectedSectionsForOperation(type)
    if (type === 'disable' || type === 'enable') {
      window.dispatchEvent(new Event('birdwatching:feature-availability-changed'))
    }
    return affectedSections.length
      ? refreshSections(affectedSections, {
        loadedOnly: type === 'retry',
      })
      : null
  }, [refreshSections])

  const operations = useAdminOperations({
    getAccessToken,
    onSuccess: handleOperationSuccess,
  })
  const operationState = selectedOperation
    ? operations.getOperationState(selectedOperation.type, selectedOperation.targetId)
    : null
  const activeDefinition = sections.find(({ id }) => id === activeSection) || sections[0]
  const data = activeState.data
  const isMaintenanceSection = [
    ADMIN_SECTION_IDS.ZONES,
    ADMIN_SECTION_IDS.NODES,
    ADMIN_SECTION_IDS.BIRDS,
    ADMIN_SECTION_IDS.TOURS,
  ].includes(activeSection)

  useEffect(() => {
    sectionHeadingRef.current?.focus()
  }, [activeSection])

  const openOperation = useCallback((operation, initiatingControl) => {
    returnFocusRef.current = initiatingControl
    operations.clearOperation(operation.type, operation.targetId)
    setSelectedOperation(operation)
  }, [operations])

  const closeOperation = useCallback(() => setSelectedOperation(null), [])

  const confirmOperation = useCallback(({ reasonCode, durationMinutes }) => {
    if (selectedOperation.type === 'retry') {
      return operations.retryJob({ jobId: selectedOperation.targetId })
    }
    if (selectedOperation.type === 'suspend') {
      return operations.suspendUser({ userId: selectedOperation.targetId, reasonCode })
    }
    if (selectedOperation.type === 'unsuspend') {
      return operations.unsuspendUser({ userId: selectedOperation.targetId })
    }
    if (selectedOperation.type === 'role') {
      return operations.changeUserRole({
        userId: selectedOperation.targetId,
        role: selectedOperation.role,
      })
    }
    if (selectedOperation.type === 'enable') {
      return operations.enableFeature({ feature: selectedOperation.targetId })
    }
    return operations.disableFeature({
      feature: selectedOperation.targetId,
      durationMinutes,
    })
  }, [operations, selectedOperation])

  const requestRetry = useCallback((job, control) => {
    openOperation({
      type: 'retry',
      targetId: job.id,
      targetLabel: `Job ${job.id} (${job.type})`,
      impact: 'Moves this retained failed job back to its BullMQ queue. The original job payload cannot be changed here.',
      successMessage: 'The job was accepted for retry.',
    }, control)
  }, [openOperation])

  const requestSuspension = useCallback((user, control) => {
    openOperation({
      type: 'suspend',
      targetId: user.id,
      targetLabel: `${userLabel(user)} (User ${user.id})`,
      impact: 'Immediately blocks authenticated access and revokes the user’s active refresh sessions.',
      successMessage: 'The user account was suspended.',
    }, control)
  }, [openOperation])

  const requestReactivation = useCallback((user, control) => {
    openOperation({
      type: 'unsuspend',
      targetId: user.id,
      targetLabel: `${userLabel(user)} (User ${user.id})`,
      impact: 'Restores authenticated access without changing the user’s role or plan.',
      successMessage: 'The user account was reactivated.',
    }, control)
  }, [openOperation])

  const requestRoleChange = useCallback((user, role, control) => {
    openOperation({
      type: 'role',
      targetId: user.id,
      role,
      targetLabel: `${userLabel(user)}: ${user.role} → ${role}`,
      impact: 'Changes authorization immediately and revokes all active refresh sessions for this user.',
      successMessage: 'The user role was changed and existing refresh sessions were revoked.',
    }, control)
  }, [openOperation])

  const requestFeatureDisable = useCallback((feature, control) => {
    openOperation({
      type: 'disable',
      targetId: feature.id,
      targetLabel: `${feature.label} (${feature.id})`,
      impact: feature.impact,
      successMessage: 'The AI feature was temporarily disabled.',
    }, control)
  }, [openOperation])

  const requestFeatureEnable = useCallback((feature, control) => {
    openOperation({
      type: 'enable',
      targetId: feature.id,
      targetLabel: `${feature.label} (${feature.id})`,
      impact: 'Immediately removes the temporary shutdown so new requests can use this feature.',
      successMessage: 'The AI feature was enabled.',
    }, control)
  }, [openOperation])

  const renderSection = () => {
    if (isMaintenanceSection) {
      return <AdminMaintenance
        resource={activeSection}
        getAccessToken={getAccessToken}
        showOwner={activeSection === ADMIN_SECTION_IDS.TOURS}
        onTourImageUpdated={onTourImageUpdated}
      />
    }
    if (activeState.status === 'loading') {
      return <SectionLoading label={activeDefinition.label} />
    }
    if (activeState.status === 'error') {
      return (
        <div className="admin-alert" role="alert">
          <div>
            <strong>{activeDefinition.label} is unavailable</strong>
            <p>{activeState.error}</p>
          </div>
          <button type="button" onClick={refresh}>Try again</button>
        </div>
      )
    }
    if (activeState.status !== 'success' || !data) return null

    if (activeSection === ADMIN_SECTION_IDS.AI_OPERATIONS) {
      return (
        <div className="admin-operations-stack">
          <section aria-labelledby="admin-operations-overview-title">
            <h3 className="sr-only" id="admin-operations-overview-title">AI Operations overview</h3>
            <div className="admin-kpi-grid admin-operations-kpis">
              <KpiCard
                compact
                label="Users"
                value={countFormatter.format(data.overview.activeUsers)}
                accessibleValue={`${countFormatter.format(data.overview.activeUsers)} active users`}
              />
              <KpiCard
                compact
                label="MRR"
                value={compactCurrencyFormatter.format(data.overview.mrr)}
                accessibleValue={`${currencyFormatter.format(data.overview.mrr)} monthly recurring revenue`}
              />
              <KpiCard
                compact
                label="AI Cost"
                value={currencyFormatter.format(data.overview.aiCostToday)}
                accessibleValue={`${currencyFormatter.format(data.overview.aiCostToday)} estimated AI cost`}
              />
              <KpiCard
                compact
                label="Errors"
                value={percentFormatter.format(data.overview.errorRate)}
                accessibleValue={`${percentFormatter.format(data.overview.errorRate)} AI error rate`}
                tone={data.overview.errorRate > 0.05 ? 'warning' : 'default'}
              />
            </div>
          </section>
          <div className="admin-dashboard-grid admin-single-panel-grid">
            <ModelRoutingHealth data={data.overview.routingHealth} />
          </div>
          <div className="admin-dashboard-grid">
            <UsageChart data={data.usage} />
            <CostChart data={data.costs} showTotal={false} />
          </div>
          <div className="admin-dashboard-grid admin-single-panel-grid">
            <AiQualitySummary data={data.quality} />
          </div>
          <div className="admin-dashboard-grid admin-single-panel-grid">
            <QueueHealth data={data.queueHealth} />
          </div>
          <section className="admin-subsection" aria-labelledby="admin-recent-failures-title">
            <header className="admin-subsection-header">
              <p className="admin-eyebrow">Attention needed</p>
              <h3 id="admin-recent-failures-title">Recent failures</h3>
            </header>
            <div className="admin-dashboard-grid">
              <FailedJobs
                failures={data.failures}
                getOperationState={operations.getOperationState}
                onRetry={requestRetry}
              />
              <OperationalErrors errors={data.errors} />
            </div>
          </section>
        </div>
      )
    }

    if (activeSection === ADMIN_SECTION_IDS.COMMERCIAL) {
      return (
        <div className="admin-dashboard-grid">
          <SubscriptionSummary
            subscriptions={data.subscriptions}
            showTotals={false}
          />
          <UserAdministration
            users={data.users}
            currentUserId={currentUserId}
            getOperationState={operations.getOperationState}
            onSuspend={requestSuspension}
            onUnsuspend={requestReactivation}
            onChangeRole={requestRoleChange}
            getAccessToken={getAccessToken}
          />
        </div>
      )
    }

    if (activeSection === ADMIN_SECTION_IDS.CONTEXT_ENGINEERING) {
      return (
        <div className="admin-dashboard-grid admin-single-panel-grid">
          <ContextEngineeringSummary data={data.contextEngineering} />
        </div>
      )
    }

    return (
      <div className="admin-dashboard-grid">
        <AiFeatureControls
          features={data.aiFeatures?.features || FEATURES.map((feature) => ({
            name: feature.id,
            enabled: true,
            status: 'enabled',
            disabledUntil: null,
          }))}
          getOperationState={operations.getOperationState}
          onDisable={requestFeatureDisable}
          onEnable={requestFeatureEnable}
          now={now}
        />
      </div>
    )
  }

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <button type="button" className="admin-back-action" onClick={onBack}>
            <span aria-hidden="true">←</span> Back to site
          </button>
          <p className="admin-eyebrow">Nature tours administration</p>
          <h1>Administration</h1>
          <p>Maintain destinations, wildlife, tours, and platform operations.</p>
        </div>
        {!isMaintenanceSection && <div className="admin-toolbar">
          <label>
            <span>Reporting range</span>
            <select value={range} onChange={(event) => setRange(event.target.value)}>
              {rangeOptions.map((option) => (
                <option value={option.value} key={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={refresh} disabled={activeState.status === 'loading'}>
            {activeState.status === 'loading' ? 'Refreshing' : 'Refresh section'}
          </button>
        </div>}
      </header>

      <div className="admin-section-shell">
        <AdminSectionNavigation
          activeSection={activeSection}
          onSelect={setActiveSection}
          sections={sections}
        />
        <section
          className="admin-section-content"
          aria-labelledby={isMaintenanceSection ? 'maintenance-title' : 'admin-active-section-title'}
          aria-busy={activeState.status === 'loading'}
        >
          {!isMaintenanceSection && <header className="admin-dimension-header">
            <p className="admin-eyebrow">Dashboard section</p>
            <h2 id="admin-active-section-title" ref={sectionHeadingRef} tabIndex="-1">
              {activeDefinition.label}
            </h2>
            <p>{SECTION_DESCRIPTIONS[activeSection]}</p>
          </header>}
          {renderSection()}
        </section>
      </div>

      {selectedOperation && operationState && (
        <AdminOperationDialog
          operation={selectedOperation}
          operationState={operationState}
          onCancel={closeOperation}
          onConfirm={confirmOperation}
          returnFocusRef={returnFocusRef}
        />
      )}
    </main>
  )
}

export { affectedSectionsForOperation, SectionLoading }
export default AdminDashboard
