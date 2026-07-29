import {
  apiUrl,
  authHeaders,
  getApiErrorMessage,
  isObject,
  JSON_HEADERS,
  parseJsonResponse,
  validateEnvelope,
} from './http'

const ADMIN_REQUEST_TIMEOUT_MS = 15_000
const ADMIN_FALLBACK_ERROR = 'Unable to load admin operations data. Please try again.'
const OPERATIONAL_ERROR_TYPES = new Set([
  'LLM_ERROR',
  'TOOL_ERROR',
  'RETRIEVAL_ERROR',
  'INVALID_OUTPUT',
  'QUEUE_FAILURE',
  'RATE_LIMIT',
  'PAYMENT_FAILURE',
])
const OPERATIONAL_ERROR_STATUSES = new Set([
  'failed',
  'blocked',
  'rate_limited',
  'payment_failed',
])
const LANGSMITH_HOSTS = new Set([
  'smith.langchain.com',
  'eu.smith.langchain.com',
  'aws.smith.langchain.com',
  'apac.smith.langchain.com',
])
const AI_QUALITY_METRICS = [
  'groundingScore',
  'answerRelevance',
  'retrievalQuality',
  'toolSuccessRate',
]
const ADMIN_OPERATION_FALLBACK = 'The admin action could not be completed.'
const ADMIN_REASON_CODES = new Set(['abuse', 'spam', 'security', 'policy_violation'])
const DISABLEABLE_AI_FEATURES = new Set([
  'voice_ai',
  'multimodal_bird_identification',
  'agent_booking',
])
const RETRYABLE_JOB_TYPES = new Set([
  'bird-identification',
  'embedding',
  'ingestion',
])

class AdminOperationError extends Error {
  constructor(message, {
    status = null,
    code = 'ADMIN_OPERATION_FAILED',
    retryable = false,
  } = {}) {
    super(message)
    this.name = 'AdminOperationError'
    this.status = status
    this.code = code
    this.retryable = retryable
  }
}

function rangeQuery({ startDate, endDate } = {}) {
  const query = new URLSearchParams()

  if (startDate) query.set('startDate', startDate)
  if (endDate) query.set('endDate', endDate)

  const value = query.toString()
  return value ? `?${value}` : ''
}

function errorsQuery({
  page = 1,
  limit = 25,
  type,
  startDate,
  endDate,
} = {}) {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  })

  if (type) query.set('type', type)
  if (startDate) query.set('startDate', startDate)
  if (endDate) query.set('endDate', endDate)

  return `?${query.toString()}`
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

function safeOperationError(operation, status, code) {
  if (status === 401) {
    return new AdminOperationError('Your admin session has expired. Sign in again.', {
      status,
      code: code || 'UNAUTHORIZED',
    })
  }
  if (status === 403) {
    return new AdminOperationError('You do not have permission to perform this admin action.', {
      status,
      code: code || 'FORBIDDEN',
    })
  }
  if (status === 404) {
    const message = operation === 'retry'
      ? 'This failed job is no longer available.'
      : 'This user is no longer available.'
    return new AdminOperationError(message, { status, code: code || 'NOT_FOUND' })
  }
  if (status === 409) {
    const message = operation === 'retry'
      ? 'This job is no longer failed and cannot be retried.'
      : operation === 'enable'
        ? 'This feature cannot be enabled right now.'
        : operation === 'unsuspend'
          ? 'This account cannot be reactivated.'
          : 'This account cannot be suspended.'
    return new AdminOperationError(message, { status, code: code || 'CONFLICT' })
  }
  if (status === 422) {
    return new AdminOperationError(
      operation === 'disable' || operation === 'enable'
        ? 'This feature or disable duration is not supported.'
        : 'Review the selected suspension reason and try again.',
      { status, code: code || 'UNPROCESSABLE_ENTITY' }
    )
  }
  if (status >= 500) {
    return new AdminOperationError(
      'The server could not complete this action. Please try again.',
      { status, code: code || 'SERVER_ERROR', retryable: true }
    )
  }

  return new AdminOperationError(ADMIN_OPERATION_FALLBACK, {
    status,
    code: code || 'ADMIN_OPERATION_FAILED',
  })
}

async function adminOperationRequest(path, {
  token,
  body,
  operation,
} = {}) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), ADMIN_REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(apiUrl(path), {
      method: 'POST',
      headers: {
        ...authHeaders(token),
        ...JSON_HEADERS,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const envelope = await parseJsonResponse(response)

    if (!response.ok) {
      throw safeOperationError(operation, response.status, envelope?.error?.code)
    }

    if (
      !validateEnvelope(envelope)
      || envelope.success !== true
      || !isObject(envelope.data)
      || !isObject(envelope.meta)
    ) {
      throw new AdminOperationError(
        'The server returned an invalid confirmation. No dashboard state was changed.',
        { code: 'INVALID_RESPONSE', retryable: true }
      )
    }

    return envelope.data
  } catch (error) {
    if (error instanceof AdminOperationError) throw error
    if (error?.name === 'AbortError') {
      throw new AdminOperationError(
        'The admin action took too long. Please try again.',
        { code: 'REQUEST_TIMEOUT', retryable: true }
      )
    }

    throw new AdminOperationError(
      'Could not reach the server. Check your connection and try again.',
      { code: 'NETWORK_ERROR', retryable: true }
    )
  } finally {
    clearTimeout(timeoutId)
  }
}

function hasExactKeys(value, expected) {
  if (!isObject(value)) return false
  const keys = Object.keys(value).sort()
  return keys.length === expected.length
    && keys.every((key, index) => key === [...expected].sort()[index])
}

function isIdentifier(value) {
  return typeof value === 'string' && value.length > 0
}

function invalidOperationResponse() {
  return new AdminOperationError(
    'The server returned an invalid confirmation. No dashboard state was changed.',
    { code: 'INVALID_RESPONSE', retryable: true }
  )
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
  const breakdowns = ['byModel', 'byFeature', 'byPlan', 'byUser']

  if (!isObject(data.totals) || breakdowns.some((field) => !Array.isArray(data[field]))) {
    throw new Error(ADMIN_FALLBACK_ERROR)
  }

  return data
}

function isIsoTimestamp(value) {
  return typeof value === 'string'
    && !Number.isNaN(new Date(value).getTime())
    && new Date(value).toISOString() === value
}

function isNullableMetric(value) {
  return value === null
    || (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1)
}

function isNullableDelta(value) {
  return value === null
    || (typeof value === 'number' && Number.isFinite(value) && value >= -1 && value <= 1)
}

function isQualityRange(value) {
  return isObject(value)
    && isIsoTimestamp(value.startAt)
    && isIsoTimestamp(value.endAt)
    && value.timezone === 'UTC'
    && new Date(value.startAt) < new Date(value.endAt)
}

function isQualityMetric(value) {
  const hasValidShape = isObject(value)
    && isNullableMetric(value.current)
    && isNullableMetric(value.previous)
    && isNullableDelta(value.delta)
    && Number.isInteger(value.currentSampleSize)
    && value.currentSampleSize >= 0
    && Number.isInteger(value.previousSampleSize)
    && value.previousSampleSize >= 0
    && (value.current === null ? value.currentSampleSize === 0 : value.currentSampleSize > 0)
    && (value.previous === null ? value.previousSampleSize === 0 : value.previousSampleSize > 0)
    && (value.current === null || value.previous === null
      ? value.delta === null
      : value.delta !== null)

  if (!hasValidShape) return false
  if (value.current === null || value.previous === null) return true

  return Math.abs((value.current - value.previous) - value.delta) <= 0.0001
}

export async function getAdminAiQuality({ token, startDate, endDate } = {}) {
  const envelope = await adminRequest(`/admin/ai-quality${rangeQuery({ startDate, endDate })}`, { token })
  const data = requireObjectData(envelope)

  const currentDuration = isQualityRange(data.range)
    ? new Date(data.range.endAt).getTime() - new Date(data.range.startAt).getTime()
    : null
  const previousDuration = isQualityRange(data.previousRange)
    ? new Date(data.previousRange.endAt).getTime() - new Date(data.previousRange.startAt).getTime()
    : null

  if (
    !isQualityRange(data.range)
    || !isQualityRange(data.previousRange)
    || data.previousRange.endAt !== data.range.startAt
    || currentDuration !== previousDuration
    || !isObject(data.metrics)
    || AI_QUALITY_METRICS.some((metric) => !isQualityMetric(data.metrics[metric]))
  ) {
    throw new Error(ADMIN_FALLBACK_ERROR)
  }

  return data
}

export async function getAdminSubscriptions({ token, limit = 100 } = {}) {
  const envelope = await adminRequest(`/admin/subscriptions?page=1&limit=${limit}`, { token })
  return requireListData(envelope)
}

export async function getAdminUsers({ token, limit = 100 } = {}) {
  const envelope = await adminRequest(`/admin/users?page=1&limit=${limit}`, { token })
  const result = requireListData(envelope)

  if (result.data.some((user) => (
    !isObject(user)
    || !isIdentifier(user.id)
    || typeof user.email !== 'string'
    || (user.name !== null && typeof user.name !== 'string')
    || !['admin', 'customer', 'tour guide'].includes(user.role)
    || typeof user.plan !== 'string'
    || typeof user.subscriptionStatus !== 'string'
    || !['active', 'suspended'].includes(user.status)
    || (user.suspendedAt !== null && !isIsoTimestamp(user.suspendedAt))
    || (user.suspensionReasonCode !== null && !ADMIN_REASON_CODES.has(user.suspensionReasonCode))
    || (user.status === 'suspended' && user.suspendedAt === null)
    || !isIsoTimestamp(user.createdAt)
  ))) {
    throw new Error(ADMIN_FALLBACK_ERROR)
  }

  return result
}

function validateFeatureState(feature) {
  return isObject(feature)
    && hasExactKeys(feature, ['name', 'enabled', 'status', 'disabledUntil'])
    && DISABLEABLE_AI_FEATURES.has(feature.name)
    && typeof feature.enabled === 'boolean'
    && feature.status === (feature.enabled ? 'enabled' : 'disabled')
    && (feature.enabled
      ? feature.disabledUntil === null
      : isIsoTimestamp(feature.disabledUntil))
}

export async function getAdminAiFeatures({ token } = {}) {
  const envelope = await adminRequest('/admin/ai-features', { token })
  const data = requireObjectData(envelope)
  if (
    !hasExactKeys(data, ['features'])
    || !Array.isArray(data.features)
    || data.features.length !== DISABLEABLE_AI_FEATURES.size
    || data.features.some((feature) => !validateFeatureState(feature))
  ) {
    throw new Error(ADMIN_FALLBACK_ERROR)
  }
  return data
}

export async function getAdminFailures({ token, limit = 6 } = {}) {
  const envelope = await adminRequest(`/admin/failures?page=1&limit=${limit}`, { token })
  const result = requireListData(envelope)

  if (result.data.some((failure) => (
    !isObject(failure)
    || !isIdentifier(failure.id)
    || !['background_job', 'billing'].includes(failure.category)
    || typeof failure.type !== 'string'
    || typeof failure.status !== 'string'
    || !isIsoTimestamp(failure.occurredAt)
    || !isObject(failure.error)
    || typeof failure.error.code !== 'string'
    || typeof failure.error.message !== 'string'
  ))) {
    throw new Error(ADMIN_FALLBACK_ERROR)
  }

  return result
}

function safeLangSmithUrl(value) {
  if (value === null || typeof value !== 'string') return null

  try {
    const url = new URL(value)
    return url.protocol === 'https:'
      && url.port === ''
      && url.username === ''
      && url.password === ''
      && LANGSMITH_HOSTS.has(url.hostname)
      ? url.toString()
      : null
  } catch {
    return null
  }
}

function normalizeOperationalError(error) {
  if (
    !isObject(error)
    || typeof error.id !== 'string'
    || Number.isNaN(new Date(error.timestamp).getTime())
    || !OPERATIONAL_ERROR_TYPES.has(error.type)
    || (error.user !== null && (
      !isObject(error.user)
      || typeof error.user.id !== 'string'
      || typeof error.user.label !== 'string'
    ))
    || (error.traceId !== null && typeof error.traceId !== 'string')
    || (error.traceUrl !== null && typeof error.traceUrl !== 'string')
    || typeof error.message !== 'string'
    || !OPERATIONAL_ERROR_STATUSES.has(error.status)
  ) {
    throw new Error(ADMIN_FALLBACK_ERROR)
  }

  return {
    ...error,
    traceUrl: safeLangSmithUrl(error.traceUrl),
  }
}

export async function getAdminErrors({
  token,
  page = 1,
  limit = 25,
  type,
  startDate,
  endDate,
} = {}) {
  const envelope = await adminRequest(`/admin/errors${errorsQuery({
    page,
    limit,
    type,
    startDate,
    endDate,
  })}`, { token })
  const data = requireObjectData(envelope)

  const paginationFields = ['page', 'limit', 'total', 'totalPages']
  if (
    !Array.isArray(data.errors)
    || !isObject(envelope.meta)
    || paginationFields.some((field) => (
      !Number.isInteger(envelope.meta[field])
      || envelope.meta[field] < 0
    ))
    || envelope.meta.page < 1
    || envelope.meta.limit < 1
  ) {
    throw new Error(ADMIN_FALLBACK_ERROR)
  }

  return {
    data: {
      errors: data.errors.map(normalizeOperationalError),
    },
    meta: envelope.meta,
  }
}

export async function getAdminQueueHealth({ token } = {}) {
  const envelope = await adminRequest('/admin/queue-health', { token })
  const data = requireObjectData(envelope)
  const countFields = ['waiting', 'active', 'completed', 'failed', 'delayed']

  if (!Array.isArray(data.queues) || data.queues.some((queue) => (
    !isObject(queue)
    || typeof queue.id !== 'string'
    || typeof queue.name !== 'string'
    || countFields.some((field) => (
      typeof queue[field] !== 'number'
      || !Number.isFinite(queue[field])
      || queue[field] < 0
    ))
  ))) {
    throw new Error(ADMIN_FALLBACK_ERROR)
  }

  return data
}

export async function retryAdminJob({ token, jobId } = {}) {
  const data = await adminOperationRequest(
    `/admin/jobs/${encodeURIComponent(jobId)}/retry`,
    { token, body: {}, operation: 'retry' }
  )

  if (
    !hasExactKeys(data, ['auditId', 'job'])
    || !/^\d+$/.test(data.auditId)
    || !hasExactKeys(data.job, ['id', 'type', 'queue', 'status'])
    || data.job.id !== jobId
    || !RETRYABLE_JOB_TYPES.has(data.job.type)
    || !isIdentifier(data.job.queue)
    || data.job.status !== 'queued'
  ) {
    throw invalidOperationResponse()
  }

  return data
}

export async function suspendAdminUser({ token, userId, reasonCode } = {}) {
  const data = await adminOperationRequest(
    `/admin/users/${encodeURIComponent(userId)}/suspend`,
    { token, body: { reasonCode }, operation: 'suspend' }
  )

  if (
    !hasExactKeys(data, ['auditId', 'user'])
    || !/^\d+$/.test(data.auditId)
    || !hasExactKeys(data.user, ['id', 'status', 'suspendedAt', 'reasonCode'])
    || data.user.id !== userId
    || data.user.status !== 'suspended'
    || !isIsoTimestamp(data.user.suspendedAt)
    || !ADMIN_REASON_CODES.has(data.user.reasonCode)
    || data.user.reasonCode !== reasonCode
  ) {
    throw invalidOperationResponse()
  }

  return data
}

export async function disableAdminAiFeature({
  token,
  feature,
  durationMinutes,
} = {}) {
  const data = await adminOperationRequest(
    `/admin/ai-features/${encodeURIComponent(feature)}/disable`,
    { token, body: { durationMinutes }, operation: 'disable' }
  )

  if (
    !hasExactKeys(data, ['auditId', 'feature'])
    || !/^\d+$/.test(data.auditId)
    || !hasExactKeys(data.feature, ['name', 'status', 'disabledUntil'])
    || data.feature.name !== feature
    || !DISABLEABLE_AI_FEATURES.has(data.feature.name)
    || data.feature.status !== 'disabled'
    || !isIsoTimestamp(data.feature.disabledUntil)
  ) {
    throw invalidOperationResponse()
  }

  return data
}

export async function enableAdminAiFeature({ token, feature } = {}) {
  const data = await adminOperationRequest(
    `/admin/ai-features/${encodeURIComponent(feature)}/enable`,
    { token, body: {}, operation: 'enable' }
  )
  if (
    !hasExactKeys(data, ['auditId', 'feature'])
    || !/^\d+$/.test(data.auditId)
    || !hasExactKeys(data.feature, ['name', 'status', 'disabledUntil'])
    || data.feature.name !== feature
    || !DISABLEABLE_AI_FEATURES.has(feature)
    || data.feature.status !== 'enabled'
    || data.feature.disabledUntil !== null
  ) {
    throw invalidOperationResponse()
  }
  return data
}

export async function unsuspendAdminUser({ token, userId } = {}) {
  const data = await adminOperationRequest(
    `/admin/users/${encodeURIComponent(userId)}/unsuspend`,
    { token, body: {}, operation: 'unsuspend' }
  )
  if (
    !hasExactKeys(data, ['auditId', 'user'])
    || !/^\d+$/.test(data.auditId)
    || !hasExactKeys(data.user, ['id', 'status', 'suspendedAt', 'reasonCode'])
    || data.user.id !== userId
    || data.user.status !== 'active'
    || data.user.suspendedAt !== null
    || data.user.reasonCode !== null
  ) {
    throw invalidOperationResponse()
  }
  return data
}

export const ADMIN_SECTION_IDS = Object.freeze({
  AI_OPERATIONS: 'ai_operations',
  COMMERCIAL: 'commercial',
  EMERGENCY: 'emergency',
})

const ADMIN_SECTION_LOADERS = Object.freeze({
  [ADMIN_SECTION_IDS.AI_OPERATIONS]: async (options) => {
    const [
      overview,
      usage,
      costs,
      quality,
      queueHealth,
      failures,
      errors,
    ] = await Promise.all([
      getAdminOverview(options),
      getAdminAiUsage(options),
      getAdminAiCosts(options),
      getAdminAiQuality(options),
      getAdminQueueHealth(options),
      getAdminFailures(options),
      getAdminErrors(options),
    ])
    return { overview, usage, costs, quality, queueHealth, failures, errors }
  },
  [ADMIN_SECTION_IDS.COMMERCIAL]: async (options) => {
    const [subscriptions, users] = await Promise.all([
      getAdminSubscriptions(options),
      getAdminUsers(options),
    ])
    return { subscriptions, users }
  },
  [ADMIN_SECTION_IDS.EMERGENCY]: async (options) => ({
    aiFeatures: await getAdminAiFeatures(options),
  }),
})

export async function loadAdminSection(sectionId, options = {}) {
  const loader = ADMIN_SECTION_LOADERS[sectionId]
  if (!loader) {
    throw new Error(ADMIN_FALLBACK_ERROR)
  }
  return loader(options)
}

export {
  ADMIN_REASON_CODES,
  ADMIN_REQUEST_TIMEOUT_MS,
  AdminOperationError,
  DISABLEABLE_AI_FEATURES,
}
