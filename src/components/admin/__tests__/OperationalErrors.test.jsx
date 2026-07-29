import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import OperationalErrors from '../OperationalErrors'

describe('OperationalErrors', () => {
  test('renders every field and a secure new-tab trace link', () => {
    render(<OperationalErrors errors={{
      data: {
        errors: [{
          id: 'error-1',
          timestamp: '2026-07-28T15:42:18.000Z',
          type: 'PAYMENT_FAILURE',
          user: { id: '42', label: 'User 42' },
          traceId: 'a1b2c3d4e5f6g7h8',
          traceUrl: 'https://smith.langchain.com/o/project/r/trace-1',
          message: 'Payment processing failed',
          status: 'payment_failed',
        }],
      },
      meta: { total: 1 },
    }} />)

    expect(screen.getByText('Payment failure')).toBeInTheDocument()
    expect(screen.getByText('Payment processing failed')).toBeInTheDocument()
    expect(screen.getByText('payment failed')).toBeInTheDocument()
    expect(screen.getByText('User 42')).toBeInTheDocument()
    expect(screen.getByText('Trace: a1b2c3d4e5f6…')).toHaveAttribute(
      'title',
      'a1b2c3d4e5f6g7h8'
    )
    expect(screen.getByRole('link', { name: /open trace a1b2c3d4e5f6g7h8/i }))
      .toHaveAttribute('target', '_blank')
    expect(screen.getByRole('link', { name: /open trace a1b2c3d4e5f6g7h8/i }))
      .toHaveAttribute('rel', 'noopener noreferrer')
    expect(document.querySelector('time')).toHaveAttribute(
      'datetime',
      '2026-07-28T15:42:18.000Z'
    )
  })

  test('shows trace unavailable and an empty state without an unsafe action', () => {
    const { rerender } = render(<OperationalErrors errors={{
      data: {
        errors: [{
          id: 'error-2',
          timestamp: '2026-07-28T15:42:18.000Z',
          type: 'RATE_LIMIT',
          user: null,
          traceId: null,
          traceUrl: null,
          message: 'Request rate limit exceeded',
          status: 'rate_limited',
        }],
      },
      meta: { total: 1 },
    }} />)

    expect(screen.getByText('System')).toBeInTheDocument()
    expect(screen.getByText('Trace unavailable')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /open trace/i })).not.toBeInTheDocument()

    rerender(<OperationalErrors errors={{
      data: { errors: [] },
      meta: { total: 0 },
    }} />)
    expect(screen.getByText(/no operational errors in this reporting range/i)).toBeInTheDocument()
  })
})
