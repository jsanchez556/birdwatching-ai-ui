import { fireEvent, render, screen } from '@testing-library/react'
import AdminDashboard, { affectedSectionsForOperation } from '../AdminDashboard'
import useAdminDashboard, { ADMIN_SECTION_IDS } from '../../hooks/useAdminDashboard'

jest.mock('../../hooks/useAdminDashboard', () => {
  const ids = {
    AI_OPERATIONS: 'ai_operations',
    COMMERCIAL: 'commercial',
    EMERGENCY: 'emergency',
  }
  return {
    __esModule: true,
    ADMIN_SECTION_IDS: ids,
    default: jest.fn(),
  }
})

const sections = [
  { id: 'ai_operations', label: 'AI Operations', rangeDependent: true },
  { id: 'commercial', label: 'Commercial administration', rangeDependent: false },
  { id: 'emergency', label: 'Emergency controls', rangeDependent: false },
]

const quality = {
  range: { startAt: '2026-07-01T00:00:00.000Z', endAt: '2026-08-01T00:00:00.000Z', timezone: 'UTC' },
  previousRange: { startAt: '2026-05-31T00:00:00.000Z', endAt: '2026-07-01T00:00:00.000Z', timezone: 'UTC' },
  qualityStatus: 'available',
  qualitySource: 'real_pipeline_output',
  unavailableReason: null,
  provenance: { modelIdentifier: 'gpt-test', promptVersion: 'chat-v1' },
  scorerSelfTest: {
    label: 'Synthetic scorer self-test — not model or RAG quality',
    includedInQualityMetrics: false,
    availableInConfiguredArtifact: false,
  },
  metrics: {
    groundingScore: { current: 0.86, previous: 0.82, delta: 0.04, currentSampleSize: 120, previousSampleSize: 110 },
    answerRelevance: { current: 0.89, previous: 0.91, delta: -0.02, currentSampleSize: 120, previousSampleSize: 110 },
    retrievalQuality: { current: 0.79, previous: 0.79, delta: 0, currentSampleSize: 75, previousSampleSize: 70 },
    toolSuccessRate: { current: null, previous: null, delta: null, currentSampleSize: 0, previousSampleSize: 0 },
  },
}

const sectionData = {
  ai_operations: {
    overview: { activeUsers: 147, mrr: 1890, aiCostToday: 18.72, errorRate: 0.021 },
    usage: { totals: { requests: 1294 }, byFeature: [{ feature: 'chat', requests: 1294 }] },
    costs: {
      totals: { requests: 1294, tokens: 870400, estimatedCost: 18.72, averageCostPerRequest: 0.0145, unpricedRequests: 0 },
      byFeature: [{ feature: 'chat', requests: 1294, tokens: 870400, estimatedCost: 18.72, averageCostPerRequest: 0.0145 }],
      byModel: [],
      byPlan: [],
      byUser: [],
    },
    quality,
    queueHealth: {
      observedAt: '2026-07-28T12:00:00.000Z',
      queues: [{ id: 'embeddings', name: 'Embeddings', waiting: 0, active: 1, completed: 86, failed: 2, delayed: 0 }],
    },
    failures: {
      data: [{
        id: 'job-1',
        category: 'background_job',
        type: 'embedding',
        status: 'failed',
        occurredAt: '2026-07-28T11:30:00.000Z',
        error: { code: 'JOB_FAILED', message: 'Background job failed' },
      }],
      meta: { total: 1 },
    },
    errors: {
      data: {
        errors: [{
          id: 'error-1',
          timestamp: '2026-07-28T12:00:00.000Z',
          type: 'TOOL_ERROR',
          user: { id: '42', label: 'User 42' },
          traceId: null,
          traceUrl: null,
          message: 'Tool execution failed',
          status: 'failed',
        }],
      },
      meta: { total: 1 },
    },
  },
  commercial: {
    subscriptions: { data: [{ userId: '1', status: 'active', plan: 'PRO' }], meta: { total: 1 } },
    users: {
      data: [
        { id: '1', name: 'Admin', role: 'admin', plan: 'PRO', status: 'active' },
        { id: '7', name: 'Example User', role: 'customer', plan: 'FREE', status: 'active' },
      ],
      meta: { total: 2 },
    },
  },
  emergency: {
    aiFeatures: {
      features: [
        { name: 'voice_ai', enabled: true, status: 'enabled', disabledUntil: null },
        { name: 'multimodal_bird_identification', enabled: true, status: 'enabled', disabledUntil: null },
        { name: 'agent_booking', enabled: true, status: 'enabled', disabledUntil: null },
      ],
    },
  },
}

function hookResult(section = ADMIN_SECTION_IDS.AI_OPERATIONS, overrides = {}) {
  return {
    activeSection: section,
    activeState: { status: 'success', data: sectionData[section], error: null },
    now: Date.now(),
    range: '30d',
    rangeOptions: [{ value: 'today', label: 'Today' }, { value: '30d', label: 'Last 30 days' }],
    refresh: jest.fn(),
    refreshSections: jest.fn(),
    sections,
    setActiveSection: jest.fn(),
    setRange: jest.fn(),
    ...overrides,
  }
}

describe('AdminDashboard section composition', () => {
  beforeEach(() => jest.clearAllMocks())

  test('selects AI Operations by default with the compact KPI hierarchy', () => {
    const state = hookResult()
    useAdminDashboard.mockReturnValue(state)
    render(<AdminDashboard currentUserId="1" getAccessToken={jest.fn()} onBack={jest.fn()} />)

    const navigation = screen.getByRole('navigation', { name: /admin dashboard sections/i })
    const buttons = Array.from(navigation.querySelectorAll('button'))
    expect(buttons.map((button) => button.textContent)).toEqual(sections.map(({ label }) => label))
    expect(screen.getByRole('button', { name: 'AI Operations' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { name: 'AI Operations' })).toHaveFocus()
    expect(screen.getByText('147')).toHaveAccessibleName('147 active users')
    expect(screen.getByText('$1.9K')).toHaveAccessibleName('$1,890.00 monthly recurring revenue')
    expect(screen.getByLabelText('$18.72 estimated AI cost')).toHaveTextContent('$18.72')
    expect(screen.getByText('2.1%')).toHaveAccessibleName('2.1% AI error rate')

    const contentHeadings = screen.getAllByRole('heading')
      .map((heading) => heading.textContent)
    expect(contentHeadings).toEqual(expect.arrayContaining([
      'AI usage',
      'Portfolio regression quality',
      'Queues',
      'Recent failures',
    ]))
    expect(contentHeadings.indexOf('AI usage')).toBeLessThan(contentHeadings.indexOf('Portfolio regression quality'))
    expect(contentHeadings.indexOf('Portfolio regression quality')).toBeLessThan(contentHeadings.indexOf('Queues'))
    expect(contentHeadings.indexOf('Queues')).toBeLessThan(contentHeadings.indexOf('Recent failures'))

    fireEvent.click(screen.getByRole('button', { name: 'Commercial administration' }))
    expect(state.setActiveSection).toHaveBeenCalledWith('commercial')
  })

  test('shows an unavailable state instead of synthetic or legacy quality scores', () => {
    const unavailableQuality = {
      ...quality,
      qualityStatus: 'unavailable',
      qualitySource: null,
      unavailableReason: 'No valid portfolio regression artifact from real pipeline outputs is available.',
      provenance: null,
      scorerSelfTest: {
        ...quality.scorerSelfTest,
        availableInConfiguredArtifact: true,
      },
      metrics: Object.fromEntries(Object.entries(quality.metrics).map(([name]) => [
        name,
        {
          current: null,
          previous: null,
          delta: null,
          currentSampleSize: 0,
          previousSampleSize: 0,
        },
      ])),
    }
    useAdminDashboard.mockReturnValue(hookResult('ai_operations', {
      activeState: {
        status: 'success',
        error: null,
        data: {
          ...sectionData.ai_operations,
          quality: unavailableQuality,
        },
      },
    }))

    render(<AdminDashboard currentUserId="1" getAccessToken={jest.fn()} onBack={jest.fn()} />)

    expect(screen.getByRole('status')).toHaveTextContent('Quality unavailable')
    expect(screen.getByText(/No model, RAG, or production quality score/i)).toBeInTheDocument()
    expect(screen.getByText(/Synthetic scorer self-test — not model or RAG quality/i)).toBeInTheDocument()
    expect(screen.queryByText('86.0%')).not.toBeInTheDocument()
  })

  test.each([
    ['commercial', 'Commercial administration', /user administration/i],
    ['emergency', 'Emergency controls', /AI feature controls/i],
  ])('renders only the active %s section', (section, label, contentHeading) => {
    useAdminDashboard.mockReturnValue(hookResult(section))
    render(<AdminDashboard currentUserId="1" getAccessToken={jest.fn()} onBack={jest.fn()} />)
    expect(screen.getByRole('heading', { name: label })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: contentHeading })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-current', 'page')
  })

  test('shows section-specific loading and retry without rendering another section', () => {
    const refresh = jest.fn()
    useAdminDashboard.mockReturnValue(hookResult('ai_operations', {
      activeState: { status: 'error', data: null, error: 'AI operations unavailable' },
      refresh,
    }))
    render(<AdminDashboard currentUserId="1" getAccessToken={jest.fn()} onBack={jest.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('AI Operations is unavailable')
    expect(screen.queryByText('$1.9K')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  test('refresh and reporting controls delegate only through the section hook', () => {
    const refresh = jest.fn()
    const setRange = jest.fn()
    const onBack = jest.fn()
    useAdminDashboard.mockReturnValue(hookResult('ai_operations', { refresh, setRange }))
    render(<AdminDashboard currentUserId="1" getAccessToken={jest.fn()} onBack={onBack} />)
    fireEvent.click(screen.getByRole('button', { name: /refresh section/i }))
    fireEvent.change(screen.getByLabelText(/reporting range/i), { target: { value: 'today' } })
    fireEvent.click(screen.getByRole('button', { name: /back to site/i }))
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(setRange).toHaveBeenCalledWith('today')
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  test('operation controls keep existing accessible confirmation dialogs', () => {
    useAdminDashboard.mockReturnValue(hookResult('ai_operations'))
    const { unmount } = render(<AdminDashboard currentUserId="1" getAccessToken={jest.fn()} onBack={jest.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /retry failed job job-1/i }))
    expect(screen.getByRole('dialog', { name: /retry failed job/i })).toHaveTextContent('Job job-1')
    unmount()

    useAdminDashboard.mockReturnValue(hookResult('emergency'))
    render(<AdminDashboard currentUserId="1" getAccessToken={jest.fn()} onBack={jest.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /disable feature voice ai/i }))
    expect(screen.getByRole('dialog', { name: /temporarily disable ai feature/i })).toBeInTheDocument()
  })

  test('maps successful operations only to their affected section caches', () => {
    expect(affectedSectionsForOperation('retry')).toEqual(['ai_operations'])
    expect(affectedSectionsForOperation('suspend')).toEqual(['commercial'])
    expect(affectedSectionsForOperation('unsuspend')).toEqual(['commercial'])
    expect(affectedSectionsForOperation('disable')).toEqual(['emergency'])
    expect(affectedSectionsForOperation('enable')).toEqual(['emergency'])
  })
})
