import {
  getAdminAiCosts,
  getAdminErrors,
  getAdminAiQuality,
  getAdminOverview,
  getAdminQueueHealth,
  disableAdminAiFeature,
  enableAdminAiFeature,
  getAdminAiFeatures,
  loadAdminSection,
  ADMIN_SECTION_IDS,
  retryAdminJob,
  suspendAdminUser,
  unsuspendAdminUser,
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

const quality = {
  range: {
    startAt: '2026-07-01T00:00:00.000Z',
    endAt: '2026-07-02T00:00:00.000Z',
    timezone: 'UTC',
  },
  previousRange: {
    startAt: '2026-06-30T00:00:00.000Z',
    endAt: '2026-07-01T00:00:00.000Z',
    timezone: 'UTC',
  },
  metrics: {
    groundingScore: {
      current: 0.86,
      previous: 0.82,
      delta: 0.04,
      currentSampleSize: 120,
      previousSampleSize: 110,
    },
    answerRelevance: {
      current: 0.91,
      previous: 0.89,
      delta: 0.02,
      currentSampleSize: 120,
      previousSampleSize: 110,
    },
    retrievalQuality: {
      current: null,
      previous: null,
      delta: null,
      currentSampleSize: 0,
      previousSampleSize: 0,
    },
    toolSuccessRate: {
      current: 0.96,
      previous: 0.96,
      delta: 0,
      currentSampleSize: 48,
      previousSampleSize: 42,
    },
  },
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

  test('loads only the endpoints mapped to the selected dashboard section', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse(envelope([], {
        page: 1, limit: 100, total: 0, totalPages: 0,
      })))
      .mockResolvedValueOnce(jsonResponse(envelope([], {
        page: 1, limit: 100, total: 0, totalPages: 0,
      })))

    await loadAdminSection(ADMIN_SECTION_IDS.COMMERCIAL, {
      token: 'admin-token',
      startDate: '2026-07-01T00:00:00.000Z',
      endDate: '2026-07-02T00:00:00.000Z',
    })

    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(global.fetch.mock.calls.map(([path]) => path)).toEqual([
      '/admin/subscriptions?page=1&limit=100',
      '/admin/users?page=1&limit=100',
    ])
  })

  test.each([
    [
      ADMIN_SECTION_IDS.AI_OPERATIONS,
      [
        envelope(overview),
        envelope({ totals: {}, byFeature: [] }),
        envelope({ totals: {}, byModel: [], byFeature: [], byPlan: [], byUser: [] }),
        envelope(quality),
        envelope({ observedAt: '2026-07-29T12:00:00.000Z', queues: [] }),
        envelope([], { page: 1, limit: 6, total: 0, totalPages: 0 }),
        envelope({ errors: [] }, { page: 1, limit: 25, total: 0, totalPages: 0 }),
      ],
      [
        '/admin/overview',
        '/admin/ai-usage',
        '/admin/ai-costs',
        '/admin/ai-quality',
        '/admin/queue-health',
        '/admin/failures',
        '/admin/errors',
      ],
    ],
    [
      ADMIN_SECTION_IDS.EMERGENCY,
      [envelope({
        features: [
          { name: 'voice_ai', enabled: true, status: 'enabled', disabledUntil: null },
          { name: 'multimodal_bird_identification', enabled: true, status: 'enabled', disabledUntil: null },
          { name: 'agent_booking', enabled: true, status: 'enabled', disabledUntil: null },
        ],
      })],
      ['/admin/ai-features'],
    ],
  ])('maps %s to only its required endpoints', async (sectionId, responses, paths) => {
    responses.forEach((body) => global.fetch.mockResolvedValueOnce(jsonResponse(body)))
    await loadAdminSection(sectionId, {
      token: 'admin-token',
      startDate: quality.range.startAt,
      endDate: quality.range.endAt,
    })
    expect(global.fetch).toHaveBeenCalledTimes(paths.length)
    expect(global.fetch.mock.calls.map(([path]) => path)).toEqual(
      paths.map((path) => expect.stringContaining(path))
    )
  })

  test('validates feature state and enable/reactivate confirmations', async () => {
    const features = {
      features: [
        { name: 'voice_ai', enabled: false, status: 'disabled', disabledUntil: '2026-07-29T17:00:00.000Z' },
        { name: 'multimodal_bird_identification', enabled: true, status: 'enabled', disabledUntil: null },
        { name: 'agent_booking', enabled: true, status: 'enabled', disabledUntil: null },
      ],
    }
    global.fetch
      .mockResolvedValueOnce(jsonResponse(envelope(features)))
      .mockResolvedValueOnce(jsonResponse(envelope({
        auditId: '44',
        feature: { name: 'voice_ai', status: 'enabled', disabledUntil: null },
      })))
      .mockResolvedValueOnce(jsonResponse(envelope({
        auditId: '45',
        user: { id: '7', status: 'active', suspendedAt: null, reasonCode: null },
      })))

    await expect(getAdminAiFeatures({ token: 'admin-token' })).resolves.toEqual(features)
    await expect(enableAdminAiFeature({ token: 'admin-token', feature: 'voice_ai' }))
      .resolves.toMatchObject({ auditId: '44' })
    await expect(unsuspendAdminUser({ token: 'admin-token', userId: '7' }))
      .resolves.toMatchObject({ auditId: '45' })

    expect(global.fetch).toHaveBeenNthCalledWith(2, '/admin/ai-features/voice_ai/enable',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }),
        body: '{}',
      }))
    expect(global.fetch).toHaveBeenNthCalledWith(3, '/admin/users/7/unsuspend',
      expect.objectContaining({ method: 'POST', body: '{}' }))
  })

  test('loads AI quality with auth and query parameters and strictly validates its payload', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse(envelope(quality)))

    await expect(getAdminAiQuality({
      token: 'admin-token',
      startDate: quality.range.startAt,
      endDate: quality.range.endAt,
    })).resolves.toEqual(quality)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/admin/ai-quality?startDate='),
      expect.objectContaining({
        method: 'GET',
        headers: { Authorization: 'Bearer admin-token' },
      })
    )

    global.fetch.mockResolvedValueOnce(jsonResponse(envelope({
      ...quality,
      metrics: {
        ...quality.metrics,
        retrievalQuality: {
          current: null,
          previous: 0.8,
          delta: 0,
          currentSampleSize: 0,
          previousSampleSize: 4,
        },
      },
    })))

    await expect(getAdminAiQuality({ token: 'admin-token' }))
      .rejects.toThrow('Unable to load admin operations data')

    global.fetch.mockResolvedValueOnce(jsonResponse({
      success: true,
      data: quality,
    }))

    await expect(getAdminAiQuality({ token: 'admin-token' }))
      .rejects.toThrow('Unable to load admin operations data')
  })

  test('validates all AI cost breakdowns', async () => {
    const costs = {
      totals: {
        requests: 10,
        tokens: 200,
        estimatedCost: 1.2,
        averageCostPerRequest: 0.12,
      },
      byModel: [{ model: 'gpt-4.1-mini', requests: 10 }],
      byFeature: [{ feature: 'chat', requests: 10 }],
      byPlan: [{ plan: 'PRO', requests: 10 }],
      byUser: [{ userId: 'user-1', plan: 'PRO', requests: 10 }],
    }
    global.fetch.mockResolvedValueOnce(jsonResponse(envelope(costs)))

    await expect(getAdminAiCosts({ token: 'admin-token' })).resolves.toEqual(costs)

    global.fetch.mockResolvedValueOnce(jsonResponse(envelope({
      ...costs,
      byUser: null,
    })))

    await expect(getAdminAiCosts({ token: 'admin-token' }))
      .rejects.toThrow('Unable to load admin operations data')
  })

  test('validates every queue-health state before returning data', async () => {
    const queueHealth = {
      observedAt: '2026-07-28T12:00:00.000Z',
      queues: [{
        id: 'embeddings',
        name: 'Embeddings',
        waiting: 4,
        active: 2,
        completed: 120,
        failed: 0,
        delayed: 1,
      }],
    }
    global.fetch.mockResolvedValueOnce(jsonResponse(envelope(queueHealth)))

    await expect(getAdminQueueHealth({ token: 'admin-token' })).resolves.toEqual(queueHealth)

    global.fetch.mockResolvedValueOnce(jsonResponse(envelope({
      ...queueHealth,
      queues: [{
        ...queueHealth.queues[0],
        completed: undefined,
      }],
    })))

    await expect(getAdminQueueHealth({ token: 'admin-token' }))
      .rejects.toThrow('Unable to load admin operations data')
  })

  test('validates operational errors and removes unsafe trace URLs', async () => {
    const errors = [{
      id: 'error-1',
      timestamp: '2026-07-28T12:00:00.000Z',
      type: 'TOOL_ERROR',
      user: { id: '42', label: 'User 42' },
      traceId: 'trace-1',
      traceUrl: 'https://smith.langchain.com/o/project/r/trace-1',
      message: 'Tool execution failed',
      status: 'failed',
    }, {
      id: 'error-2',
      timestamp: '2026-07-28T11:00:00.000Z',
      type: 'LLM_ERROR',
      user: null,
      traceId: 'trace-2',
      traceUrl: 'https://smith.langchain.com.evil.test/r/trace-2',
      message: 'AI provider request failed',
      status: 'failed',
    }]
    global.fetch.mockResolvedValueOnce(jsonResponse(envelope({ errors }, {
      page: 1,
      limit: 25,
      total: 2,
      totalPages: 1,
    })))

    await expect(getAdminErrors({
      token: 'admin-token',
      startDate: '2026-07-01T00:00:00.000Z',
      endDate: '2026-08-01T00:00:00.000Z',
    })).resolves.toEqual({
      data: {
        errors: [
          errors[0],
          { ...errors[1], traceUrl: null },
        ],
      },
      meta: {
        page: 1,
        limit: 25,
        total: 2,
        totalPages: 1,
      },
    })

    expect(global.fetch.mock.calls[0][0]).toContain('/admin/errors?page=1&limit=25')
    expect(global.fetch.mock.calls[0][0]).toContain('startDate=')

    global.fetch.mockResolvedValueOnce(jsonResponse(envelope({
      errors: [{ ...errors[0], type: 'UNKNOWN_ERROR' }],
    }, {
      page: 1,
      limit: 25,
      total: 1,
      totalPages: 1,
    })))

    await expect(getAdminErrors({ token: 'admin-token' }))
      .rejects.toThrow('Unable to load admin operations data')

    global.fetch.mockResolvedValueOnce(jsonResponse(envelope({ errors: [] }, {
      page: 1,
      limit: 25,
      total: '0',
      totalPages: 0,
    })))

    await expect(getAdminErrors({ token: 'admin-token' }))
      .rejects.toThrow('Unable to load admin operations data')
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

  test('posts each admin operation with authorization and validates its payload', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse(envelope({
        auditId: '41',
        job: {
          id: 'job-1',
          type: 'embedding',
          queue: 'embedding',
          status: 'queued',
        },
      })))
      .mockResolvedValueOnce(jsonResponse(envelope({
        auditId: '42',
        user: {
          id: '7',
          status: 'suspended',
          suspendedAt: '2026-07-29T12:00:00.000Z',
          reasonCode: 'abuse',
        },
      })))
      .mockResolvedValueOnce(jsonResponse(envelope({
        auditId: '43',
        feature: {
          name: 'voice_ai',
          status: 'disabled',
          disabledUntil: '2026-07-29T13:00:00.000Z',
        },
      })))

    await retryAdminJob({ token: 'admin-token', jobId: 'job-1' })
    await suspendAdminUser({
      token: 'admin-token',
      userId: '7',
      reasonCode: 'abuse',
    })
    await disableAdminAiFeature({
      token: 'admin-token',
      feature: 'voice_ai',
      durationMinutes: 60,
    })

    expect(global.fetch).toHaveBeenNthCalledWith(1, '/admin/jobs/job-1/retry', expect.objectContaining({
      method: 'POST',
      headers: {
        Authorization: 'Bearer admin-token',
        'Content-Type': 'application/json',
      },
      body: '{}',
    }))
    expect(global.fetch).toHaveBeenNthCalledWith(2, '/admin/users/7/suspend', expect.objectContaining({
      method: 'POST',
      headers: {
        Authorization: 'Bearer admin-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reasonCode: 'abuse' }),
    }))
    expect(global.fetch).toHaveBeenNthCalledWith(
      3,
      '/admin/ai-features/voice_ai/disable',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer admin-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ durationMinutes: 60 }),
      })
    )
  })

  test('rejects invalid operation envelopes and payloads without exposing response details', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        data: {
          auditId: '41',
          job: {
            id: 'job-1',
            type: 'embedding',
            queue: 'embedding',
            status: 'queued',
          },
        },
      }))
      .mockResolvedValueOnce(jsonResponse(envelope({
        auditId: '41',
        job: {
          id: 'job-1',
          type: 'embedding',
          queue: 'embedding',
          status: 'queued',
          payload: 'secret job data',
        },
      })))

    await expect(retryAdminJob({ token: 'admin-token', jobId: 'job-1' }))
      .rejects.toMatchObject({ code: 'INVALID_RESPONSE', retryable: true })
    await expect(retryAdminJob({ token: 'admin-token', jobId: 'job-1' }))
      .rejects.toThrow('invalid confirmation')
  })

  test('strictly validates suspension and feature-disable confirmations', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse(envelope({
        auditId: '42',
        user: {
          id: '7',
          status: 'suspended',
          suspendedAt: '2026-07-29T12:00:00.000Z',
          reasonCode: 'free_form',
        },
      })))
      .mockResolvedValueOnce(jsonResponse(envelope({
        auditId: '43',
        feature: {
          name: 'voice_ai',
          status: 'enabled',
          disabledUntil: '2026-07-29T13:00:00.000Z',
        },
      })))

    await expect(suspendAdminUser({
      token: 'admin-token',
      userId: '7',
      reasonCode: 'abuse',
    })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
    await expect(disableAdminAiFeature({
      token: 'admin-token',
      feature: 'voice_ai',
      durationMinutes: 60,
    })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  test.each([
    [401, 'UNAUTHORIZED', false, 'session has expired'],
    [403, 'FORBIDDEN', false, 'permission'],
    [404, 'JOB_NOT_FOUND', false, 'no longer available'],
    [409, 'JOB_NOT_RETRYABLE', false, 'no longer failed'],
    [422, 'VALIDATION_ERROR', false, 'Review'],
    [500, 'INTERNAL_ERROR', true, 'server could not complete'],
  ])('maps operation HTTP %s errors to safe actionable state', async (
    status,
    code,
    retryable,
    message
  ) => {
    global.fetch.mockResolvedValueOnce(jsonResponse({
      success: false,
      data: null,
      meta: {},
      error: {
        code,
        message: 'raw provider/database details must not render',
      },
    }, { ok: false, status }))

    await expect(retryAdminJob({ token: 'admin-token', jobId: 'job-1' }))
      .rejects.toMatchObject({
        status,
        code,
        retryable,
        message: expect.stringMatching(new RegExp(message, 'i')),
      })
  })

  test('marks network failures as manually retryable', async () => {
    global.fetch.mockRejectedValueOnce(new TypeError('Failed to fetch internal host'))

    await expect(retryAdminJob({ token: 'admin-token', jobId: 'job-1' }))
      .rejects.toMatchObject({
        code: 'NETWORK_ERROR',
        retryable: true,
        message: 'Could not reach the server. Check your connection and try again.',
      })
  })
})
