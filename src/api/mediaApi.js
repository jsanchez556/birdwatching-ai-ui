import {
  apiUrl,
  getApiErrorMessage,
  parseJsonResponse,
} from './http'

const mediaUrlCache = new Map()

function isAbsoluteMediaUrl(value) {
  return /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(value)
    || /^(?:data|blob):/i.test(value)
}

function cloudFrontBaseUrl() {
  return (import.meta.env.VITE_CLOUDFRONT_BASE_URL || '').replace(/\/+$/, '')
}

function isUnsafeSegment(segment) {
  try {
    const decodedSegment = decodeURIComponent(segment)
    return decodedSegment === '.' || decodedSegment === '..'
  } catch {
    return true
  }
}

function normalizeMediaKey(value) {
  const key = String(value || '')
    .trim()
    .replaceAll('\\', '/')
    .replace(/^\/+/, '')
    .replace(/^files\/+/i, '')

  if (!key || isAbsoluteMediaUrl(key)) {
    return null
  }

  const segments = key.split('/').filter(Boolean)

  if (!segments.length || segments.some(isUnsafeSegment)) {
    return null
  }

  return segments.join('/')
}

function mediaFileUrl(key) {
  return apiUrl(`/files/${key.split('/').map(encodeURIComponent).join('/')}`)
}

function cloudFrontMediaUrl(key) {
  const baseUrl = cloudFrontBaseUrl()

  if (!baseUrl) {
    return ''
  }

  return `${baseUrl}/${key.split('/').map(encodeURIComponent).join('/')}`
}

export function isRelativeMediaPath(value) {
  return Boolean(normalizeMediaKey(value))
}

export async function resolveMediaUrl(value) {
  if (!value || typeof value !== 'string') {
    return ''
  }

  if (isAbsoluteMediaUrl(value)) {
    return value
  }

  const key = normalizeMediaKey(value)

  if (!key) {
    return ''
  }

  const cdnUrl = cloudFrontMediaUrl(key)

  if (cdnUrl) {
    return cdnUrl
  }

  if (mediaUrlCache.has(key)) {
    return mediaUrlCache.get(key)
  }

  const promise = fetch(mediaFileUrl(key))
    .then(async (response) => {
      const data = await parseJsonResponse(response)

      if (!response.ok) {
        throw new Error(getApiErrorMessage(data, 'Failed to load bird media'))
      }

      if (!data.success || typeof data.data?.url !== 'string') {
        throw new Error('Unexpected media response format')
      }

      return data.data.url
    })
    .catch((error) => {
      mediaUrlCache.delete(key)
      throw error
    })

  mediaUrlCache.set(key, promise)
  return promise
}

export function clearMediaUrlCache() {
  mediaUrlCache.clear()
}
