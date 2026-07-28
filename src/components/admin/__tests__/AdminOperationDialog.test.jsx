import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import AdminOperationDialog from '../AdminOperationDialog'

const idleState = {
  status: 'idle',
  result: null,
  error: null,
  retryable: false,
  authorizationFailure: false,
}

function operation(type) {
  return {
    type,
    targetId: type === 'retry' ? 'job-1' : type === 'suspend' ? '7' : 'voice_ai',
    targetLabel: type === 'retry'
      ? 'Job job-1 (embedding)'
      : type === 'suspend' ? 'User 7' : 'Voice AI (voice_ai)',
    impact: `Expected ${type} impact`,
    successMessage: `${type} succeeded`,
  }
}

function renderDialog({
  type = 'retry',
  state = idleState,
  onCancel = jest.fn(),
  onConfirm = jest.fn(),
  returnFocusRef = { current: document.createElement('button') },
} = {}) {
  render(
    <AdminOperationDialog
      operation={operation(type)}
      operationState={state}
      onCancel={onCancel}
      onConfirm={onConfirm}
      returnFocusRef={returnFocusRef}
    />
  )
  return { onCancel, onConfirm, returnFocusRef }
}

describe('AdminOperationDialog', () => {
  test.each([
    ['retry', /retry failed job/i, /retry job/i],
    ['suspend', /suspend user/i, /suspend user/i],
    ['disable', /temporarily disable ai feature/i, /disable feature/i],
  ])('provides an accessible %s confirmation and cancellation', (type, name, confirmName) => {
    const { onCancel } = renderDialog({ type })

    expect(screen.getByRole('dialog', { name })).toBeInTheDocument()
    expect(screen.getByText(operation(type).targetLabel)).toBeInTheDocument()
    expect(screen.getByText(`Expected ${type} impact`)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: confirmName })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  test('requires a reason code and never collects free-form suspension evidence', () => {
    const { onConfirm } = renderDialog({ type: 'suspend' })

    fireEvent.click(screen.getByRole('button', { name: /suspend user/i }))
    expect(screen.getByRole('alert')).toHaveTextContent('Select a suspension reason')
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/suspension reason/i), {
      target: { value: 'policy_violation' },
    })
    fireEvent.click(screen.getByRole('button', { name: /suspend user/i }))
    expect(onConfirm).toHaveBeenCalledWith({
      reasonCode: 'policy_violation',
      durationMinutes: undefined,
    })
  })

  test('requires a preset or valid custom feature-disable duration', () => {
    const { onConfirm } = renderDialog({ type: 'disable' })

    fireEvent.click(screen.getByRole('button', { name: /disable feature/i }))
    expect(screen.getByRole('alert')).toHaveTextContent('1 to 1440 minutes')
    expect(onConfirm).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText(/disable duration/i), {
      target: { value: 'custom' },
    })
    fireEvent.change(screen.getByLabelText(/custom duration in minutes/i), {
      target: { value: '90' },
    })
    fireEvent.click(screen.getByRole('button', { name: /disable feature/i }))
    expect(onConfirm).toHaveBeenCalledWith({
      reasonCode: '',
      durationMinutes: 90,
    })
  })

  test('announces pending, error, and successful audit-reference states', () => {
    const { rerender } = render(
      <AdminOperationDialog
        operation={operation('disable')}
        operationState={{ ...idleState, status: 'pending' }}
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
        returnFocusRef={{ current: document.createElement('button') }}
      />
    )

    expect(screen.getByRole('status')).toHaveTextContent('in progress')
    expect(screen.getByRole('button', { name: /working/i })).toBeDisabled()

    rerender(
      <AdminOperationDialog
        operation={operation('disable')}
        operationState={{
          ...idleState,
          status: 'error',
          error: 'The server could not complete this action.',
          retryable: true,
        }}
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
        returnFocusRef={{ current: document.createElement('button') }}
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent('use the confirmation button to retry')

    rerender(
      <AdminOperationDialog
        operation={operation('disable')}
        operationState={{
          ...idleState,
          status: 'success',
          result: {
            auditId: '43',
            feature: {
              disabledUntil: '2026-07-29T13:00:00.000Z',
            },
          },
        }}
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
        returnFocusRef={{ current: document.createElement('button') }}
      />
    )
    expect(screen.getByRole('status')).toHaveTextContent('Audit reference: 43')
    expect(screen.getByRole('status').querySelector('time'))
      .toHaveAttribute('dateTime', '2026-07-29T13:00:00.000Z')
  })

  test('supports Escape-to-cancel and returns focus to the initiating control', () => {
    const initiatingControl = document.createElement('button')
    document.body.appendChild(initiatingControl)
    initiatingControl.focus()
    const onCancel = jest.fn()
    const { unmount } = render(
      <AdminOperationDialog
        operation={operation('retry')}
        operationState={idleState}
        onCancel={onCancel}
        onConfirm={jest.fn()}
        returnFocusRef={{ current: initiatingControl }}
      />
    )

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)

    unmount()
    expect(initiatingControl).toHaveFocus()
    initiatingControl.remove()
  })

  test('does not offer resubmission after an authorization failure', () => {
    renderDialog({
      state: {
        ...idleState,
        status: 'error',
        error: 'You do not have permission to perform this admin action.',
        authorizationFailure: true,
      },
    })

    expect(screen.getByRole('alert')).toHaveTextContent('permission')
    expect(screen.getByRole('button', { name: /retry job/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeEnabled()
  })
})
