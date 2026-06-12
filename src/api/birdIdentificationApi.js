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

  return normalizeIdentificationResponse(data)
}

export async function identifyBirdByFile({ file, token, signal } = {}) {
  const response = await fetch(apiUrl('/birds/identify'), {
    method: 'POST',
    headers: {
      'Content-Type': file?.type || 'application/octet-stream',
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

  return normalizeIdentificationResponse(data)
}
