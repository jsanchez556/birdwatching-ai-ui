import { fireEvent, render, screen } from '@testing-library/react'
import AiFeatureControls from '../AiFeatureControls'
import UserAdministration from '../UserAdministration'

const idle = () => ({ status: 'idle', result: null, error: null })

test('shows enable only for disabled features with localized countdown state', () => {
  const onEnable = jest.fn()
  render(<AiFeatureControls
    features={[
      { name: 'voice_ai', enabled: false, status: 'disabled', disabledUntil: '2026-07-29T17:00:00.000Z' },
      { name: 'multimodal_bird_identification', enabled: true, status: 'enabled', disabledUntil: null },
      { name: 'agent_booking', enabled: true, status: 'enabled', disabledUntil: null },
    ]}
    getOperationState={idle}
    onDisable={jest.fn()}
    onEnable={onEnable}
    now={new Date('2026-07-29T16:18:00.000Z').getTime()}
  />)
  expect(screen.getByText('Temporarily disabled')).toBeInTheDocument()
  expect(screen.getByText(/Re-enables in 42 minutes/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /enable feature voice ai/i }))
  expect(onEnable).toHaveBeenCalled()
})

test('offers reactivation only for suspended eligible users and protects admins', () => {
  const onUnsuspend = jest.fn()
  render(<UserAdministration
    currentUserId="1"
    users={{
      data: [
        { id: '7', name: 'Suspended User', role: 'customer', plan: 'FREE', status: 'suspended', suspendedAt: '2026-07-29T12:00:00.000Z' },
        { id: '1', name: 'Current Admin', role: 'admin', plan: 'PRO', status: 'active', suspendedAt: null },
      ],
      meta: { total: 2 },
    }}
    getOperationState={idle}
    onSuspend={jest.fn()}
    onUnsuspend={onUnsuspend}
  />)
  expect(screen.getByRole('status')).toHaveTextContent(/suspended since/i)
  fireEvent.click(screen.getByRole('button', { name: /reactivate user 7/i }))
  expect(onUnsuspend).toHaveBeenCalled()
  expect(screen.getByText('Protected administrator')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /suspend user 1/i })).not.toBeInTheDocument()
})
