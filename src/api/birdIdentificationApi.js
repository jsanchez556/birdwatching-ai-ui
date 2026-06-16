import {
  API_FALLBACK_ERROR_MESSAGE,
  apiUrl,
  authHeaders,
  getApiErrorMessage,
  isObject,
  JSON_HEADERS,
  parseJsonResponse,
  validateEnvelope,
} from './http'

const IMAGE_TYPE_BY_EXTENSION = new Map([
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['png', 'image/png'],
  ['webp', 'image/webp'],
  ['gif', 'image/gif'],
])

function fileExtension(file) {
  const name = typeof file?.name === 'string' ? file.name.trim().toLowerCase() : ''
  const match = name.match(/\.([a-z0-9]+)$/)
  return match?.[1] || ''
}

export function imageUploadContentType(file) {
  const mimeType = typeof file?.type === 'string' ? file.type.trim().toLowerCase() : ''
  return mimeType || IMAGE_TYPE_BY_EXTENSION.get(fileExtension(file)) || 'application/octet-stream'
}

function assertBirdIdentificationEnvelope(data) {
  if (!validateEnvelope(data) || data.success !== true || !isObject(data.data) || !isObject(data.meta)) {
    throw new Error(getApiErrorMessage(data, API_FALLBACK_ERROR_MESSAGE))
  }
}

function normalizeIdentificationResponse(data) {
  assertBirdIdentificationEnvelope(data)

  return {
    status: typeof data.data.status === 'string' ? data.data.status : '',
    bestMatch: isObject(data.data.bestMatch) ? data.data.bestMatch : null,
    summary: typeof data.data.summary === 'string' ? data.data.summary : '',
    imageAnalysis: isObject(data.data.imageAnalysis) ? data.data.imageAnalysis : {},
    imageObservations: isObject(data.data.imageObservations) ? data.data.imageObservations : {},
    candidates: Array.isArray(data.data.candidates) ? data.data.candidates : [],
    notes: Array.isArray(data.data.notes) ? data.data.notes.filter((note) => typeof note === 'string' && note.trim()) : [],
    meta: data.meta || {},
  }
}

function normalizeQueuedIdentificationResponse(data) {
  assertBirdIdentificationEnvelope(data)

  return {
    jobId: typeof data.data.jobId === 'string' ? data.data.jobId : '',
    jobStatus: typeof data.data.status === 'string' ? data.data.status : '',
    meta: data.meta || {},
  }
}

function normalizeJobStatusResponse(data) {
  assertBirdIdentificationEnvelope(data)

  const jobStatus = typeof data.data.status === 'string' ? data.data.status : ''
  const response = {
    jobId: typeof data.data.jobId === 'string' ? data.data.jobId : '',
    jobStatus,
    meta: data.meta || {},
  }

  if (jobStatus === 'completed' && isObject(data.data.result)) {
    response.result = normalizeIdentificationResponse({
      success: true,
      data: data.data.result,
      meta: data.meta || {},
    })
  }

  if (jobStatus === 'failed') {
    response.error = isObject(data.data.error) && typeof data.data.error.message === 'string'
      ? data.data.error.message
      : 'Bird identification failed. Please try again.'
  }

  return response
}

function normalizeIdentifyResponse(data) {
  assertBirdIdentificationEnvelope(data)

  if (typeof data.data.jobId === 'string' && ['queued', 'active', 'processing'].includes(data.data.status)) {
    return normalizeQueuedIdentificationResponse(data)
  }

  return normalizeIdentificationResponse(data)
}

export async function identifyBirdByUrl({ imageUrl, token, signal } = {}) {
  const response = await fetch(apiUrl('/birds/identify'), {
    method: 'POST',
    headers: {
      ...JSON_HEADERS,
      ...authHeaders(token),
    },
    body: JSON.stringify({ imageUrl }),
    signal,
  })
  const data = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, 'Unable to identify this bird.'))
  }

  return normalizeIdentifyResponse(data)
}

export async function identifyBirdByFile({ file, token, signal } = {}) {
  const response = await fetch(apiUrl('/birds/identify'), {
    method: 'POST',
    headers: {
      'Content-Type': imageUploadContentType(file),
      ...(file?.name ? { 'X-Filename': file.name } : {}),
      ...authHeaders(token),
    },
    body: file,
    signal,
  })
  const data = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, 'Unable to identify this bird.'))
  }

  return normalizeIdentifyResponse(data)
}

export async function getBirdIdentificationJobStatus({ jobId, token, signal } = {}) {
  const response = await fetch(apiUrl(`/jobs/${encodeURIComponent(jobId || '')}`), {
    method: 'GET',
    headers: {
      ...authHeaders(token),
    },
    signal,
  })
  const data = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, 'Unable to check this identification.'))
  }

  return normalizeJobStatusResponse(data)
}

export {
  normalizeIdentificationResponse,
  normalizeJobStatusResponse,
  normalizeQueuedIdentificationResponse,
}
