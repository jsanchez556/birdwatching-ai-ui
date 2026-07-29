const FEATURES = [
  {
    id: 'voice_ai',
    label: 'Voice AI',
    impact: 'Stops new voice AI requests until the selected UTC expiration.',
  },
  {
    id: 'multimodal_bird_identification',
    label: 'Multimodal bird identification',
    impact: 'Stops new AI image-identification requests until the selected UTC expiration.',
  },
  {
    id: 'agent_booking',
    label: 'Agent booking',
    impact: 'Stops new AI-assisted booking actions until the selected UTC expiration.',
  },
]

function AiFeatureControls({
  features,
  getOperationState,
  onDisable,
  onEnable,
  now = Date.now(),
}) {
  const stateByName = new Map((features || []).map((feature) => [feature.name, feature]))
  return (
    <section className="admin-panel admin-feature-controls" aria-labelledby="admin-feature-controls-title">
      <header className="admin-panel-header">
        <div>
          <p className="admin-eyebrow">Emergency controls</p>
          <h3 id="admin-feature-controls-title">AI feature controls</h3>
        </div>
      </header>
      <ul className="admin-operation-list">
        {FEATURES.map((feature) => {
          const authoritative = stateByName.get(feature.id)
          const isDisabled = authoritative?.status === 'disabled'
          const state = getOperationState(isDisabled ? 'enable' : 'disable', feature.id)
          const disabledUntil = authoritative?.disabledUntil
          const remainingMinutes = disabledUntil
            ? Math.max(0, Math.ceil((new Date(disabledUntil).getTime() - now) / 60_000))
            : null
          return (
            <li key={feature.id}>
              <div>
                <strong>{feature.label}</strong>
                <p>{feature.impact}</p>
                <span className="admin-protected-label" role="status">
                  {isDisabled ? 'Temporarily disabled' : 'Enabled'}
                </span>
                {disabledUntil && (
                  <p>
                    <time dateTime={disabledUntil}>
                      Disabled until {new Intl.DateTimeFormat(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                      }).format(new Date(disabledUntil))}
                    </time>
                    {' '}· Re-enables in {remainingMinutes} minute{remainingMinutes === 1 ? '' : 's'}
                  </p>
                )}
              </div>
              <button
                type="button"
                className={isDisabled ? 'admin-operation-confirm' : 'admin-danger-action'}
                disabled={state.status === 'pending'}
                onClick={(event) => (
                  isDisabled ? onEnable(feature, event.currentTarget) : onDisable(feature, event.currentTarget)
                )}
                aria-label={`${isDisabled ? 'Enable' : 'Disable'} feature ${feature.label}`}
              >
                {state.status === 'pending'
                  ? isDisabled ? 'Enabling…' : 'Disabling…'
                  : isDisabled ? 'Enable feature' : 'Disable feature'}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export { FEATURES }
export default AiFeatureControls
