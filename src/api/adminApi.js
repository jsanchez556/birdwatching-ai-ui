import {
  apiUrl,
  authHeaders,
  getApiErrorMessage,
  isObject,
  parseJsonResponse,
  validateEnvelope,
} from './http'

const ADMIN_REQUEST_TIMEOUT_MS = 15_000
const ADMIN_FALLBACK_ERROR = 'Unable to load admin operations data. Please try again.'

function rangeQuery({ startDate, endDate } = {}) {
  const query = new URLSearchParams()

  if (startDate) query.set('startDate', startDate)
  if (endDate) query.set('endDate', endDate)

  const value = query.toString()
  return value ? `?${value}` : ''
}

async function adminRequest(path, { token } = {}) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), ADMIN_REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(apiUrl(path), {
      method: 'GET',
      headers: authHeaders(token),
      signal: controller.signal,
    })
    const envelope = await parseJsonResponse(response)

    if (!response.ok) {
      throw new Error(getApiErrorMessage(envelope, ADMIN_FALLBACK_ERROR))
    }

    if (!validateEnvelope(envelope) || envelope.success !== true) {
      throw new Error(ADMIN_FALLBACK_ERROR)
    }

    return envelope
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Admin operations data took too long to respond. Please try again.')
    }

    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

function requireObjectData(envelope) {
  if (!isObject(envelope.data)) {
    throw new Error(ADMIN_FALLBACK_ERROR)
  }

  return envelope.data
}

function requireListData(envelope) {
  if (!Array.isArray(envelope.data) || !isObject(envelope.meta)) {
    throw new Error(ADMIN_FALLBACK_ERROR)
  }

  return {
    data: envelope.data,
    meta: envelope.meta,
  }
}

export async function getAdminOverview({ token, startDate, endDate } = {}) {
  const envelope = await adminRequest(`/admin/overview${rangeQuery({ startDate, endDate })}`, { token })
  const data = requireObjectData(envelope)
  const fields = [
    'activeUsers',
    'activeSubscriptions',
    'mrr',
    'reservations',
    'aiRequestsToday',
    'aiCostToday',
    'averageLatencyMs',
    'errorRate',
  ]

  if (fields.some((field) => typeof data[field] !== 'number' || !Number.isFinite(data[field]))) {
    throw new Error(ADMIN_FALLBACK_ERROR)
  }

  return data
}

export async function getAdminAiUsage({ token, startDate, endDate } = {}) {
  const envelope = await adminRequest(`/admin/ai-usage${rangeQuery({ startDate, endDate })}`, { token })
  const data = requireObjectData(envelope)

  if (!isObject(data.totals) || !Array.isArray(data.byFeature)) {
    throw new Error(ADMIN_FALLBACK_ERROR)
  }

  return data
}

export async function getAdminAiCosts({ token, startDate, endDate } = {}) {
  const envelope = await adminRequest(`/admin/ai-costs${rangeQuery({ startDate, endDate })}`, { token })
  const data = requireObjectData(envelope)

  if (!isObject(data.totals) || !Array.isArray(data.byFeature)) {
    throw new Error(ADMIN_FALLBACK_ERROR)
  }

  return data
}

export async function getAdminSubscriptions({ token, limit = 100 } = {}) {
  const envelope = await adminRequest(`/admin/subscriptions?page=1&limit=${limit}`, { token })
  return requireListData(envelope)
}

export async function getAdminFailures({ token, limit = 6 } = {}) {
  const envelope = await adminRequest(`/admin/failures?page=1&limit=${limit}`, { token })
  return requireListData(envelope)
}

export async function getAdminQueueHealth({ token } = {}) {
  const envelope = await adminRequest('/admin/queue-health', { token })
  const data = requireObjectData(envelope)

  if (typeof data.status !== 'string' || !Array.isArray(data.queues)) {
    throw new Error(ADMIN_FALLBACK_ERROR)
  }

  return data
}

export async function loadAdminDashboard({ token, startDate, endDate } = {}) {
  const [
    overview,
    usage,
    costs,
    subscriptions,
    failures,
    queueHealth,
  ] = await Promise.all([
    getAdminOverview({ token, startDate, endDate }),
    getAdminAiUsage({ token, startDate, endDate }),
    getAdminAiCosts({ token, startDate, endDate }),
    getAdminSubscriptions({ token }),
    getAdminFailures({ token }),
    getAdminQueueHealth({ token }),
  ])

  return {
    overview,
    usage,
    costs,
    subscriptions,
    failures,
    queueHealth,
  }
}

export { ADMIN_REQUEST_TIMEOUT_MS }
