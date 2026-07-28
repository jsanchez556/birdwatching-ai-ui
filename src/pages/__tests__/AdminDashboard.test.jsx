import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import AdminDashboard from '../AdminDashboard'
import useAdminDashboard from '../../hooks/useAdminDashboard'

jest.mock('../../hooks/useAdminDashboard', () => ({
  __esModule: true,
  default: jest.fn(),
}))

const dashboardData = {
  overview: {
    activeUsers: 147,
    activeSubscriptions: 63,
    mrr: 1890,
    reservations: 42,
    aiRequestsToday: 1294,
    aiCostToday: 18.72,
    averageLatencyMs: 1840,
    errorRate: 0.021,
  },
  usage: {
    totals: { requests: 1294 },
    byFeature: [
      { feature: 'chat', requests: 900 },
      { feature: 'identification', requests: 394 },
    ],
  },
  costs: {
    totals: {
      estimatedCost: 18.72,
      unpricedRequests: 2,
    },
    byFeature: [
      { feature: 'chat', estimatedCost: 12.5 },
      { feature: 'identification', estimatedCost: 6.22 },
    ],
  },
  subscriptions: {
    data: [
      { userId: '1', status: 'active', plan: 'PRO' },
      { userId: '2', status: 'past_due', plan: 'PRO' },
    ],
    meta: { total: 2 },
  },
  failures: {
    data: [{
      id: 'job-1',
      category: 'background_job',
      type: 'embedding',
      occurredAt: '2026-07-28T12:00:00.000Z',
      error: { message: 'Background job failed' },
    }],
    meta: { total: 1 },
  },
  queueHealth: {
    status: 'attention',
    queues: [{
      name: 'embedding',
      status: 'attention',
      counts: { waiting: 2, active: 1, failed: 1, delayed: 0 },
    }],
  },
}

function hookResult(overrides = {}) {
  return {
    data: dashboardData,
    error: null,
    isLoading: false,
    isRefreshing: false,
    range: '30d',
    rangeOptions: [
      { value: 'today', label: 'Today' },
      { value: '30d', label: 'Last 30 days' },
    ],
    refresh: jest.fn(),
    setRange: jest.fn(),
    ...overrides,
  }
}

describe('AdminDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('renders accessible loading placeholders', () => {
    useAdminDashboard.mockReturnValue(hookResult({
      data: null,
      isLoading: true,
    }))

    render(<AdminDashboard getAccessToken={jest.fn()} onBack={jest.fn()} />)

    expect(screen.getByRole('status', { name: /loading admin dashboard/i })).toBeInTheDocument()
  })

  test('renders KPI, chart, subscription, error, and queue sections', () => {
    useAdminDashboard.mockReturnValue(hookResult())

    render(<AdminDashboard getAccessToken={jest.fn()} onBack={jest.fn()} />)

    expect(screen.getByRole('heading', { name: /operations dashboard/i })).toBeInTheDocument()
    expect(screen.getByText('147')).toBeInTheDocument()
    expect(screen.getByText('$1,890.00')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /AI usage/i })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /AI requests by feature/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /AI cost/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Subscriptions/i })).toBeInTheDocument()
    expect(screen.getByText(/Background job failed/i)).toBeInTheDocument()
    expect(screen.getAllByText('embedding')).toHaveLength(2)
  })

  test('supports range changes, refresh, retry, and returning to the site', () => {
    const refresh = jest.fn()
    const setRange = jest.fn()
    const onBack = jest.fn()
    useAdminDashboard.mockReturnValue(hookResult({
      data: null,
      error: 'Service unavailable',
      refresh,
      setRange,
    }))

    render(<AdminDashboard getAccessToken={jest.fn()} onBack={onBack} />)

    fireEvent.change(screen.getByLabelText(/reporting range/i), {
      target: { value: 'today' },
    })
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }))
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    fireEvent.click(screen.getByRole('button', { name: /back to site/i }))

    expect(setRange).toHaveBeenCalledWith('today')
    expect(refresh).toHaveBeenCalledTimes(2)
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('alert')).toHaveTextContent('Service unavailable')
  })
})
