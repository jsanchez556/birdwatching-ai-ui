import {
  getAdminOverview,
  loadAdminDashboard,
} from '../adminApi'

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: jest.fn().mockResolvedValue(body),
  }
}

function envelope(data, meta = {}) {
  return {
    success: true,
    data,
    meta,
  }
}

const overview = {
  activeUsers: 147,
  activeSubscriptions: 63,
  mrr: 1890,
  reservations: 42,
  aiRequestsToday: 1294,
  aiCostToday: 18.72,
  averageLatencyMs: 1840,
  errorRate: 0.021,
}

describe('adminApi', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('loads and validates the platform overview with auth and range parameters', async () => {
    global.fetch.mockResolvedValue(jsonResponse(envelope(overview)))

    await expect(getAdminOverview({
      token: 'admin-token',
      startDate: '2026-07-01T00:00:00.000Z',
      endDate: '2026-07-02T00:00:00.000Z',
    })).resolves.toEqual(overview)

    expect(global.fetch).toHaveBeenCalledWith(
      '/admin/overview?startDate=2026-07-01T00%3A00%3A00.000Z&endDate=2026-07-02T00%3A00%3A00.000Z',
      expect.objectContaining({
        method: 'GET',
        headers: {
          Authorization: 'Bearer admin-token',
        },
      })
    )
  })

  test('loads all dashboard sections through their admin endpoints', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse(envelope(overview)))
      .mockResolvedValueOnce(jsonResponse(envelope({
        totals: { requests: 10, users: 3, tokens: 200 },
        byFeature: [],
      })))
      .mockResolvedValueOnce(jsonResponse(envelope({
        totals: { estimatedCost: 1.2, pricedRequests: 10, unpricedRequests: 0 },
        byFeature: [],
      })))
      .mockResolvedValueOnce(jsonResponse(envelope([], {
        page: 1,
        limit: 100,
        total: 0,
        totalPages: 0,
      })))
      .mockResolvedValueOnce(jsonResponse(envelope([], {
        page: 1,
        limit: 6,
        total: 0,
        totalPages: 0,
      })))
      .mockResolvedValueOnce(jsonResponse(envelope({
        status: 'healthy',
        queues: [],
      })))

    await expect(loadAdminDashboard({
      token: 'admin-token',
      startDate: '2026-07-01T00:00:00.000Z',
      endDate: '2026-07-02T00:00:00.000Z',
    })).resolves.toMatchObject({
      overview,
      subscriptions: { data: [] },
      failures: { data: [] },
      queueHealth: { status: 'healthy' },
    })

    expect(global.fetch.mock.calls.map(([url]) => url)).toEqual(expect.arrayContaining([
      expect.stringContaining('/admin/overview'),
      expect.stringContaining('/admin/ai-usage'),
      expect.stringContaining('/admin/ai-costs'),
      '/admin/subscriptions?page=1&limit=100',
      '/admin/failures?page=1&limit=6',
      '/admin/queue-health',
    ]))
  })

  test('rejects malformed envelopes and surfaces safe backend errors', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({
      success: true,
      data: overview,
    }))

    await expect(getAdminOverview({ token: 'admin-token' }))
      .rejects.toThrow('Unable to load admin operations data')

    global.fetch.mockResolvedValueOnce(jsonResponse({
      success: false,
      data: null,
      meta: {},
      error: {
        code: 'FORBIDDEN',
        message: 'Admin access is required',
      },
    }, { ok: false, status: 403 }))

    await expect(getAdminOverview({ token: 'customer-token' }))
      .rejects.toThrow('Admin access is required')
  })
})
